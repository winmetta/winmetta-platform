import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { createHandler } from './handler.ts';

const client = new SNSClient({
  region: process.env.AWS_REGION,
  maxAttempts: 1,
});
export const handler = createHandler({
  send: async (delivery) => {
    await client.send(
      new PublishCommand({
        TopicArn: process.env.FEEDBACK_TOPIC_ARN,
        Subject: delivery.subject,
        Message: delivery.message,
        MessageAttributes: {
          route: { DataType: 'String', StringValue: delivery.route },
          ctx: { DataType: 'String', StringValue: delivery.ctx },
        },
      }),
      { abortSignal: AbortSignal.timeout(3500) },
    );
  },
});
