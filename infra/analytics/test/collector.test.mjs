import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { createCollector, ipProperty } from '../collector/server.mjs';

const siteOrigin = 'https://app.example.test';
const website = '00000000-0000-4000-8000-000000000000';
const session = { sessionId: website, cache: 'umami-signed-token' };
const address = '2001:db8::42';

async function listen(server, t) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}/api/send`;
}

async function setup(t, reply = () => session) {
  const calls = [];
  const upstream = await listen(
    createServer(async (request, response) => {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const call = {
        body: JSON.parse(Buffer.concat(chunks)),
        headers: request.headers,
      };
      calls.push(call);
      response.writeHead(200, {
        'content-type': 'application/json',
        'access-control-allow-origin': siteOrigin,
      });
      response.end(JSON.stringify(reply(call)));
    }),
    t,
  );
  const failures = [];
  const collector = await listen(
    createCollector({
      upstream,
      siteOrigin,
      reportFailure: (message) => failures.push(message),
      now: () => Date.parse('2026-11-19T12:00:00Z'),
    }),
    t,
  );
  const submit = (body, headers = {}) =>
    fetch(collector, {
      method: 'POST',
      headers: {
        origin: siteOrigin,
        'x-winmetta-client-ip': address,
        ...headers,
      },
      body: JSON.stringify(body),
    });
  return { calls, submit, failures };
}

const event = {
  type: 'event',
  payload: { website, hostname: 'app.example.test', url: '/en/' },
};

async function until(predicate) {
  for (let index = 0; index < 50; index++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail('Collector did not finish the upstream request');
}

test('attaches the server IP once to the returned session, without a distinct ID', async (t) => {
  const { calls, submit, failures } = await setup(t);
  const response = await submit(
    { ...event, payload: { ...event.payload, ip: '192.0.2.1' } },
    {
      'x-forwarded-for': '192.0.2.2',
    },
  );
  assert.equal(response.headers.get('access-control-allow-origin'), siteOrigin);
  assert.deepEqual(await response.json(), session);
  await until(() => calls.length >= 2);
  assert.equal(calls[0].body.payload.ip, address);
  assert.equal(calls[0].headers['x-forwarded-for'], address);
  assert.equal(calls[1].headers['x-umami-cache'], session.cache);
  assert.equal(calls[1].body.type, 'identify');
  assert.deepEqual(calls[1].body.payload.data, { [ipProperty]: address });
  assert.equal(calls[1].body.payload.id, undefined);
  await submit(event);
  assert.deepEqual(
    calls.map(({ body }) => body.type),
    ['event', 'identify', 'event'],
  );
  assert.deepEqual(failures, []);
});

test('does not store public IP properties, bot traffic, or Do Not Track requests', async (t) => {
  const { calls, submit, failures } = await setup(t, () => ({ beep: 'boop' }));
  const optedOut = await submit(event, { dnt: '1' });
  assert.equal(optedOut.status, 204);
  const supplied = {
    type: 'identify',
    payload: { website, data: { [ipProperty]: '192.0.2.1', mode: 'test' } },
  };
  await submit(supplied);
  await submit(event);
  assert.deepEqual(
    calls.map(({ body }) => body.type),
    ['identify', 'event'],
  );
  assert.deepEqual(calls[0].body.payload.data, { mode: 'test' });
  assert.deepEqual(failures, []);
});
