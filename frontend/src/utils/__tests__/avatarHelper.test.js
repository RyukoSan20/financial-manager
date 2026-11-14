/**
 * The reader's picture is one of ours.
 *
 * A reader who signed in with Google kept seeing their Google photo:
 * on their profile, in the sidebar, in the header. It was a picture
 * of a person rather than a picture of a reader, from a server we do
 * not control, over a connection we do not own.
 *
 * The application has four drawn pictures of its own, and the reader
 * chooses one of them. So the picture that is shown is always one of
 * ours - and the Google one is ignored wherever it is stored.
 */

import assert from 'node:assert/strict';

import {
  getUserAvatarUrl,
  isBuiltInAvatar,
  isExternalAvatar,
  builtInAvatarOptions,
  DEFAULT_AVATAR_URL,
} from '../avatarHelper.js';

const check = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    console.error(`  ${err.message}`);
    process.exitCode = 1;
  }
};

// ---------------------------------------------------------------------------
// The Google photo
// ---------------------------------------------------------------------------

check('a Google photo is not one of ours', () => {
  assert.ok(
    isExternalAvatar('https://lh3.googleusercontent.com/a/ACg8ocabc123'),
    'the Google photo is not recognised'
  );
  assert.ok(
    !isBuiltInAvatar('https://lh3.googleusercontent.com/a/ACg8ocabc123'),
    'the Google photo was taken for one of ours'
  );
});

check('a Gravatar is not one of ours either', () => {
  assert.ok(
    isExternalAvatar('https://www.gravatar.com/avatar/abc123'),
    'the Gravatar is not recognised'
  );
});

check('a Google photo is replaced by the default', () => {
  const url = getUserAvatarUrl({
    avatar_url: 'https://lh3.googleusercontent.com/a/ACg8ocabc123',
  });
  assert.equal(url, DEFAULT_AVATAR_URL, 'the Google photo was shown');
  assert.ok(
    !url.includes('googleusercontent'),
    'the Google photo is still in the answer'
  );
});

check('no picture at all is the default', () => {
  assert.equal(getUserAvatarUrl(null), DEFAULT_AVATAR_URL);
  assert.equal(getUserAvatarUrl({}), DEFAULT_AVATAR_URL);
  assert.equal(getUserAvatarUrl({ avatar_url: '' }), DEFAULT_AVATAR_URL);
  assert.equal(getUserAvatarUrl({ avatar_url: null }), DEFAULT_AVATAR_URL);
});

check('a picture of ours is kept', () => {
  const url = getUserAvatarUrl({ avatar_url: 'avatar-sun' });
  assert.ok(url.includes('avatar-sun'), 'the chosen picture was lost');
  assert.ok(url.endsWith('.svg'), 'the picture is not the drawing');
});

check('a picture of ours is kept when it is a full path', () => {
  const path = '/assets/generated/brand/avatar-rose.svg';
  assert.equal(getUserAvatarUrl({ avatar_url: path }), path);
});

check('every one of the four is recognised', () => {
  for (const option of builtInAvatarOptions()) {
    assert.ok(
      isBuiltInAvatar(option.key),
      `${option.key} is not recognised as one of ours`
    );
    assert.ok(
      isBuiltInAvatar(option.url),
      `${option.url} is not recognised as one of ours`
    );
  }
});

check('there are ten to choose from: four plain, six of the guild', () => {
  // The four plain faces, plus the six companions of the Petit Chibi
  // Guild, which a reader can wear as their own face.
  const options = builtInAvatarOptions();
  assert.equal(options.length, 10, `expected ten pictures, found ${options.length}`);
  for (const option of options) {
    assert.ok(option.url.startsWith('/assets/generated/brand/'), option.url);
    assert.ok(option.url.endsWith('.svg'), option.url);
  }
  // All six of the guild are really offered, by name.
  for (const persona of ['mone', 'kaneru', 'kogane', 'zenimaru', 'minori', 'koneko']) {
    assert.ok(
      options.some((option) => option.url.includes(`avatar-petit-${persona}`)),
      `${persona} is not offered`
    );
  }
});

check('a picture from somewhere else is the reader\'s own, and is kept', () => {
  // Somebody who uploaded a picture of themselves keeps it. Only the
  // email providers are refused.
  const url = getUserAvatarUrl({ avatar_url: 'https://example.test/me.png' });
  assert.equal(url, 'https://example.test/me.png');
});

// ---------------------------------------------------------------------------
// The places it is used
// ---------------------------------------------------------------------------

check('the reader is never left without a picture', () => {
  // Whatever is stored, the answer is never empty - an empty `src`
  // is a broken picture.
  const cases = [
    null,
    {},
    { avatar_url: '' },
    { avatar_url: 'https://lh3.googleusercontent.com/a/abc' },
    { avatar_url: 'avatar-default' },
  ];
  for (const user of cases) {
    const url = getUserAvatarUrl(user);
    assert.ok(url, `no picture for ${JSON.stringify(user)}`);
    assert.ok(url.length > 10, `a broken picture for ${JSON.stringify(user)}`);
  }
});
