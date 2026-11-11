import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../src/handler.ts';
import { feedbackTypes } from '../../../apps/web/src/lib/feedback-schema.ts';

const valid = {
  ctx: 'post',
  type: 'typo',
  message: 'Please check this word.',
  email: '',
  page: '/en/dhamma-posts/a-post/',
  item: 'a-post',
  lang: 'en',
  locale: 'en',
  hp: '',
  t: 4000,
};
const event = (report = valid) => ({
  requestContext: { http: { method: 'POST' } },
  body: JSON.stringify(report),
});
function setup(send) {
  const deliveries = [];
  const handler = createHandler({
    send:
      send ??
      (async (delivery) => {
        deliveries.push(delivery);
      }),
  });
  return { handler, deliveries };
}

test('every allowed context/type is accepted and routes are chosen on the server', async () => {
  const { handler, deliveries } = setup();
  for (const [ctx, types] of Object.entries(feedbackTypes)) {
    for (const type of types) {
      const r = await handler(
        event({
          ...valid,
          ctx,
          type,
          lang: '',
          route: 'attacker',
          ip: 'do not forward',
          unknown: 'do not forward',
        }),
      );
      assert.equal(r.statusCode, 204);
      const d = deliveries.at(-1);
      const route =
        ctx === 'class'
          ? 'schedule'
          : ctx === 'post' || (ctx === 'library' && type === 'title')
            ? 'content'
            : 'site';
      assert.equal(d.route, route);
      assert.ok(d.subject.length < 100);
      assert.match(d.subject, /^[\x20-\x7e]+$/);
      assert.ok(!d.message.includes('do not forward'));
      assert.ok(!d.message.includes('attacker'));
    }
  }
});

test('rejects malformed, oversized and unsupported requests without delivering', async () => {
  const { handler, deliveries } = setup();
  for (const body of ['', '{', 'null', '[]', '42']) {
    assert.equal((await handler({ ...event(), body })).statusCode, 400);
  }
  assert.equal(
    (await handler({ ...event(), body: 'က'.repeat(3000) })).statusCode,
    413,
  );
  const body = Buffer.from(JSON.stringify(valid)).toString('base64');
  assert.equal(
    (await handler({ ...event(), body, isBase64Encoded: true })).statusCode,
    204,
  );
  assert.equal(deliveries.length, 1);
  assert.equal(
    (
      await handler({
        ...event(),
        body: Buffer.alloc(8193).toString('base64'),
        isBase64Encoded: true,
      })
    ).statusCode,
    413,
  );
  assert.equal(
    (await handler({ ...event(), requestContext: { http: { method: 'GET' } } }))
      .statusCode,
    405,
  );
});

test('validates fields, context/type pairing and canonical paths', async () => {
  const { handler, deliveries } = setup();
  const patches = [
    { ctx: '__proto__' },
    { type: 'website' },
    { message: ' ' },
    { message: 'a'.repeat(2001) },
    { message: 'x\0y' },
    { email: 'bad\r\naddress' },
    { email: 1 },
    { item: '../x' },
    { item: 'x'.repeat(81) },
    { lang: 'zh' },
    { ctx: 'general', type: 'other', lang: 'my' },
    { locale: 'fr' },
    { page: 'https://example.org/' },
    { page: '//example.org/' },
    { page: '/en/dhamma-library/?q=private' },
    { page: '/en/about/#private' },
    { page: '/en/../my/' },
    { page: '/en/' + 'x'.repeat(201) + '/' },
    { t: -1 },
    { t: '4000' },
    { hp: null },
  ];
  for (const patch of patches)
    assert.equal(
      (await handler(event({ ...valid, ...patch }))).statusCode,
      400,
      JSON.stringify(patch),
    );
  assert.equal(deliveries.length, 0);
});

test('silently drops bot submissions and never publishes or logs them', async () => {
  const { handler, deliveries } = setup();
  for (const patch of [{ hp: 'filled' }, { t: 2999 }])
    assert.equal(
      (await handler(event({ ...valid, ...patch }))).statusCode,
      204,
    );
  assert.equal(deliveries.length, 0);
});

test('delivery failure gives a retryable response without logging personal data', async (t) => {
  const output = [];
  for (const method of ['log', 'info', 'warn', 'error'])
    t.mock.method(console, method, (...args) => output.push(args));
  const { handler } = setup(async () => {
    throw new Error('sensitive upstream body');
  });
  const r = await handler(
    event({
      ...valid,
      message: 'A private draft',
      email: 'reporter@example.org',
    }),
  );
  assert.deepEqual(r, {
    statusCode: 503,
    headers: { 'cache-control': 'no-store' },
    body: '',
  });
  assert.deepEqual(output, []);
});
