/**
 * The live feed, from the browser's side.
 *
 * The server can push a change to the browser over a connection it
 * holds open. The browser's own tool for this is usually the
 * EventSource, but the EventSource cannot send an authorization
 * header, and a token put into the address of a stream ends up in
 * the server's access log, which is not a place a token belongs.
 *
 * So the connection is opened with a plain fetch and the body is
 * read as it arrives. The authorization header is sent the usual
 * way, and the token stays out of the address.
 *
 * Two things are kept here, apart from the React part, so that they
 * can be checked without a browser:
 *
 * - how the address of the feed is written;
 * - how a piece of the stream is turned back into what it was.
 *
 * The connection is not trusted to stay open. A phone in a
 * restaurant is on a network that drops, and a dropped connection
 * looks exactly like a screen that has stopped updating. So the
 * stream is an improvement on asking again and again, and the
 * asking again and again stays as the safety net underneath it.
 */

/**
 * The address of the live feed.
 *
 * Two kinds of reader watch a board:
 *
 * - the host, who is signed in. Their token goes in the usual place,
 *   the authorization header.
 * - a guest, who has no account. Their token is the one that was
 *   given to them when they joined, and it goes in the header the
 *   guest routes read.
 *
 * `kind` says which one this is.
 */
export function liveFeedUrl(baseUrl, kind, id) {
  if (!baseUrl) return '';

  const trimmed = String(baseUrl).replace(/\/+$/, '');

  if (kind === 'guest') {
    // The guest watches by the invitation code, because that is
    // what they were given.
    return `${trimmed}/claim/${encodeURIComponent(id)}/live`;
  }

  return `${trimmed}/groups/${encodeURIComponent(id)}/live`;
}

/**
 * The headers that go with the connection.
 *
 * The host's token is a bearer token and goes where it always goes.
 * The guest's token goes in the header the guest routes read, so
 * that the server can tell which member of the group is watching.
 */
export function liveFeedHeaders(kind, token) {
  const headers = { Accept: 'text/event-stream' };

  if (!token) return headers;

  if (kind === 'guest') {
    headers['X-Split-Guest-Token'] = token;
  } else {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

/**
 * One piece of the stream, read back into what it was.
 *
 * The server writes one line of JSON per event, with a newline at
 * the end of each. A piece of the stream may hold half an event, or
 * several events, depending on how the network chopped it up, so
 * the lines are separated and anything after the last newline is
 * kept for the next time round.
 */
export function parseStreamChunk(buffer, chunk) {
  const text = (buffer || '') + (chunk || '');
  const lines = text.split('\n');

  // The last piece is either empty, or the beginning of an event
  // that has not arrived in full yet.
  const rest = lines.pop() ?? '';

  const events = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch (err) {
      // A line that is not JSON is not worth stopping for. The
      // stream carries on.
    }
  }

  return { events, rest };
}

/**
 * Whether an event is one that should make the screen ask again.
 *
 * The server also sends a "ready" event when the connection opens.
 * That one does not mean anything changed, but asking once at the
 * start is right anyway.
 */
export function eventMeansChange(event) {
  if (!event || typeof event !== 'object') return false;
  return event.type === 'claim' || event.type === 'release';
}

export default liveFeedUrl;
