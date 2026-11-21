// CloudFront Function, viewer request, for /api/search and /api/search/*.
// The search is for pages of app.winmetta.org only: a request the browser marks cross-site
// is refused here, before the cache and the Lambda, and nothing but GET and HEAD gets through.
// The same rule is also in the Lambda (apps/book-search/src/api/handler.ts); this copy saves
// the invocation.
// CloudFront calls handler by name; nothing in this file does.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handler(event) {
  var request = event.request;
  var site = request.headers['sec-fetch-site'];
  if (site && site.value === 'cross-site') {
    return {
      statusCode: 403,
      statusDescription: 'Forbidden',
      headers: {
        'content-type': { value: 'application/json; charset=utf-8' },
        'cache-control': { value: 'no-store' },
      },
      body: '{"v":1,"error":{"code":"forbidden_origin"}}',
    };
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return {
      statusCode: 405,
      statusDescription: 'Method Not Allowed',
      headers: {
        'content-type': { value: 'application/json; charset=utf-8' },
        'cache-control': { value: 'no-store' },
      },
      body: '{"v":1,"error":{"code":"method_not_allowed"}}',
    };
  }
  return request;
}
