// Receives only Caddy's collection POSTs. Umami still owns event validation and session IDs.
import { createServer } from 'node:http';
import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';

export const ipProperty = 'visitor_ip';
const maxBodyBytes = 256 * 1024;
const maxRecordedSessions = 4096;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

async function readJson(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    length += chunk.length;
    if (length > maxBodyBytes) {
      request.resume();
      return { error: 413 };
    }
    chunks.push(chunk);
  }
  try {
    return { body: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
  } catch {
    return { error: 400 };
  }
}

function sendResult(response, status, headers, body) {
  const forwardedHeaders = new Headers(headers);
  for (const name of [
    'connection',
    'content-encoding',
    'content-length',
    'transfer-encoding',
  ]) {
    forwardedHeaders.delete(name);
  }
  response.writeHead(status, Object.fromEntries(forwardedHeaders));
  response.end(body);
}

function utcDay(time) {
  return Math.floor(time / 86_400_000);
}

function isCollectableEvent(body, origin, siteOrigin) {
  const payload = body?.payload;
  return (
    Boolean(siteOrigin) &&
    origin === siteOrigin &&
    body?.type === 'event' &&
    uuid.test(payload?.website ?? '') &&
    !payload.id &&
    !payload.timestamp &&
    !payload.userAgent
  );
}

function prepareUpstream(body, requestHeaders) {
  const payload = body?.payload;
  // Reserve this property for Caddy's address. Public collection requests can send custom data.
  if (payload?.data && typeof payload.data === 'object') {
    delete payload.data[ipProperty];
  }
  const headers = new Headers({ 'content-type': 'application/json' });
  for (const name of ['origin', 'user-agent', 'x-umami-cache']) {
    if (typeof requestHeaders[name] === 'string') {
      headers.set(name, requestHeaders[name]);
    }
  }
  const clientIp = requestHeaders['x-winmetta-client-ip'];
  const address =
    typeof clientIp === 'string' && isIP(clientIp) ? clientIp : undefined;
  if (address) {
    headers.set('x-forwarded-for', address);
    if (payload && typeof payload === 'object') payload.ip = address;
  }
  return { headers, address };
}

export function createCollector({
  upstream,
  siteOrigin,
  now = Date.now,
  reportFailure = () => {},
}) {
  // Cache only Umami's session ID, never the IP. A pending write also suppresses concurrent duplicates.
  const recorded = new Map();
  let recordedDay;

  async function recordIp({ session, payload, address, headers, started }) {
    const day = utcDay(started);
    if (
      day !== utcDay(now()) ||
      !uuid.test(session?.sessionId ?? '') ||
      typeof session.cache !== 'string'
    )
      return;
    if (recordedDay !== day) {
      recorded.clear();
      recordedDay = day;
    }
    const sessionId = session.sessionId;
    if (recorded.has(sessionId)) return;
    if (recorded.size >= maxRecordedSessions)
      recorded.delete(recorded.keys().next().value);
    recorded.set(sessionId, true);

    try {
      const identifyHeaders = new Headers(headers);
      identifyHeaders.set('x-umami-cache', session.cache);
      const result = await fetch(upstream, {
        method: 'POST',
        headers: identifyHeaders,
        signal: AbortSignal.timeout(4000),
        body: JSON.stringify({
          type: 'identify',
          payload: {
            website: payload.website,
            hostname: payload.hostname,
            language: payload.language,
            timestamp: Math.floor(started / 1000),
            ip: address,
            data: { [ipProperty]: address },
          },
        }),
      });
      const identity = await result.json();
      if (!result.ok || identity?.sessionId !== sessionId)
        throw new Error('Session property was not confirmed');
    } catch {
      recorded.delete(sessionId);
      reportFailure('Could not save the analytics session IP property');
    }
  }

  return createServer(async (request, response) => {
    if (
      request.method !== 'POST' ||
      request.url?.split('?', 1)[0] !== '/api/send'
    ) {
      response.writeHead(404).end();
      return;
    }
    if (request.headers.dnt === '1') {
      response.writeHead(204).end();
      return;
    }

    try {
      const started = now();
      const { body, error } = await readJson(request);
      if (error) {
        response.writeHead(error).end();
        return;
      }
      const { headers, address } = prepareUpstream(body, request.headers);
      const result = await fetch(upstream, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify(body),
      });
      const resultBody = await result.text();
      sendResult(response, result.status, result.headers, resultBody);
      if (
        result.ok &&
        address &&
        isCollectableEvent(body, request.headers.origin, siteOrigin)
      ) {
        let session;
        try {
          session = JSON.parse(resultBody);
        } catch {
          return;
        }
        await recordIp({
          session,
          payload: body.payload,
          address,
          headers,
          started,
        });
      }
    } catch {
      reportFailure('Could not forward an analytics collection request');
      if (!response.headersSent) response.writeHead(502).end();
    }
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  createCollector({
    upstream: 'http://analytics-umami:3000/api/send',
    siteOrigin: process.env.ANALYTICS_SITE_ORIGIN,
    reportFailure: (message) => console.error(message),
  }).listen(3001, '0.0.0.0');
}
