// Analytics server for stats.app.winmetta.org (Phase 4, stage 2): one EC2 instance running
// Umami, PostgreSQL and Caddy on Docker, in its own small VPC, with a separate encrypted
// data volume, daily snapshots, a private backup bucket and CloudWatch alarms.
// Design and decisions: docs/analytics.md §5 and §9; plan: docs/implementation-plan.md §5A.
//
// Off by default: nothing here is created until the stack config `analyticsEnabled` is
// true. `pulumi up` is a manual maintainer step and needs explicit confirmation.
//
// What is deliberately NOT here:
// - Secrets. The server creates its own (Umami app secret, database password, 2FA
//   encryption key) in Parameter Store on first boot, so they never enter git, Pulumi
//   state or user data.
// - The alert email subscription. The address is internal information (private repo), so
//   the topic is created here and subscribed by hand (docs/runbook.md, analytics section).
// - An AWS Budget for these resources (the amount is still to be decided).
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

export interface AnalyticsArgs {
  zone: aws.route53.Zone;
  domain: string;
  tags: Record<string, string>;
}

const REGION = 'us-east-1';
const ZONE_AZ = 'us-east-1a';
const NAME = 'winmetta-analytics';
const PARAM_PREFIX = '/winmetta/analytics';
const SNAPSHOT_TAG = 'analytics-daily';
const CONFIG_DIR = path.join(__dirname, '..', 'analytics');

// The files the instance downloads at boot (infra/analytics/**), uploaded under `config/`.
function listFiles(dir: string, base = dir): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    // `test/` holds the laptop smoke test (needs Docker); it is not part of the server.
    if (dir === base && entry.name === 'test') return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory()
      ? listFiles(full, base)
      : [path.relative(base, full)];
  });
}

