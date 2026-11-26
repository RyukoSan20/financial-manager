/**
 * The reader's picture.
 *
 * The application has four pictures of its own - a sun, a sky, a rose
 * and the default - and they are drawn by us, in our own style, and
 * they always work.
 *
 * But a reader who signed in with Google kept seeing their Google
 * photo: on their profile, in the sidebar, in the header. The
 * picture came from a server we do not control, over a connection we
 * do not own, and it was a picture of a person rather than a picture
 * of a reader.
 *
 * So the Google photo is ignored. Every reader has one of our
 * pictures, chosen by them, and the picture is the same everywhere.
 *
 * The only thing that decides it is the reader's own choice. If they
 * have chosen one of ours, that is the one. If they have not - or if
 * what they have is a photo from an email provider - they get the
 * default, and the settings page is where they choose another.
 */

/**
 * The pictures we have.
 */
export const BUILT_IN_AVATARS = [
  { key: 'avatar-default', name: 'Default' },
  { key: 'avatar-sun', name: 'Sun' },
  { key: 'avatar-sky', name: 'Sky' },
  { key: 'avatar-rose', name: 'Rose' },
  // The Petit Chibi Guild. These are ours too, so a reader wearing
  // one must not be treated as having a foreign picture and quietly
  // given the default back.
  { key: 'avatar-petit-mone', name: 'Mone' },
  { key: 'avatar-petit-kaneru', name: 'Kaneru' },
  { key: 'avatar-petit-kogane', name: 'Kogane' },
  { key: 'avatar-petit-zenimaru', name: 'Zenimaru' },
  { key: 'avatar-petit-minori', name: 'Minori' },
  { key: 'avatar-petit-koneko', name: 'Koneko' },
];

/**
 * Where they live.
 */
const BRAND_BASE = '/assets/generated/brand/';

/**
 * The default.
 */
export const DEFAULT_AVATAR_URL = `${BRAND_BASE}avatar-default.svg`;

/**
 * The hosts whose pictures we do not show.
 *
 * A picture from one of these is a picture of the reader's email
 * account, not a picture they chose for this application. It is
 * ignored, and the reader gets one of ours instead.
 */
const EXTERNAL_HOSTS = [
  'googleusercontent.com',
  'gravatar.com',
  'gstatic.com',
  'google.com',
  'googleapis.com',
];

/**
 * Is this one of our pictures?
 *
 * The reader may have stored the whole path, or just the name of the
 * file. Both are answered.
 */
export function isBuiltInAvatar(value) {
  if (!value) return false;
  const text = String(value).trim().toLowerCase();
  if (!text) return false;

  return BUILT_IN_AVATARS.some(
    (avatar) =>
      text === avatar.key ||
      text === `${avatar.key}.svg` ||
      text.endsWith(`/${avatar.key}.svg`) ||
      text.endsWith(`/${avatar.key}`)
  );
}

/**
 * Is this a picture from an email provider?
 */
export function isExternalAvatar(value) {
  if (!value) return false;
  const text = String(value).trim().toLowerCase();
  if (!text) return false;
  if (isBuiltInAvatar(text)) return false;
  return EXTERNAL_HOSTS.some((host) => text.includes(host));
}

/**
 * The picture of a reader.
 *
 * Returns the full path of one of our pictures, always. It is never
 * empty, so an `<img>` never has nothing to show and never shows a
 * broken picture.
 */
export function getUserAvatarUrl(user) {
  // The reader may be the user object, or something that holds one.
  const candidate =
    user?.avatar_url ||
    user?.avatarUrl ||
    user?.profile?.avatar_url ||
    user?.user?.avatar_url ||
    null;

  if (!candidate) return DEFAULT_AVATAR_URL;

  const text = String(candidate).trim();
  if (!text) return DEFAULT_AVATAR_URL;

  // One of ours. Use it.
  if (isBuiltInAvatar(text)) {
    // The reader may have stored the whole path or just the name.
    // The path is what the picture needs.
    if (text.startsWith('/') || text.startsWith('http')) return text;
    return `${BRAND_BASE}${text.endsWith('.svg') ? text : `${text}.svg`}`;
  }

  // A picture from an email provider. It is not the picture of a
  // reader, so it is not shown.
  if (isExternalAvatar(text)) return DEFAULT_AVATAR_URL;

  // A picture from somewhere else - one the reader uploaded, most
  // likely. It is theirs, so it is shown.
  return text;
}

/**
 * The pictures a reader can choose from, with their full paths.
 */
export function builtInAvatarOptions() {
  return BUILT_IN_AVATARS.map((avatar) => ({
    key: avatar.key,
    name: avatar.name,
    url: `${BRAND_BASE}${avatar.key}.svg`,
  }));
}

export default getUserAvatarUrl;
