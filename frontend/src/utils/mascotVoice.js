/**
 * The mascot's voice.
 *
 * The companion is not only a picture. When the reader asks it
 * something, it answers out loud: "Oke! 2 Kopi Jago vanila total
 * Rp30.000 di Kemayoran sudah dicatat!"
 *
 * The browser can speak through `window.speechSynthesis`, and that is
 * what this uses. It is not available everywhere - an old browser, a
 * browser with no voices installed, a phone with the sound off - so
 * every call here is allowed to do nothing. A reader who cannot hear
 * the mascot still sees the bubble with the same words in it, and
 * nothing breaks.
 *
 * The reader can also turn the voice off. The mute lives here rather
 * than in each screen, so that "mute" means the same thing in the
 * text parser, in the voice input and everywhere else the companion
 * speaks.
 */

const MUTE_KEY = 'mascot_voice_muted';

let muted = false;
try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch {
  // A browser that will not give up its storage is a browser that has
  // no remembered preference, which is the same as not muted.
  muted = false;
}

/**
 * Whether the companion is allowed to speak.
 */
export const isMuted = () => muted;

/**
 * Turn the companion's voice on or off, and remember the choice.
 */
export const setMuted = (value) => {
  muted = Boolean(value);
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // Nothing to remember it in, but the choice still holds for as
    // long as the page is open.
  }
  if (muted) cancelSpeech();
  return muted;
};

/**
 * Whether this browser can speak at all.
 */
export const canSpeak = () =>
  typeof window !== 'undefined' &&
  typeof window.speechSynthesis !== 'undefined' &&
  typeof window.SpeechSynthesisUtterance !== 'undefined';

/**
 * Stop whatever is being said.
 */
export const cancelSpeech = () => {
  if (!canSpeak()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // A browser that refuses to stop talking is not worth an error.
  }
};

/**
 * The voice for the language the reader picked.
 */
const voiceFor = (language) => {
  if (!canSpeak()) return null;
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;
    const wanted = String(language || 'id').toLowerCase();
    return (
      voices.find((v) => String(v.lang || '').toLowerCase() === wanted) ||
      voices.find((v) => String(v.lang || '').toLowerCase().startsWith(wanted)) ||
      null
    );
  } catch {
    return null;
  }
};

/**
 * Say something.
 *
 * Returns whether it was actually said. The caller does not have to
 * care: the words are on the screen either way, and the voice is a
 * bonus on top of them.
 */
export const speak = (text, { language = 'id', rate = 1.02, pitch = 1.12 } = {}) => {
  const words = String(text || '').trim();
  if (!words || muted || !canSpeak()) return false;

  try {
    // Anything said before is stopped, so two answers do not talk
    // over each other.
    window.speechSynthesis.cancel();

    const utterance = new window.SpeechSynthesisUtterance(words);
    utterance.lang = language === 'ja' ? 'ja-JP' : language === 'en' ? 'en-US' : 'id-ID';
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = 1;

    const voice = voiceFor(language);
    if (voice) utterance.voice = voice;

    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
};

/**
 * The number of rupiah, said the way a person says it.
 */
export const speakableAmount = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return '';
  return `Rp${Math.round(value).toLocaleString('id-ID')}`;
};

/**
 * The sentence the companion says when a reading is ready.
 *
 * "Oke! 2 Kopi Jago vanila total Rp30.000 di Kemayoran sudah dicatat!"
 */
export const summaryFor = (reading, { saved = false } = {}) => {
  if (!reading) return '';

  const parts = [];
  const amount = Number(reading.total_amount ?? reading.amount ?? 0);
  const lines = Array.isArray(reading.items) ? reading.items : [];

  if (lines.length === 1) {
    const line = lines[0];
    const count = Number(line.quantity ?? 1) || 1;
    const name = line.variant_or_note
      ? `${line.name} ${line.variant_or_note}`
      : line.name || '';
    parts.push(`${count} ${name}`);
  } else if (lines.length > 1) {
    const names = lines
      .map((line) => {
        const count = Number(line.quantity ?? 1) || 1;
        return `${count} ${line.name || ''}`.trim();
      })
      .filter(Boolean);
    if (names.length) parts.push(names.join(' dan '));
  } else if (reading.merchant) {
    parts.push(reading.merchant);
  }

  if (amount > 0) parts.push(`total ${speakableAmount(amount)}`);
  if (reading.location) parts.push(`di ${reading.location}`);

  if (!parts.length) return '';

  const head = saved ? 'Tersimpan!' : 'Oke!';
  const tail = saved ? 'sudah dicatat!' : 'sudah dicatat!';
  return `${head} ${parts.join(' ')} ${tail}`;
};

export default {
  canSpeak,
  cancelSpeech,
  isMuted,
  setMuted,
  speak,
  speakableAmount,
  summaryFor,
};
