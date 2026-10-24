"""
One client for Gemini, with more than one key.

The free tier of the Gemini API answers 429 and 503 fairly often, and
one key makes that a single point of failure for every AI feature in
the app: receipt scanning, goal breakdown, transaction breakdown,
direction classification and the advisor all ask the same provider.

So the keys are held in a pool. A call walks the pool, and a key that
answers 429 is put aside for a while and the next key is tried. A key
that works becomes the preferred one for the next call.

Every key is optional. When they are all down or all rate limited, the
call returns None and the caller falls back to what it can do without
a model. Nothing in this app waits on the model forever.

The keys come from the environment:

    GEMINI_API_KEY          the first key
    GEMINI_API_KEY_2        the second key
    GEMINI_API_KEY_3        the third key

They are never written to the database and never sent to the browser.
"""

import hashlib
import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# The models to try, in order. A model that was retired answers 404,
# and a model that is overloaded answers 503, so the fallback list
# matters.
_DEFAULT_MODELS = [
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
    "gemini-3-flash-preview",
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash-lite",
]


def _model_list() -> List[str]:
    """
    The models to try, most preferred first.

    The primary model comes first, then the fallbacks, then the
    defaults. The primary is always tried, even when a fallback list
    is set, because the primary is the one the deployment was tested
    with.
    """
    models: List[str] = []

    primary = os.getenv("GEMINI_MODEL", "").strip()
    if primary:
        models.append(primary)

    configured = os.getenv("GEMINI_FALLBACK_MODELS", "").strip()
    if configured:
        for model in configured.split(","):
            model = model.strip()
            if model and model not in models:
                models.append(model)

    for model in _DEFAULT_MODELS:
        if model not in models:
            models.append(model)

    return models


def _key_pool() -> List[str]:
    """Every configured key, in the order they were given."""
    keys: List[str] = []
    for name in ("GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3"):
        value = (os.getenv(name, "") or "").strip()
        if value and value not in keys:
            keys.append(value)
    return keys


class _KeyState:
    """
    What the pool knows about one key.

    The quota is per key AND per model, so the pause is kept per pair.
    A key that is out of quota on one model can still answer on
    another, and pausing the whole key for that would waste it.
    """

    def __init__(self, key: str) -> None:
        self.key = key
        # A pair that failed is not tried again until this has passed.
        self._paused_until: Dict[str, float] = {}
        self._failures: Dict[str, int] = {}
        self.calls = 0
        self.successes = 0
        self.last_error = ""

    def available(self, model: str) -> bool:
        """Whether this key can be used with this model right now."""
        return time.time() >= self._paused_until.get(model, 0.0)

    def record_success(self, model: str) -> None:
        self._failures.pop(model, None)
        self._paused_until.pop(model, None)
        self.successes += 1
        self.calls += 1

    def record_failure(self, model: str, error: str, cooldown: float) -> None:
        failures = self._failures.get(model, 0) + 1
        self._failures[model] = failures
        self.calls += 1
        self.last_error = error
        # The pause grows with the number of failures, up to fifteen
        # minutes. A pair that keeps failing is not hammered.
        self._paused_until[model] = time.time() + min(
            cooldown * (2 ** (failures - 1)), 900
        )


class _Cache:
    """
    A small cache of answers.

    The free tier gives a handful of calls a minute, and the same
    question gets asked more than once: a goal the user previews and
    then saves, a receipt that is scanned again, a breakdown that is
    shown and then edited. Asking the model the same thing twice
    wastes the quota that the next question needs.

    The cache holds the text answer only, and only for a short while,
    because a price list or a shop name changes.
    """

    def __init__(self, ttl: int = 900, max_entries: int = 200) -> None:
        self.ttl = ttl
        self.max_entries = max_entries
        self._lock = threading.Lock()
        self._entries: Dict[str, Any] = {}

    def get(self, key: str) -> Optional[str]:
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            created, value = entry
            if time.time() - created > self.ttl:
                self._entries.pop(key, None)
                return None
            return value

    def set(self, key: str, value: str) -> None:
        with self._lock:
            if len(self._entries) >= self.max_entries:
                oldest = min(
                    self._entries.items(), key=lambda kv: kv[1][0]
                )[0]
                self._entries.pop(oldest, None)
            self._entries[key] = (time.time(), value)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()

    def size(self) -> int:
        with self._lock:
            return len(self._entries)