export function createAnalytics({ zone, domain, tags }: AnalyticsArgs) {
  const config = new pulumi.Config();
  // Everything the analytics server creates carries the tag `component=analytics` (on top
  // of the stack's tags), so its cost can be told apart from the site's in the bill and in
  // the budget below. The tag must be activated once as a cost allocation tag
  // (docs/runbook.md in the private repo, analytics section).
  const provider = new aws.Provider('aws-analytics', {
    region: REGION,
    defaultTags: { tags: { ...tags, component: 'analytics' } },
  });
  const budgetUsd = config.getNumber('analyticsBudgetUsd') ?? 30;
  const account = aws.getCallerIdentityOutput({}, { provider });
  const statsDomain = config.get('analyticsStatsDomain') ?? `stats.${domain}`;
  const instanceType = config.get('analyticsInstanceType') ?? 't4g.small';
  const dataVolumeGb = config.getNumber('analyticsDataVolumeGb') ?? 20;
  const bucketName =
    config.get('analyticsBucketName') ?? 'winmetta-analytics-backups';
  const amiParameter =
    config.get('analyticsAmiParameter') ??
    '/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64';
  const opts: pulumi.CustomResourceOptions = { provider };

  // --- Network: a small VPC with one public subnet. No SSH: Session Manager only. ------
  const vpc = new aws.ec2.Vpc(
    'analytics',
    {
      cidrBlock: '10.20.0.0/16',
      enableDnsSupport: true,
      enableDnsHostnames: true,
      tags: { Name: NAME },
    },
    opts,
  );
  const gateway = new aws.ec2.InternetGateway(
    'analytics',
    { vpcId: vpc.id, tags: { Name: NAME } },
    opts,
  );
  const subnet = new aws.ec2.Subnet(
    'analytics',
    {
      vpcId: vpc.id,
      cidrBlock: '10.20.1.0/24',
      availabilityZone: ZONE_AZ,
      mapPublicIpOnLaunch: true,
      tags: { Name: NAME },
    },
    opts,
  );
  const routes = new aws.ec2.RouteTable(
    'analytics',
    {
      vpcId: vpc.id,
      routes: [{ cidrBlock: '0.0.0.0/0', gatewayId: gateway.id }],
      tags: { Name: NAME },
    },
    opts,
  );
  const routeAssociation = new aws.ec2.RouteTableAssociation(
    'analytics',
    { subnetId: subnet.id, routeTableId: routes.id },
    opts,
  );
  // Only HTTP (for the Let's Encrypt challenge and the redirect) and HTTPS are open.
  const securityGroup = new aws.ec2.SecurityGroup(
    'analytics',
    {
      vpcId: vpc.id,
      description: 'Analytics server: HTTP and HTTPS only, no SSH',
      ingress: [
        {
          protocol: 'tcp',
          fromPort: 80,
          toPort: 80,
          cidrBlocks: ['0.0.0.0/0'],
        },
        {
          protocol: 'tcp',
          fromPort: 443,
          toPort: 443,
          cidrBlocks: ['0.0.0.0/0'],
        },
      ],
      egress: [
        { protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] },
      ],
      tags: { Name: NAME },
    },
    opts,
  );

  // --- Bucket: server config (config/) and database dumps (dumps/, expire in 21 days) ---
  // Private and encrypted. Dumps expire after 21 days (S3 deletes with some delay, and the daily report checks that none is older than 23 days) so that, with events deleted from the
  // live database after 12 months, no copy of an event outlives 13 months (analytics.md §4).
  const bucket = new aws.s3.Bucket(
    'analytics',
    { bucket: bucketName },
    { provider, protect: true },
  );
  // S3 rejects bucket-configuration calls made at the same time (OperationAborted), so
  // chain them one after another, as the site bucket does.
  const ownership = new aws.s3.BucketOwnershipControls(
    'analytics',
    { bucket: bucket.id, rule: { objectOwnership: 'BucketOwnerEnforced' } },
    opts,
  );
  const publicAccessBlock = new aws.s3.BucketPublicAccessBlock(
    'analytics',
    {
      bucket: bucket.id,
      blockPublicAcls: true,
      ignorePublicAcls: true,
      blockPublicPolicy: true,
      restrictPublicBuckets: true,
    },
    { provider, dependsOn: [ownership] },
  );
  const encryption = new aws.s3.BucketServerSideEncryptionConfiguration(
    'analytics',
    {
      bucket: bucket.id,
      rules: [
        {
          applyServerSideEncryptionByDefault: { sseAlgorithm: 'AES256' },
          bucketKeyEnabled: true,
        },
      ],
    },
    { provider, dependsOn: [publicAccessBlock] },
  );
  const lifecycle = new aws.s3.BucketLifecycleConfiguration(
    'analytics',
    {
      bucket: bucket.id,
      rules: [
        {
          id: 'expire-dumps',
          status: 'Enabled',
          filter: { prefix: 'dumps/' },
          expiration: { days: 21 },
          abortIncompleteMultipartUpload: { daysAfterInitiation: 7 },
        },
      ],
    },
    { provider, dependsOn: [encryption] },
  );
  const bucketPolicy = new aws.s3.BucketPolicy(
    'analytics',
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
    { provider, dependsOn: [lifecycle] },
  );
  const configObjects = listFiles(CONFIG_DIR).map((file) => {
    const full = path.join(CONFIG_DIR, file);
    return new aws.s3.BucketObject(
      `config-${file.replace(/[^a-zA-Z0-9]/g, '-')}`,
      {
        bucket: bucket.id,
        key: `config/${file.split(path.sep).join('/')}`,
        source: new pulumi.asset.FileAsset(full),
        sourceHash: crypto
          .createHash('md5')
          .update(fs.readFileSync(full))
          .digest('hex'),
      },
      { provider, dependsOn: [bucketPolicy] },
    );
  });

  // --- Reports and alerts: one SNS topic, subscribed by hand to the organization's admin group --
  const topic = new aws.sns.Topic(
    'analytics-alerts',
    { name: `${NAME}-alerts` },
    opts,
  );
  // The default topic policy plus AWS Budgets, which publishes the budget notices below.
  const topicPolicy = new aws.sns.TopicPolicy(
    'analytics-alerts',
    {
      arn: topic.arn,
      policy: pulumi.jsonStringify({
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'AllowThisAccount',
            Effect: 'Allow',
            Principal: { AWS: '*' },
            Action: [
              'SNS:GetTopicAttributes',
              'SNS:SetTopicAttributes',
              'SNS:AddPermission',
              'SNS:RemovePermission',
              'SNS:DeleteTopic',
              'SNS:Subscribe',
              'SNS:ListSubscriptionsByTopic',
              'SNS:Publish',
            ],
            Resource: topic.arn,
            Condition: {
              StringEquals: { 'AWS:SourceOwner': account.accountId },
            },
          },
          {
            Sid: 'AllowBudgets',
            Effect: 'Allow',
            Principal: { Service: 'budgets.amazonaws.com' },
            Action: 'SNS:Publish',
            Resource: topic.arn,
            Condition: {
              StringEquals: { 'aws:SourceAccount': account.accountId },
            },
          },
          {
            Sid: 'AllowEventBridge',
            Effect: 'Allow',
            Principal: { Service: 'events.amazonaws.com' },
            Action: 'SNS:Publish',
            Resource: topic.arn,
          },
        ],
      }),
    },
    opts,
  );
  // A monthly cost budget for the analytics resources only (tag component=analytics),
  // $30 by default (decided 2026-10-31; the estimate is about $22). Notices go to the same
  // topic, so they reach the admin group.
  new aws.budgets.Budget(
    'analytics',
    {
      name: `${NAME}-monthly`,
      budgetType: 'COST',
      limitAmount: String(budgetUsd),
      limitUnit: 'USD',
      timeUnit: 'MONTHLY',
      costFilters: [
        { name: 'TagKeyValue', values: ['user:component$analytics'] },
      ],
      notifications: [
        {
          comparisonOperator: 'GREATER_THAN',
          threshold: 80,
          thresholdType: 'PERCENTAGE',
          notificationType: 'ACTUAL',
          subscriberSnsTopicArns: [topic.arn],
        },
        {
          comparisonOperator: 'GREATER_THAN',
          threshold: 100,
          thresholdType: 'PERCENTAGE',
          notificationType: 'FORECASTED',
          subscriberSnsTopicArns: [topic.arn],
        },
        {
          comparisonOperator: 'GREATER_THAN',
          threshold: 100,
          thresholdType: 'PERCENTAGE',
          notificationType: 'ACTUAL',
          subscriberSnsTopicArns: [topic.arn],
        },
      ],
    },
    { provider, dependsOn: [topicPolicy] },
  );
  // --- Instance role: Session Manager, its own secrets, its config and dump prefixes ---
  const role = new aws.iam.Role(
    'analytics',
    {
      name: NAME,
      description: 'Analytics EC2 instance (Session Manager, backups, secrets)',
      assumeRolePolicy: pulumi.jsonStringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { Service: 'ec2.amazonaws.com' },
            Action: 'sts:AssumeRole',
          },
        ],
      }),
    },
    opts,
  );
  new aws.iam.RolePolicyAttachment(
    'analytics-ssm',
    {
      role: role.name,
      policyArn: 'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore',
    },
    opts,
  );
  new aws.iam.RolePolicy(
    'analytics',
    {
      role: role.id,
      policy: pulumi.jsonStringify({
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'ReadServerConfig',
            Effect: 'Allow',
            Action: 's3:GetObject',
            Resource: pulumi.interpolate`${bucket.arn}/config/*`,
          },
          {
            Sid: 'ListServerConfig',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: bucket.arn,
            Condition: { StringLike: { 's3:prefix': ['config/*', 'config'] } },
          },
          {
            // Add and read dumps (bin/restore-dump.sh downloads one); never delete. A dump holds
            // what the live database holds, and the instance already has that.
            Sid: 'WriteAndReadDumps',
            Effect: 'Allow',
            Action: ['s3:PutObject', 's3:GetObject'],
            Resource: pulumi.interpolate`${bucket.arn}/dumps/*`,
          },
          {
            Sid: 'ListDumps',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: bucket.arn,
            Condition: { StringLike: { 's3:prefix': ['dumps/*', 'dumps'] } },
          },
          {
            // Read-only metadata (the API cannot be limited by resource): lets the daily report
            // check that snapshots are being made and none is older than the retention limit.
            Sid: 'ReadSnapshotAges',
            Effect: 'Allow',
            Action: 'ec2:DescribeSnapshots',
            Resource: '*',
          },
          {
            Sid: 'OwnSecrets',
            Effect: 'Allow',
            Action: ['ssm:GetParameter', 'ssm:PutParameter'],
            Resource: pulumi.interpolate`arn:aws:ssm:${REGION}:${account.accountId}:parameter${PARAM_PREFIX}/*`,
          },
          {
            // The daily health report (bin/health-report.sh) emails through this topic.
            Sid: 'PublishHealthReport',
            Effect: 'Allow',
            Action: 'sns:Publish',
            Resource: topic.arn,
          },
        ],
      }),
    },
    opts,
  );
  const profile = new aws.iam.InstanceProfile(
    'analytics',
    { name: NAME, role: role.name },
    opts,
  );

  // --- Storage: a separate encrypted data volume, snapshotted daily (kept 14 days) ----------
  const dataVolume = new aws.ebs.Volume(
    'analytics-data',
    {
      availabilityZone: ZONE_AZ,
      size: dataVolumeGb,
      type: 'gp3',
      encrypted: true,
      tags: { Name: `${NAME}-data`, Snapshot: SNAPSHOT_TAG },
    },
    { provider, protect: true },
  );
  const dlmRole = new aws.iam.Role(
    'analytics-dlm',
    {
      name: `${NAME}-snapshots`,
      assumeRolePolicy: pulumi.jsonStringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { Service: 'dlm.amazonaws.com' },
            Action: 'sts:AssumeRole',
          },
        ],
      }),
    },
    opts,
  );
  const dlmAttachment = new aws.iam.RolePolicyAttachment(
    'analytics-dlm',
    {
      role: dlmRole.name,
      policyArn:
        'arn:aws:iam::aws:policy/service-role/AWSDataLifecycleManagerServiceRole',
    },
    opts,
  );
  new aws.dlm.LifecyclePolicy(
    'analytics',
    {
      description:
        'Daily snapshots of the analytics data volume - kept 14 days',
      executionRoleArn: dlmRole.arn,
      state: 'ENABLED',
      policyDetails: {
        resourceTypes: ['VOLUME'],
        targetTags: { Snapshot: SNAPSHOT_TAG },
        schedules: [
          {
            name: 'daily',
            createRule: { interval: 24, intervalUnit: 'HOURS', times: '04:00' },
            // By age, not by count: a count rule deletes the oldest snapshot only when a new one
            // is made, so if creation ever stopped the last 14 would stay forever.
            retainRule: { interval: 14, intervalUnit: 'DAYS' },
            copyTags: true,
          },
        ],
      },
    },
    { provider, dependsOn: [dlmAttachment] },
  );

  // --- The instance ----------------------------------------------------------------------
  // Amazon Linux 2023 on ARM (Graviton), the newest generally available Amazon Linux. Checked
  // 2026-10-30 against the public SSM parameters AWS publishes: AL2023 2023.12.20261102.0 on
  // kernel 6.18 is what `kernel-default` resolves to; Amazon Linux 2027 exists only as a
  // "preview" there and is not used. AL2023 has standard support until 2027-06-30 and
  // maintenance until 2029-06-30, so plan the move to AL2027 once it is generally available
  // (docs/runbook.md, analytics section). Switching is a stack config change
  // (`analyticsAmiParameter`) and an instance replacement. The AMI id comes from the public SSM parameter;
  // `ignoreChanges` keeps a newer AMI from replacing a running server. Roll a new AMI in on
  // purpose (docs/runbook.md). User data is only a launcher: it fetches the real installer
  // from the config bucket, so it holds no secret and little logic.
  // The lookup runs only when the stack is really updated. A preview (dry run) uses a
  // placeholder: the AMI is ignored after creation anyway, and a pull request's preview role
  // may not be allowed to read the public parameter until `pulumi up` has applied this
  // very change to its policy.
  const amiId = pulumi.runtime.isDryRun()
    ? pulumi.output('ami-00000000000000000')
    : aws.ssm.getParameterOutput({ name: amiParameter }, { provider }).value;
  const userData = pulumi.interpolate`#!/bin/bash
set -euo pipefail
mkdir -p /etc/analytics /opt/analytics
cat >/etc/analytics/instance.env <<'EOF'
AWS_REGION=${REGION}
BUCKET=${bucket.bucket}
STATS_DOMAIN=${statsDomain}
INSTANCE_NAME=${NAME}
DATA_VOLUME_ID=${dataVolume.id}
PARAM_PREFIX=${PARAM_PREFIX}
TOPIC_ARN=${topic.arn}
EOF
for _ in $(seq 1 30); do
  aws s3 sync "s3://${bucket.bucket}/config/" /opt/analytics/ --region ${REGION} --only-show-errors && break
  sleep 10
done
chmod +x /opt/analytics/install.sh
bash /opt/analytics/install.sh >>/var/log/analytics-install.log 2>&1
`;
  const instance = new aws.ec2.Instance(
    'analytics',
    {
      ami: amiId,
      instanceType,
      subnetId: subnet.id,
      vpcSecurityGroupIds: [securityGroup.id],
      iamInstanceProfile: profile.name,
      associatePublicIpAddress: true,
      rootBlockDevice: { volumeSize: 20, volumeType: 'gp3', encrypted: true },
      // IMDSv2 only; the containers do not need instance credentials (hop limit 1).
      metadataOptions: {
        httpEndpoint: 'enabled',
        httpTokens: 'required',
        httpPutResponseHopLimit: 1,
      },
      userData,
      userDataReplaceOnChange: false,
      tags: { Name: NAME },
    },
    {
      provider,
      // The instance needs a route to the internet gateway from its first second (the
      // installer downloads packages and images); without these dependencies Pulumi may
      // create it before the route table is associated.
      dependsOn: [...configObjects, gateway, routeAssociation],
      ignoreChanges: ['ami', 'userData'],
    },
  );
  new aws.ec2.VolumeAttachment(
    'analytics-data',
    {
      deviceName: '/dev/sdf',
      volumeId: dataVolume.id,
      instanceId: instance.id,
      stopInstanceBeforeDetaching: true,
    },
    opts,
  );
  const address = new aws.ec2.Eip(
    'analytics',
    { domain: 'vpc', instance: instance.id, tags: { Name: NAME } },
    { provider, dependsOn: [gateway] },
  );
  new aws.route53.Record(
    'stats',
    {
      zoneId: zone.zoneId,
      name: statsDomain,
      type: 'A',
      ttl: 300,
      records: [address.publicIp],
    },
    opts,
  );

  // Monitoring is a script on the instance, not CloudWatch metrics, alarms or a Route 53
  // health check (docs/analytics.md §9 item 11): bin/health-report.sh checks the server and
  // the site once a night and emails one digest through the topic. A dead server cannot
  // send a report, so an alarm on EC2's own free status-check metric (about $0.10 a month)
  // and an EventBridge rule for stops and terminations cover that. A stopped timer or a service that is down while the instance is up
  // is only noticed by the next report (up to a day later), which was accepted on purpose.
  // A stopped or terminated instance sends no status-check data at all, so that alarm cannot
  // see it; EventBridge reports the state change itself. It is a free, immediate email.
  const stateRule = new aws.cloudwatch.EventRule(
    'instance-state',
    {
      name: `${NAME}-instance-state`,
      description:
        'The analytics EC2 instance stopped, is stopping or was terminated',
      eventPattern: pulumi.jsonStringify({
        source: ['aws.ec2'],
        'detail-type': ['EC2 Instance State-change Notification'],
        detail: {
          'instance-id': [instance.id],
          state: ['stopping', 'stopped', 'shutting-down', 'terminated'],
        },
      }),
    },
    opts,
  );
  new aws.cloudwatch.EventTarget(
    'instance-state',
    {
      rule: stateRule.name,
      arn: topic.arn,
      inputTransformer: {
        inputPaths: {
          id: '$.detail.instance-id',
          state: '$.detail.state',
          time: '$.time',
        },
        inputTemplate:
          '"The analytics server <id> is now <state> (<time>). If this was not planned, see the runbook, analytics section."',
      },
    },
    { provider, dependsOn: [topicPolicy] },
  );
  new aws.cloudwatch.MetricAlarm(
    'instance-status',
    {
      name: `${NAME}-instance-status`,
      alarmDescription:
        'The analytics EC2 instance failed its status check (runbook: docs/runbook.md, analytics section)',
      namespace: 'AWS/EC2',
      metricName: 'StatusCheckFailed',
      dimensions: { InstanceId: instance.id },
      statistic: 'Maximum',
      period: 60,
      evaluationPeriods: 5,
      threshold: 0.5,
      comparisonOperator: 'GreaterThanThreshold',
      treatMissingData: 'notBreaching',
      alarmActions: [topic.arn],
      okActions: [topic.arn],
    },
    opts,
  );

  return {
    statsDomain,
    instanceId: instance.id,
    publicIp: address.publicIp,
    alertTopicArn: topic.arn,
    bucket: bucket.bucket,
  };
}
