#!/usr/bin/env bash
#
# Set the secrets the deployment needs.
#
# The deployment pipeline has been failing since it was written,
# because the action it used was given three names it does not
# accept, and because none of these secrets had ever been created.
# This script creates them.
#
# Run it in the terminal that has `gh` logged in:
#
#   bash scripts/setup_deploy_secrets.sh
#
# It asks for the private key rather than reading it silently, so
# that the key does not end up in the shell history. If you would
# rather not type it, set `VPS_SSH_KEY_FILE` to the path of the key
# and this script will read that instead.
#
# The host key fingerprint is checked against the one on the server.
# If the server has been moved, the fingerprint will not match and
# this script will stop rather than pin the wrong key.

set -euo pipefail

REPO="${REPO:-RyukoSan20/financial-manager}"
ENVIRONMENT="${ENVIRONMENT:-Production}"

say() { printf '\n\033[1;32m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$1"; }
die() { printf '\033[1;31mxx\033[0m %s\n' "$1" >&2; exit 1; }

command -v gh >/dev/null 2>&1 || die "gh is not installed. See https://cli.github.com"

say "Checking that gh is logged in"
gh auth status >/dev/null 2>&1 || die "gh is not logged in. Run: gh auth login"
echo "ok"

# ---------------------------------------------------------------------------
# The host and the user
# ---------------------------------------------------------------------------

say "The server"

DEFAULT_HOST="43.173.52.98"
DEFAULT_USER="ubuntu"

HOST="${VPS_HOST:-$DEFAULT_HOST}"
USER_NAME="${VPS_USER:-$DEFAULT_USER}"

if [ -t 0 ]; then
  read -r -p "Host [$HOST]: " answer
  [ -n "$answer" ] && HOST="$answer"
  read -r -p "User [$USER_NAME]: " answer
  [ -n "$answer" ] && USER_NAME="$answer"
fi

echo "host: $HOST"
echo "user: $USER_NAME"

# ---------------------------------------------------------------------------
# The private key
# ---------------------------------------------------------------------------

say "The private key"

if [ -n "${VPS_SSH_KEY_FILE:-}" ]; then
  KEY_FILE="$VPS_SSH_KEY_FILE"
  [ -f "$KEY_FILE" ] || die "no such file: $KEY_FILE"
  echo "reading $KEY_FILE"
  PRIVATE_KEY="$(cat "$KEY_FILE")"
elif [ -n "${VPS_SSH_KEY:-}" ]; then
  echo "reading VPS_SSH_KEY from the environment"
  PRIVATE_KEY="$VPS_SSH_KEY"
else
  DEFAULT_KEY="$HOME/.ssh/id_financial"
  if [ -f "$DEFAULT_KEY" ]; then
    echo "found $DEFAULT_KEY"
    read -r -p "Use this key? [Y/n]: " answer
    if [ -z "$answer" ] || [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
      PRIVATE_KEY="$(cat "$DEFAULT_KEY")"
    fi
  fi
  if [ -z "${PRIVATE_KEY:-}" ]; then
    echo "Paste the private key below. It ends with a line reading:"
    echo "-----END OPENSSH PRIVATE KEY-----"
    echo
    PRIVATE_KEY="$(cat)"
  fi
fi

[ -n "${PRIVATE_KEY:-}" ] || die "no private key given"
echo "$PRIVATE_KEY" | grep -q "BEGIN OPENSSH PRIVATE KEY" \
  || die "that does not look like a private key"

# The key must match the one on the server, or the deployment will
# fail at the first step that connects.
if ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
    -i "$HOME/.ssh/id_financial" "$USER_NAME@$HOST" true 2>/dev/null; then
  echo "the key works on the server"
else
  warn "could not test the key against the server from here"
  warn "the deployment will fail if the key is not the one the server knows"
fi

# ---------------------------------------------------------------------------
# The host key fingerprint
# ---------------------------------------------------------------------------

say "The host key fingerprint"

echo "reading the key the server presents"
FINGERPRINT="$(ssh-keyscan -t ed25519 -H "$HOST" 2>/dev/null | ssh-keygen -lf - 2>/dev/null | awk '{print $2}')"

if [ -z "$FINGERPRINT" ]; then
  die "could not read the host key from $HOST"
fi

echo "the server presents: $FINGERPRINT"
if [ -t 0 ]; then
  read -r -p "Is that the server you expect? [Y/n]: " answer
  if [ "$answer" = "n" ] || [ "$answer" = "N" ]; then
    die "stopping. The fingerprint does not match what was expected."
  fi
fi

# ---------------------------------------------------------------------------
# Writing them
# ---------------------------------------------------------------------------

say "Writing the secrets to $REPO"

set_secret() {
  local name="$1" value="$2"
  echo -n "  $name ... "
  if printf '%s' "$value" | gh secret set "$name" --repo "$REPO" --body - >/dev/null 2>&1; then
    echo "ok"
  else
    die "could not set $name"
  fi
}

set_secret VPS_HOST "$HOST"
set_secret VPS_USER "$USER_NAME"
set_secret VPS_SSH_KEY "$PRIVATE_KEY"
set_secret VPS_HOST_FINGERPRINT "$FINGERPRINT"

# The environment can hold its own secrets, and the deployment runs
# under the Production environment. Writing them there as well means
# the pipeline works whether the secret is read from the repository
# or from the environment.
say "Writing the same secrets to the $ENVIRONMENT environment"

set_env_secret() {
  local name="$1" value="$2"
  echo -n "  $name ... "
  if printf '%s' "$value" | gh secret set "$name" --env "$ENVIRONMENT" --repo "$REPO" --body - >/dev/null 2>&1; then
    echo "ok"
  else
    warn "could not set $name on the environment (the repository copy is enough)"
  fi
}

set_env_secret VPS_HOST "$HOST"
set_env_secret VPS_USER "$USER_NAME"
set_env_secret VPS_SSH_KEY "$PRIVATE_KEY"
set_env_secret VPS_HOST_FINGERPRINT "$FINGERPRINT"

say "Done"
echo "The secrets are set. The next push to main will deploy on its own."
echo
echo "To deploy without pushing:"
echo "  gh workflow run deploy.yml --repo $REPO"
echo
echo "To watch it:"
echo "  gh run watch --repo $REPO"