class GeminiPool:
    """
    The pool of keys, and the model list.

    One instance lives for the process. It is safe to use from several
    threads, which matters because the receipt scan runs in a worker
    while the request handler may also ask the model.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._keys: Dict[str, _KeyState] = {}
        self._preferred = ""
        # The key and model that answered last, so the next call starts
        # with the pair that is known to work.
        self._preferred_model = ""
        self._retired_models: set = set()
        self._cache = _Cache()
        self._reload()

    def _retire_model(self, model: str) -> None:
        """The model is gone. Do not try it again."""
        with self._lock:
            self._retired_models.add(model)

    def _reload(self) -> None:
        """Read the keys from the environment."""
        with self._lock:
            configured = _key_pool()
            # Keep the state of the keys that are still configured.
            self._keys = {
                key: self._keys.get(key) or _KeyState(key)
                for key in configured
            }
            if self._preferred not in self._keys:
                self._preferred = ""

    @property
    def has_keys(self) -> bool:
        return bool(self._keys)

    def health(self) -> Dict[str, Any]:
        """The state of the pool, for the health endpoint."""
        with self._lock:
            usable = sum(1 for s in self._keys.values() if s.calls == 0 or s.successes > 0)
        return {
            "keys_configured": len(self._keys),
            "keys_available": usable,
            "models": _model_list(),
            "cached_answers": self._cache.size(),
        }

    def stats(self) -> List[Dict[str, Any]]:
        """What the pool knows. Used by the health endpoint."""
        with self._lock:
            return [
                {
                    # The key itself is never shown.
                    "suffix": state.key[-4:],
                    "available": state.calls == 0 or state.successes > 0,
                    "calls": state.calls,
                    "successes": state.successes,
                    "failures": state.failures,
                    "last_error": state.last_error,
                }
                for state in self._keys.values()
            ]

    def _ordered_keys(self) -> List[_KeyState]:
        """
        The keys to try, in order.

        The preferred key comes first, then the others that are not
        paused, then the paused ones. A paused key is still worth
        trying at the end, because the pause may have passed by the
        time the call gets there.
        """
        with self._lock:
            states = list(self._keys.values())
            if not states:
                return []

            preferred = None
            if self._preferred:
                preferred = next(
                    (s for s in states if s.key == self._preferred), None
                )

            ready = [s for s in states if s is not preferred]
            # The key with the most answers goes first, so the pool
            # settles on the key that works rather than rediscovering
            # it on every call.
            ready.sort(key=lambda s: (-s.successes, s.calls))

            ordered: List[_KeyState] = []
            if preferred is not None:
                ordered.append(preferred)
            ordered.extend(ready)
            return ordered

    def call(
        self,
        payload: Dict[str, Any],
        timeout: int = 45,
        max_attempts: Optional[int] = None,
        use_cache: bool = True,
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Ask the model for an answer.

        Returns (text, error). Exactly one of the two is set. The error
        says what went wrong, so a caller can log something useful.
        """
        # The environment may have changed since the process started.
        self._reload()

        if not self._keys:
            return None, "no Gemini key is configured"

        cache_key = ""
        if use_cache:
            cache_key = hashlib.sha256(
                json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
            ).hexdigest()
            cached = self._cache.get(cache_key)
            if cached is not None:
                logger.info("The answer was in the cache")
                return cached, None

        models = [m for m in _model_list() if m not in self._retired_models]
        if not models:
            models = _model_list()

        keys = self._ordered_keys()
        if not keys:
            return None, "no Gemini key is configured"

        # The quota is per key AND per model. A key that is out of
        # quota on one model can still work on another, so every pair
        # is a separate attempt and the pairs that work are remembered.
        pairs = [
            (state, model)
            for state in keys
            for model in models
            if state.available(model)
        ]
        # When every pair is paused, try them all anyway. The pause may
        # have passed by the time the call gets there.
        if not pairs:
            pairs = [(state, model) for state in keys for model in models]

        with self._lock:
            last_key = self._preferred
            last_model = self._preferred_model
        if last_key and last_model:
            pairs.sort(
                key=lambda pair: 0
                if (pair[0].key, pair[1]) == (last_key, last_model)
                else 1
            )

        budget = max_attempts or len(pairs)
        budget = max(1, min(budget, 16))

        last_error = "no attempt was made"

        for state, model in pairs:
            if budget <= 0:
                break

            url = (
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"{model}:generateContent?key={state.key}"
            )

            try:
                data = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(
                    url,
                    data=data,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=timeout) as response:
                    result = json.loads(response.read().decode("utf-8"))

                candidates = result.get("candidates") or []
                if not candidates:
                    raise RuntimeError("the model returned no candidates")

                finish = candidates[0].get("finishReason") or ""
                parts = (candidates[0].get("content") or {}).get("parts") or []
                text = "".join(part.get("text", "") for part in parts).strip()

                if not text:
                    if finish == "MAX_TOKENS":
                        # The answer was cut short. The model wanted
                        # more room than it was given.
                        last_error = (
                            f"{model} ran out of room before it finished "
                            "the answer"
                        )
                        logger.info("Gemini %s", last_error)
                        budget -= 1
                        continue
                    raise RuntimeError(
                        f"the model returned no text (finish: {finish})"
                    )

                state.record_success(model)
                with self._lock:
                    self._preferred = state.key
                    self._preferred_model = model
                if cache_key:
                    self._cache.set(cache_key, text)
                return text, None

            except urllib.error.HTTPError as exc:
                detail = ""
                try:
                    detail = exc.read().decode("utf-8", "replace")[:200]
                except Exception:  # noqa: BLE001
                    pass
                last_error = f"HTTP {exc.code} from {model}: {detail}"
                budget -= 1

                if exc.code == 404:
                    # The model is not there any more. It is not the
                    # key's fault, so the key keeps its standing and
                    # the next pair is tried.
                    self._retire_model(model)
                    logger.info(
                        "Gemini model %s is not available, the next one "
                        "is tried",
                        model,
                    )
                    continue

                if exc.code in (429, 403):
                    # The key is out of quota for this model. Another
                    # pair is tried right away, because another model
                    # on the same key may still have quota.
                    #
                    # "exceeded your current quota" means the daily
                    # allowance is gone and waiting a minute will not
                    # bring it back, so that pair is put aside for a
                    # long time. A plain rate limit comes back quickly.
                    quota_gone = "exceeded your current quota" in (detail or "")
                    if quota_gone:
                        cooldown = 900
                    elif exc.code == 429:
                        cooldown = 60
                    else:
                        cooldown = 300
                    state.record_failure(model, last_error, cooldown)
                    logger.warning(
                        "Gemini %s on key ...%s, the next pair is tried",
                        last_error,
                        state.key[-4:],
                    )
                    continue

                if exc.code in (500, 502, 503, 504):
                    state.record_failure(model, last_error, 5)
                    logger.warning("Gemini %s, retrying", last_error)
                    continue

                state.record_failure(model, last_error, 30)
                return None, last_error

            except Exception as exc:  # noqa: BLE001
                last_error = f"{type(exc).__name__}: {exc}"
                state.record_failure(model, last_error, 10)
                logger.warning("Gemini call failed: %s", last_error)
                budget -= 1
                continue

        return None, last_error

    def health(self) -> Dict[str, Any]:
        """The state of the pool, for the health endpoint."""
        with self._lock:
            usable = sum(1 for s in self._keys.values() if s.calls == 0 or s.successes > 0)
        return {
            "keys_configured": len(self._keys),
            "keys_available": usable,
            "models": _model_list(),
            "cached_answers": self._cache.size(),
        }

    def stats(self) -> List[Dict[str, Any]]:
        """What the pool knows. Used by the health endpoint."""
        with self._lock:
            return [
                {
                    # The key itself is never shown.
                    "suffix": state.key[-4:],
                    "available": state.calls == 0 or state.successes > 0,
                    "calls": state.calls,
                    "successes": state.successes,
                    "failures": state.failures,
                    "last_error": state.last_error,
                }
                for state in self._keys.values()
            ]

    def _ordered_keys(self) -> List[_KeyState]:
        """
        The keys to try, in order.

        The preferred key comes first, then the others that are not
        paused, then the paused ones. A paused key is still worth
        trying at the end, because the pause may have passed by the
        time the call gets there.
        """
        with self._lock:
            states = list(self._keys.values())
            if not states:
                return []

            preferred = None
            if self._preferred:
                preferred = next(
                    (s for s in states if s.key == self._preferred), None
                )

            ready = [s for s in states if s is not preferred]
            # The key with the most answers goes first, so the pool
            # settles on the key that works rather than rediscovering
            # it on every call.
            ready.sort(key=lambda s: (-s.successes, s.calls))

            ordered: List[_KeyState] = []
            if preferred is not None:
                ordered.append(preferred)
            ordered.extend(ready)
            return ordered

    def call(
        self,
        payload: Dict[str, Any],
        timeout: int = 45,
        max_attempts: Optional[int] = None,
        use_cache: bool = True,
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Ask the model for an answer.

        Returns (text, error). Exactly one of the two is set. The error
        says what went wrong, so a caller can log something useful.
        """
        # The environment may have changed since the process started.
        self._reload()

        if not self._keys:
            return None, "no Gemini key is configured"

        cache_key = ""
        if use_cache:
            cache_key = hashlib.sha256(
                json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
            ).hexdigest()
            cached = self._cache.get(cache_key)
            if cached is not None:
                logger.info("The answer was in the cache")
                return cached, None

        models = [m for m in _model_list() if m not in self._retired_models]
        if not models:
            models = _model_list()

        with self._lock:
            working_model = self._preferred_model
        if working_model and working_model in models:
            models = [working_model] + [m for m in models if m != working_model]

        keys = self._ordered_keys()
        if not keys:
            return None, "no Gemini key is configured"

        last_error = "no attempt was made"
        budget = max_attempts or (len(keys) * len(models))
        budget = max(1, min(budget, 12))
        used = 0

        # The quota is per key AND per model. A key whose quota is gone
        # on one model can still work on another, so every pair is
        # tried, and the pairs that work are remembered.
        pairs = [
            (state, model)
            for state in keys
            for model in models
            if state.available(model)
        ]
        # When every pair is paused, try them all anyway. The pause may
        # have passed by the time the call gets there.
        if not pairs:
            pairs = [(state, model) for state in keys for model in models]

        # The pair that answered last comes first.
        with self._lock:
            last_pair = (self._preferred, self._preferred_model)
        if last_pair[0] and last_pair[1]:
            pairs.sort(
                key=lambda pair: 0
                if (pair[0].key, pair[1]) == last_pair
                else 1
            )

        for state, model in pairs:
            for _ in range(1):
                if used >= budget:
                    break
                used += 1

                url = (
                    "https://generativelanguage.googleapis.com/v1beta/models/"
                    f"{model}:generateContent?key={state.key}"
                )

                try:
                    data = json.dumps(payload).encode("utf-8")
                    req = urllib.request.Request(
                        url,
                        data=data,
                        headers={"Content-Type": "application/json"},
                        method="POST",
                    )
                    with urllib.request.urlopen(req, timeout=timeout) as response:
                        result = json.loads(response.read().decode("utf-8"))

                    candidates = result.get("candidates") or []
                    if not candidates:
                        raise RuntimeError("the model returned no candidates")

                    finish = candidates[0].get("finishReason") or ""
                    parts = (
                        (candidates[0].get("content") or {}).get("parts") or []
                    )
                    text = "".join(part.get("text", "") for part in parts).strip()

                    if not text:
                        # The answer was cut short. The model wanted
                        # more room than it was given, so the same
                        # model is asked again with more.
                        if finish == "MAX_TOKENS":
                            last_error = (
                                f"{model} ran out of room before it "
                                "finished the answer"
                            )
                            logger.info("Gemini %s", last_error)
                            continue
                        raise RuntimeError(
                            f"the model returned no text (finish: {finish})"
                        )

                    state.record_success(model)
                    with self._lock:
                        self._preferred = state.key
                        self._preferred_model = model
                    if cache_key:
                        self._cache.set(cache_key, text)
                    return text, None

                except urllib.error.HTTPError as exc:
                    detail = ""
                    try:
                        detail = exc.read().decode("utf-8", "replace")[:200]
                    except Exception:  # noqa: BLE001
                        pass
                    last_error = f"HTTP {exc.code} from {model}: {detail}"

                    if exc.code == 404:
                        # The model is not there any more. It is not
                        # the key's fault, so the key keeps its standing
                        # and the next model is tried.
                        self._retire_model(model)
                        logger.info(
                            "Gemini model %s is not available, "
                            "the next one is tried",
                            model,
                        )
                        continue

                    if exc.code in (429, 403):
                        # The key is over its quota. Another key is
                        # tried right away rather than another model,
                        # because every model would fail the same way.
                        #
                        # "exceeded your current quota" means the daily
                        # allowance is gone, and a minute of waiting
                        # will not bring it back, so that key is put
                        # aside for a long time. A plain rate limit
                        # comes back quickly.
                        quota_gone = "exceeded your current quota" in (
                            detail or ""
                        )
                        if quota_gone:
                            cooldown = 900
                        elif exc.code == 429:
                            cooldown = 60
                        else:
                            cooldown = 300
                        state.record_failure(model, last_error, cooldown)
                        logger.warning(
                            "Gemini %s on key ...%s, the next pair is tried",
                            last_error,
                            state.key[-4:],
                        )
                        continue

                    if exc.code in (500, 502, 503, 504):
                        state.record_failure(model, last_error, 5)
                        logger.warning("Gemini %s, retrying", last_error)
                        continue

                    state.record_failure(model, last_error, 30)
                    return None, last_error

                except Exception as exc:  # noqa: BLE001
                    last_error = f"{type(exc).__name__}: {exc}"
                    state.record_failure(model, last_error, 10)
                    logger.warning("Gemini call failed: %s", last_error)
                    continue

        return None, last_error


# The pool for the process.
_pool: Optional[GeminiPool] = None
_pool_lock = threading.Lock()


def get_pool() -> GeminiPool:
    """The pool, created once."""
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                _pool = GeminiPool()
    return _pool


def call_gemini(
    prompt: str,
    timeout: int = 45,
    temperature: float = 0.1,
    max_output_tokens: int = 4096,
    json_response: bool = False,
    system_instruction: Optional[str] = None,
) -> Optional[str]:
    """
    Send a prompt to Gemini and return the raw text answer.

    Returns None when the model could not be reached. Every caller in
    this app treats the model as optional and falls back to something
    that does not need it.
    """
    generation_config: Dict[str, Any] = {
        "temperature": temperature,
        "maxOutputTokens": max_output_tokens,
    }
    if json_response:
        generation_config["responseMimeType"] = "application/json"

    contents: List[Dict[str, Any]] = [{"parts": [{"text": prompt}]}]
    payload: Dict[str, Any] = {
        "contents": contents,
        "generationConfig": generation_config,
    }
    if system_instruction:
        payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

    text, error = get_pool().call(payload, timeout=timeout)
    if error:
        logger.info("Gemini did not answer: %s", error)
        return None
    return text


def call_gemini_json(
    prompt: str,
    timeout: int = 45,
    temperature: float = 0.1,
    max_output_tokens: int = 4096,
    system_instruction: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Send a prompt and get an object back.

    The model sometimes wraps the JSON in a code fence or adds a line
    of prose around it, so the text is read for the outermost braces.
    """
    text = call_gemini(
        prompt,
        timeout=timeout,
        temperature=temperature,
        max_output_tokens=max_output_tokens,
        json_response=True,
        system_instruction=system_instruction,
    )
    if not text:
        return None

    cleaned = text.strip()
    fence = None
    import re

    fence = re.search(r"```(?:json)?\s*(.+?)```", cleaned, re.DOTALL)
    if fence:
        cleaned = fence.group(1).strip()

    try:
        return json.loads(cleaned)
    except (ValueError, TypeError):
        pass

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(cleaned[start : end + 1])
        except (ValueError, TypeError):
            pass

    logger.info("The model answer held no JSON: %s", text[:200])
    return None
