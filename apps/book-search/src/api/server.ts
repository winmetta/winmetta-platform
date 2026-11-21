import { createServer, type Server } from 'node:http';
import { handleRequest, type ApiContext } from './handler.ts';

/**
 * The local stand-in for the AWS backend: the same handler behind `node:http`. It sends no CORS
 * headers, and logs the method, path, status and time of each request, never the query.
 */
export function createApiServer(
  context: ApiContext,
  log: (line: string) => void = () => {},
): Server {
  return createServer((req, res) => {
    const started = Date.now();
    const headers: Record<string, string | undefined> = {};
    for (const [name, value] of Object.entries(req.headers))
      headers[name] = Array.isArray(value) ? value.join(',') : value;
    const response = handleRequest(
      { method: req.method ?? 'GET', url: req.url ?? '/', headers },
      context,
    );
    res.writeHead(response.status, response.headers);
    res.end(JSON.stringify(response.body));
    const path = (req.url ?? '/').split('?')[0];
    log(`${req.method} ${path} ${response.status} ${Date.now() - started}ms`);
  });
}

/** Listens on the loopback address only; port 0 picks a free port. */
export function listen(server: Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : port);
    });
  });
}
