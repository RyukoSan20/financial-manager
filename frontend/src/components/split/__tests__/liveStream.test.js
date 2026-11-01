/**
 * The live feed, checked without a browser.
 *
 * The three things that can go wrong here are all about the shape
 * of the stream: the address of the feed, the headers that go with
 * it, and the way a piece of a stream is read back.
 */

import assert from 'node:assert/strict';
import {
  eventMeansChange,
  liveFeedHeaders,
  liveFeedUrl,
  parseStreamChunk,
} from '../liveStream.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (err) {
    failed += 1;
    console.log(`FAIL  ${name}`);
    console.log(`    ${err.message}`);
  }
}

test('the host watches the group feed', () => {
  const url = liveFeedUrl('/api/split', 'host', 12);
  assert.equal(url, '/api/split/groups/12/live');
});

test('the guest watches the invitation feed', () => {
  const url = liveFeedUrl('/api/split', 'guest', 'ABC123');
  assert.equal(url, '/api/split/claim/ABC123/live');
});

test('a trailing slash is not doubled', () => {
  const url = liveFeedUrl('/api/split/', 'host', 3);
  assert.equal(url, '/api/split/groups/3/live');
});

test('an empty address gives an empty address', () => {
  assert.equal(liveFeedUrl('', 'host', 1), '');
});

test('the host token goes in the authorization header', () => {
  const headers = liveFeedHeaders('host', 'abc123');
  assert.equal(headers.Authorization, 'Bearer abc123');
});

test('the guest token goes in the guest header', () => {
  const headers = liveFeedHeaders('guest', 'guest-token');
  assert.equal(headers['X-Split-Guest-Token'], 'guest-token');
  assert.equal(headers.Authorization, undefined);
});

test('no token means no header', () => {
  const headers = liveFeedHeaders('host', null);
  assert.equal(headers.Authorization, undefined);
  assert.equal(headers.Accept, 'text/event-stream');
});

test('one event is read back', () => {
  const { events, rest } = parseStreamChunk('', '{"type":"claim"}\n');
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'claim');
  assert.equal(rest, '');
});

test('several events in one piece are all read', () => {
  const { events } = parseStreamChunk('', '{"type":"claim"}\n{"type":"release"}\n');
  assert.equal(events.length, 2);
  assert.equal(events[1].type, 'release');
});

test('half an event is kept for the next time', () => {
  const first = parseStreamChunk('', '{"type":"cla');
  assert.equal(first.events.length, 0);
  assert.equal(first.rest, '{"type":"cla');

  const second = parseStreamChunk(first.rest, 'im"}\n');
  assert.equal(second.events.length, 1);
  assert.equal(second.events[0].type, 'claim');
});

test('a line that is not JSON does not stop the stream', () => {
  const { events } = parseStreamChunk('', 'not json\n{"type":"claim"}\n');
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'claim');
});

test('an empty piece changes nothing', () => {
  const { events, rest } = parseStreamChunk('abc', '');
  assert.equal(events.length, 0);
  assert.equal(rest, 'abc');
});

test('a claim means the screen should ask again', () => {
  assert.equal(eventMeansChange({ type: 'claim' }), true);
  assert.equal(eventMeansChange({ type: 'release' }), true);
});

test('a ready event does not mean anything changed', () => {
  assert.equal(eventMeansChange({ type: 'ready' }), false);
  assert.equal(eventMeansChange(null), false);
});

console.log('');
console.log(`liveStream: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
