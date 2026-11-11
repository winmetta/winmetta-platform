import {
  feedbackRoute,
  parseFeedback,
  type FeedbackReport,
} from '../../../apps/web/src/lib/feedback-schema.ts';

interface UrlEvent {
  headers?: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
  requestContext?: { http?: { method?: string } };
}
export interface Delivery {
  subject: string;
  message: string;
  route: string;
  ctx: string;
}
interface Options {
  send: (delivery: Delivery) => Promise<void>;
}
const response = (statusCode: number) => ({
  statusCode,
  headers: { 'cache-control': 'no-store' },
  body: '',
});
export function deliveryFor(r: FeedbackReport): Delivery {
  return {
    subject: `[Win Metta] ${r.ctx} / ${r.type}`.slice(0, 99),
    message: [
      `Context: ${r.ctx}`,
      `Type: ${r.type}`,
      `Page: ${r.page}`,
      `Item: ${r.item}`,
      `Language: ${r.lang}`,
      `Locale: ${r.locale}`,
      '',
      'Message:',
      r.message,
      '',
      `Reply address: ${r.email || '(not provided)'}`,
    ].join('\n'),
    route: feedbackRoute(r.ctx, r.type),
    ctx: r.ctx,
  };
}
/** No logging: errors, event headers and bodies can contain personal data or secrets. */
export function createHandler(options: Options) {
  return async (event: UrlEvent) => {
    if (event.requestContext?.http?.method !== 'POST') return response(405);
    const raw = event.body ?? '';
    // Bound before decoding too, so an oversized base64 input cannot allocate arbitrarily.
    if (Buffer.byteLength(raw) > (event.isBase64Encoded ? 10924 : 8192))
      return response(413);
    const body = event.isBase64Encoded
      ? Buffer.from(raw, 'base64').toString('utf8')
      : raw;
    if (Buffer.byteLength(body) > 8192) return response(413);
    let value: unknown;
    try {
      value = JSON.parse(body);
    } catch {
      return response(400);
    }
    const report = parseFeedback(value);
    if (!report) return response(400);
    if (report.hp !== '' || report.t < 3000) return response(204);
    try {
      await options.send(deliveryFor(report));
      return response(204);
    } catch {
      return response(503);
    }
  };
}
