import * as path from 'node:path';
import * as fs from 'node:fs';
import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

interface FeedbackArgs {
  provider: aws.Provider;
  alertTopicArn: pulumi.Input<string>;
  concurrency: number;
}

function executionRole(
  log: aws.cloudwatch.LogGroup,
  topic: aws.sns.Topic,
  provider: aws.Provider,
) {
  const role = new aws.iam.Role(
    'feedback',
    {
      assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
        Service: 'lambda.amazonaws.com',
      }),
      tags: { component: 'feedback' },
    },
    { provider },
  );
  const policy = new aws.iam.RolePolicy(
    'feedback',
    {
      role: role.id,
      policy: pulumi.jsonStringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['logs:CreateLogStream', 'logs:PutLogEvents'],
            Resource: pulumi.interpolate`${log.arn}:*`,
          },
          { Effect: 'Allow', Action: 'sns:Publish', Resource: topic.arn },
        ],
      }),
    },
    { provider },
  );
  return { role, policy };
}

export function createFeedback(args: FeedbackArgs) {
  const { provider, alertTopicArn, concurrency } = args;
  const opts = { provider };
  const topic = new aws.sns.Topic(
    'feedback',
    { tags: { component: 'feedback' } },
    opts,
  );
  // Subscriptions and mailbox filter policies live in the private operations runbook.
  const log = new aws.cloudwatch.LogGroup(
    'feedback',
    {
      name: '/aws/lambda/winmetta-app-feedback',
      retentionInDays: 14,
      tags: { component: 'feedback' },
    },
    opts,
  );
  const { role, policy } = executionRole(log, topic, provider);
  const bundle = path.join(__dirname, '../feedback/dist/index.cjs');
  if (!fs.existsSync(bundle))
    throw new Error(
      'Build the feedback bundle with npm run feedback:build before previewing enabled feedback.',
    );
  const fn = new aws.lambda.Function(
    'feedback',
    {
      name: 'winmetta-app-feedback',
      role: role.arn,
      runtime: 'nodejs24.x',
      architectures: ['arm64'],
      handler: 'index.handler',
      memorySize: 128,
      timeout: 5,
      reservedConcurrentExecutions: concurrency,
      code: new pulumi.asset.AssetArchive({
        'index.cjs': new pulumi.asset.FileAsset(bundle),
      }),
      environment: {
        variables: {
          FEEDBACK_TOPIC_ARN: topic.arn,
        },
      },
      tags: { component: 'feedback' },
    },
    { provider, dependsOn: [policy, log] },
  );
  const url = new aws.lambda.FunctionUrl(
    'feedback',
    { functionName: fn.name, authorizationType: 'AWS_IAM' },
    { provider },
  );
  const alarm = new aws.cloudwatch.MetricAlarm(
    'feedback-invocations',
    {
      namespace: 'AWS/Lambda',
      metricName: 'Invocations',
      statistic: 'Sum',
      period: 86400,
      evaluationPeriods: 1,
      threshold: 200,
      comparisonOperator: 'GreaterThanOrEqualToThreshold',
      dimensions: { FunctionName: fn.name },
      treatMissingData: 'notBreaching',
      alarmActions: [alertTopicArn],
      tags: { component: 'feedback' },
    },
    opts,
  );
  return {
    functionResource: fn,
    alarmName: alarm.name,
    topicArn: topic.arn,
    functionName: fn.name,
    originDomain: url.functionUrl.apply((value) => new URL(value).hostname),
  };
}
