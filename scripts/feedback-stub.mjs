#!/usr/bin/env node
// Local stand-in for the feedback endpoint (`just feedback-dev`). It runs the real Lambda handler
// (infra/feedback/src/handler.ts: same validation, size limit and bot checks) but, instead of
// publishing to SNS, prints the email it would have sent. No AWS, nothing stored or sent.
// The dev server proxies /api/feedback here when FEEDBACK_STUB_URL is set (apps/web/astro.config.mjs).
import { createServer } from 'node:http';
import { createHandler } from '../infra/feedback/src/handler.ts';

const port = Number(process.env.FEEDBACK_STUB_PORT ?? 4322);
const handler = createHandler({
  send: async (delivery) => {
    console.log(
      `\n--- feedback (would go to route "${delivery.route}") ---\nSubject: ${delivery.subject}\n${delivery.message}\n`,
    );
  },
});

createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const result = await handler({
    headers: req.headers,
    body: Buffer.concat(chunks).toString('utf8'),
    isBase64Encoded: false,
    requestContext: { http: { method: req.method } },
  });
  res.writeHead(result.statusCode, result.headers).end(result.body);
}).listen(port, '127.0.0.1', () =>
  console.log(`Feedback stub listening on http://127.0.0.1:${port}`),
);
