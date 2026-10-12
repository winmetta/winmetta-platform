// CloudFront viewer-request function (runtime cloudfront-js-2.0).
//
// The site is built with trailingSlash: 'always', and a private S3 bucket behind
// origin access control does not serve directory indexes, so:
//   /              -> /index.html
//   /en/about/     -> /en/about/index.html
//   /en/about      -> 301 redirect to /en/about/ (query string kept)
//   /robots.txt, /_astro/app.js (last segment has a dot) -> unchanged
// Keep this file free of imports: CloudFront runs it as-is, and the tests in
// viewer-request.test.js load it as plain text.
// CloudFront calls handler by name; nothing in this file does.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri.charAt(uri.length - 1) === '/') {
    request.uri = uri + 'index.html';
    return request;
  }

  var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);
  if (lastSegment.indexOf('.') === -1) {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: {
        location: { value: uri + '/' + queryString(request.querystring) },
      },
    };
  }

  return request;
}

function queryString(query) {
  var parts = [];
  for (var name in query) {
    var entry = query[name];
    if (entry.multiValue) {
      for (var i = 0; i < entry.multiValue.length; i++) {
        parts.push(name + '=' + entry.multiValue[i].value);
      }
    } else {
      parts.push(entry.value === '' ? name : name + '=' + entry.value);
    }
  }
  return parts.length ? '?' + parts.join('&') : '';
}
