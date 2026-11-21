import * as fs from 'node:fs';
import * as path from 'node:path';
import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { bookSearchMount, createBookSearchFiles } from './book-search-files';

// Book search backend (docs/book-search.md §12): a private bucket for the released SQLite
// index files, and one Lambda behind an IAM-authenticated Function URL that CloudFront reaches
// at /api/search. Same pattern as feedback.ts; the CloudFront wiring lives in index.ts.

interface BookSearchArgs {
  provider: aws.Provider;
  alertTopicArn: pulumi.Input<string>;
  bucketName: string;
  /** Released index to serve, such as `2026-11-20-r1`; empty keeps the function answering 503. */
  indexVersion: string;
  concurrency: number;
  useMountedIndex: boolean;
  cdnBase: string;
}

export function createBookSearch(args: BookSearchArgs) {
  const { provider, alertTopicArn } = args;
  const opts = { provider };
  const tags = { component: 'book-search' };

  // --- Index bucket: private, versioned, never public; releases are never overwritten ------
  const bucket = new aws.s3.Bucket(
    'book-search-index',
    { bucket: args.bucketName, tags },
    { provider, protect: true },
  );
  const publicAccessBlock = new aws.s3.BucketPublicAccessBlock(
    'book-search-index',
    {
      bucket: bucket.id,
      blockPublicAcls: true,
      ignorePublicAcls: true,
      blockPublicPolicy: true,
      restrictPublicBuckets: true,
    },
    opts,
  );
  const ownership = new aws.s3.BucketOwnershipControls(
    'book-search-index',
    { bucket: bucket.id, rule: { objectOwnership: 'BucketOwnerEnforced' } },
    { provider, dependsOn: [publicAccessBlock] },
  );
  const versioning = new aws.s3.BucketVersioning(
    'book-search-index',
    {
      bucket: bucket.id,
      versioningConfiguration: { status: 'Enabled' },
    },
    { provider, dependsOn: [ownership] },
  );
  const encryption = new aws.s3.BucketServerSideEncryptionConfiguration(
    'book-search-index',
    {
      bucket: bucket.id,
      rules: [
        { applyServerSideEncryptionByDefault: { sseAlgorithm: 'AES256' } },
      ],
    },
    { provider, dependsOn: [versioning] },
  );
  const bucketPolicy = new aws.s3.BucketPolicy(
    'book-search-index',
    {
      bucket: bucket.id,
      policy: pulumi.jsonStringify({
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'DenyInsecureTransport',
            Effect: 'Deny',
            Principal: '*',
            Action: 's3:*',
            Resource: [bucket.arn, pulumi.interpolate`${bucket.arn}/*`],
            Condition: { Bool: { 'aws:SecureTransport': 'false' } },
          },
        ],
      }),
    },
    { provider, dependsOn: [encryption] },
  );

  // --- Function -------------------------------------------------------------------------
  const log = new aws.cloudwatch.LogGroup(
    'book-search',
    {
      name: '/aws/lambda/winmetta-app-book-search',
      retentionInDays: 14,
      tags,
    },
    opts,
  );
  const role = new aws.iam.Role(
    'book-search',
    {
      assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
        Service: 'lambda.amazonaws.com',
      }),
      tags,
    },
    opts,
  );
  const files = args.useMountedIndex
    ? createBookSearchFiles(bucket, provider, bucketPolicy)
    : undefined;
  const vpcAccess = files
    ? new aws.iam.RolePolicyAttachment(
        'book-search-vpc',
        {
          role: role.name,
          policyArn:
            'arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole',
        },
        opts,
      )
    : undefined;
  const policy = new aws.iam.RolePolicy(
    'book-search',
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
          {
            Effect: 'Allow',
            Action: files
              ? ['s3:GetObject', 's3:GetObjectVersion']
              : 's3:GetObject',
            Resource: pulumi.interpolate`${bucket.arn}/releases/*`,
          },
          ...(files
            ? [
                {
                  Effect: 'Allow',
                  Action: 's3:ListBucket',
                  Resource: bucket.arn,
                },
                {
                  Effect: 'Allow',
                  Action: 's3files:ClientMount',
                  Resource: files.filesystem.arn,
                  Condition: {
                    StringEquals: {
                      's3files:AccessPointArn': files.access.arn,
                    },
                  },
                },
                {
                  Effect: 'Deny',
                  Action: 's3files:ClientWrite',
                  Resource: files.filesystem.arn,
                },
              ]
            : []),
        ],
      }),
    },
    opts,
  );
  const bundle = path.join(__dirname, '../book-search/dist/index.cjs');
  if (!fs.existsSync(bundle))
    throw new Error(
      'Build the book-search bundle with npm run book-search-lambda:build before previewing enabled book search.',
    );
  const fn = new aws.lambda.Function(
    'book-search',
    {
      name: 'winmetta-app-book-search',
      role: role.arn,
      runtime: 'nodejs24.x',
      architectures: ['arm64'],
      handler: 'index.handler',
      memorySize: 512,
      ephemeralStorage: { size: 512 },
      timeout: 10,
      ...(files
        ? {
            vpcConfig: files.vpcConfig,
            fileSystemConfig: files.fileSystemConfig,
          }
        : {}),
      reservedConcurrentExecutions: args.concurrency,
      code: new pulumi.asset.AssetArchive({
        'index.cjs': new pulumi.asset.FileAsset(bundle),
      }),
      environment: {
        variables: {
          BOOK_SEARCH_BUCKET: bucket.bucket,
          ...(files ? { BOOK_SEARCH_MOUNT: bookSearchMount } : {}),
          BOOK_SEARCH_INDEX_VERSION: args.indexVersion,
          PUBLIC_LIBRARY_CDN_BASE: args.cdnBase,
        },
      },
      tags,
    },
    {
      provider,
      dependsOn: [
        policy,
        log,
        ...(files && vpcAccess ? [vpcAccess, ...files.dependencies] : []),
      ],
    },
  );
  const url = new aws.lambda.FunctionUrl(
    'book-search',
    { functionName: fn.name, authorizationType: 'AWS_IAM' },
    opts,
  );
  const invocations = new aws.cloudwatch.MetricAlarm(
    'book-search-invocations',
    {
      namespace: 'AWS/Lambda',
      metricName: 'Invocations',
      statistic: 'Sum',
      period: 86400,
      evaluationPeriods: 1,
      threshold: 3000,
      comparisonOperator: 'GreaterThanOrEqualToThreshold',
      dimensions: { FunctionName: fn.name },
      treatMissingData: 'notBreaching',
      alarmActions: [alertTopicArn],
      tags,
    },
    opts,
  );
  const errors = new aws.cloudwatch.MetricAlarm(
    'book-search-errors',
    {
      namespace: 'AWS/Lambda',
      metricName: 'Errors',
      statistic: 'Sum',
      period: 3600,
      evaluationPeriods: 1,
      threshold: 20,
      comparisonOperator: 'GreaterThanOrEqualToThreshold',
      dimensions: { FunctionName: fn.name },
      treatMissingData: 'notBreaching',
      alarmActions: [alertTopicArn],
      tags,
    },
    opts,
  );
  return {
    functionResource: fn,
    functionName: fn.name,
    bucketName: bucket.bucket,
    alarmNames: [invocations.name, errors.name],
    originDomain: url.functionUrl.apply((value) => new URL(value).hostname),
  };
}
