// Real fetch against loopback only: cover the gap between headers and body.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import vm from 'node:vm';
import { after, test } from 'node:test';

const source = await readFile(new URL('../orbit-backend.js', import.meta.url), 'utf8');
let serve;
const server = createServer((request, response) => {
  request.resume();
  serve(request, response);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const backend = `http://127.0.0.1:${server.address().port}`;
after(() => new Promise(resolve => {
  server.close(resolve);
  server.closeAllConnections();
}));

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function fixture(timeout = 1000) {
  const receivedHeaders = deferred();
  const timers = new Set();
  const listeners = new Set();
  const caller = new AbortController();
  const add = caller.signal.addEventListener.bind(caller.signal);
  const remove = caller.signal.removeEventListener.bind(caller.signal);
  caller.signal.addEventListener = (type, listener, options) => {
    if (type === 'abort') listeners.add(listener);
    return add(type, listener, options);
  };
  caller.signal.removeEventListener = (type, listener, options) => {
    if (type === 'abort') listeners.delete(listener);
    return remove(type, listener, options);
  };
  let wrapped, originalResponse, requestSignal;
  const window = {
    ORBIT_CONFIG: { url: backend, publishableKey: 'test-only', requestTimeoutMs: timeout },
    supabase: { createClient(_url, _key, options) { wrapped = options.global.fetch; return {}; } },
  };
  vm.runInNewContext(source, {
    window, location: { href: 'https://orbit.example/' }, URL, AbortController, DOMException,
    async fetch(input, options) {
      // Never allow this regression test to contact the production backend.
      assert.equal(new URL(input).origin, backend);
      requestSignal = options.signal;
      originalResponse = await fetch(input, options);
      receivedHeaders.resolve();
      return originalResponse;
    },
    setTimeout(callback, delay) {
      const id = setTimeout(() => { timers.delete(id); callback(); }, delay);
      timers.add(id);
      return id;
    },
    clearTimeout(id) { timers.delete(id); clearTimeout(id); },
  });
  window.createOrbitBackend();
  return {
    window, caller,
    headers: receivedHeaders.promise,
    request(path = '/auth/v1/token', body = '{}', options = {}) {
      return wrapped(backend + path, {
        method: 'POST', body, signal: caller.signal, ...options,
      });
    },
    get signal() { return requestSignal; },
    get response() { return originalResponse; },
    clean() {
      assert.equal(timers.size, 0, 'the deadline is removed after settlement');
      assert.equal(listeners.size, 0, 'the caller abort listener is removed after settlement');
    },
  };
}

function stalledBody() {
  const closed = deferred();
  let response;
  serve = (_request, res) => {
    response = res;
    res.on('close', closed.resolve);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write('{"saved":');
  };
  return { closed: closed.promise, finish() { response.end('true}'); } };
}

test('a stalled response body times out after headers and aborts its network request', { timeout: 3000 }, async () => {
  const body = stalledBody(), f = fixture(100);
  const request = f.request();
  const rejected = assert.rejects(request);
  await f.headers;
  await rejected;
  assert.equal(f.signal.aborted, true);
  await body.closed;
  f.clean();
});

test('caller cancellation stays connected during body consumption and cleans up', { timeout: 3000 }, async () => {
  const body = stalledBody(), f = fixture();
  const rejected = assert.rejects(f.request());
  await f.headers;
  f.caller.abort();
  await rejected;
  assert.equal(f.signal.aborted, true);
  await body.closed;
  f.clean();
});

test('cancelling passive anonymous auth aborts a body already arriving', { timeout: 3000 }, async () => {
  const body = stalledBody(), f = fixture();
  const rejected = assert.rejects(f.request('/auth/v1/signup'));
  await f.headers;
  f.window.cancelOrbitAnonymousAuth();
  await rejected;
  assert.equal(f.signal.aborted, true);
  await body.closed;
  f.clean();
});

test('anonymous cancellation does not cancel explicit credential signup', { timeout: 3000 }, async () => {
  const body = stalledBody(), f = fixture();
  const request = f.request('/auth/v1/signup', JSON.stringify({ email: 'test@example.test', password: 'test-only' }));
  await f.headers;
  f.window.cancelOrbitAnonymousAuth();
  assert.equal(f.signal.aborted, false);
  body.finish();
  assert.deepEqual(await (await request).json(), { saved: true });
  f.clean();
});

test('successful bodies retain the original Response and unread JSON', { timeout: 3000 }, async () => {
  serve = (_request, response) => {
    response.writeHead(201, { 'Content-Type': 'application/json', 'X-Record': 'created' });
    response.end('{"id":"created-once"}');
  };
  const f = fixture(), response = await f.request('/rest/v1/rpc/create_board_post');
  assert.equal(response, f.response);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('X-Record'), 'created');
  assert.equal(response.url, backend + '/rest/v1/rpc/create_board_post');
  assert.equal(response.bodyUsed, false);
  assert.deepEqual(await response.json(), { id: 'created-once' });
  f.clean();
  f.caller.abort();
  assert.equal(f.signal.aborted, false, 'a completed request is detached from later caller aborts');
});

test('empty successful writes remain successful, and error bodies reach the SDK unchanged', { timeout: 3000 }, async () => {
  for (const [status, text] of [[204, ''], [400, '{"message":"invalid input"}'], [500, 'upstream unavailable']]) {
    serve = (_request, response) => { response.writeHead(status); response.end(text); };
    const f = fixture(), response = await f.request('/rest/v1/posts');
    assert.equal(response, f.response);
    assert.equal(response.status, status);
    assert.equal(response.ok, status < 400);
    assert.equal(await response.text(), text);
    f.clean();
  }
});

test('a completed anonymous request is removed from the cancellation registry', { timeout: 3000 }, async () => {
  serve = (_request, response) => { response.writeHead(200); response.end('{"user":{"id":"anon"}}'); };
  const f = fixture(), response = await f.request('/auth/v1/signup');
  assert.deepEqual(await response.json(), { user: { id: 'anon' } });
  f.window.cancelOrbitAnonymousAuth();
  assert.equal(f.signal.aborted, false);
  f.clean();
});

test('failure before headers also cleans up the timeout and caller listener', { timeout: 3000 }, async () => {
  serve = request => { request.socket.destroy(); };
  const f = fixture();
  await assert.rejects(f.request());
  f.clean();
});
