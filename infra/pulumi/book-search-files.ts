import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

export const bookSearchMount = '/mnt/book-search';

export function createBookSearchFiles(
  bucket: aws.s3.Bucket,
  provider: aws.Provider,
  bucketReady: pulumi.Resource,
) {
  const opts = { provider };
  const region = aws.getRegionOutput({}, opts).name;
  const account = aws.getCallerIdentityOutput({}, opts).accountId;
  const tags = { component: 'book-search' };
  const service = 'elasticfilesystem.amazonaws.com';
  const syncRole = new aws.iam.Role(
    'book-search-files',
    {
      assumeRolePolicy: pulumi.jsonStringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { Service: service },
            Action: 'sts:AssumeRole',
            Condition: {
              StringEquals: { 'aws:SourceAccount': account },
              ArnLike: {
                'aws:SourceArn': pulumi.interpolate`arn:aws:s3files:${region}:${account}:file-system/*`,
              },
            },
          },
        ],
      }),
      tags,
    },
    opts,
  );
  // S3 Files uses a service-managed EventBridge rule to see new object versions.
  const syncPolicy = new aws.iam.RolePolicy(
    'book-search-files',
    {
      role: syncRole.name,
      policy: pulumi.jsonStringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['s3:ListBucket', 's3:ListBucketVersions'],
            Resource: bucket.arn,
          },
          {
            Effect: 'Allow',
            Action: [
              's3:AbortMultipartUpload',
              's3:DeleteObject*',
              's3:GetObject*',
              's3:List*',
              's3:PutObject*',
            ],
            Resource: pulumi.interpolate`${bucket.arn}/releases/*`,
          },
          {
            Effect: 'Allow',
            Action: [
              'events:DeleteRule',
              'events:DisableRule',
              'events:EnableRule',
              'events:PutRule',
              'events:PutTargets',
              'events:RemoveTargets',
            ],
            Resource: pulumi.interpolate`arn:aws:events:${region}:${account}:rule/DO-NOT-DELETE-S3-Files*`,
            Condition: { StringEquals: { 'events:ManagedBy': service } },
          },
          {
            Effect: 'Allow',
            Action: [
              'events:DescribeRule',
              'events:ListRuleNamesByTarget',
              'events:ListRules',
              'events:ListTargetsByRule',
            ],
            Resource: pulumi.interpolate`arn:aws:events:${region}:${account}:rule/*`,
          },
        ],
      }),
    },
    opts,
  );
  const notifications = new aws.s3.BucketNotification(
    'book-search-files',
    { bucket: bucket.id, eventbridge: true },
    { provider, dependsOn: [bucketReady] },
  );
  const filesystem = new aws.s3.FilesFileSystem(
    'book-search',
    {
      bucket: bucket.arn,
      prefix: 'releases/',
      roleArn: syncRole.arn,
      tags,
    },
    { provider, dependsOn: [syncPolicy, notifications] },
  );
  const access = new aws.s3.FilesAccessPoint(
    'book-search',
    {
      fileSystemId: filesystem.id,
      posixUsers: [{ uid: 1000, gid: 1000 }],
      tags,
    },
    opts,
  );

  const vpc = new aws.ec2.Vpc(
    'book-search',
    {
      cidrBlock: '10.42.0.0/24',
      enableDnsSupport: true,
      enableDnsHostnames: true,
      tags,
    },
    opts,
  );
  const lambdaGroup = new aws.ec2.SecurityGroup(
    'book-search-lambda',
    {
      vpcId: vpc.id,
      description: 'Book search Lambda NFS client',
      tags,
    },
    opts,
  );
  const mountGroup = new aws.ec2.SecurityGroup(
    'book-search-files',
    {
      vpcId: vpc.id,
      description: 'Accepts NFS from the book search Lambda',
      tags,
    },
    opts,
  );
  const nfs = { ipProtocol: 'tcp', fromPort: 2049, toPort: 2049 };
  const ingress = new aws.vpc.SecurityGroupIngressRule(
    'book-search-nfs',
    {
      ...nfs,
      securityGroupId: mountGroup.id,
      referencedSecurityGroupId: lambdaGroup.id,
    },
    opts,
  );
  const egress = new aws.vpc.SecurityGroupEgressRule(
    'book-search-nfs',
    {
      ...nfs,
      securityGroupId: lambdaGroup.id,
      referencedSecurityGroupId: mountGroup.id,
    },
    opts,
  );
  // The production provider is fixed to us-east-1. AZ IDs are stable across accounts.
  const subnets = ['use1-az1', 'use1-az2'].map(
    (availabilityZoneId, i) =>
      new aws.ec2.Subnet(
        `book-search-${i}`,
        {
          vpcId: vpc.id,
          cidrBlock: `10.42.0.${i * 64}/26`,
          availabilityZoneId,
          tags,
        },
        opts,
      ),
  );
  const targets = subnets.map(
    (subnet, i) =>
      new aws.s3.FilesMountTarget(
        `book-search-${i}`,
        {
          fileSystemId: filesystem.id,
          subnetId: subnet.id,
          securityGroups: [mountGroup.id],
        },
        opts,
      ),
  );
  return {
    filesystem,
    access,
    dependencies: [...targets, ingress, egress],
    vpcConfig: {
      subnetIds: subnets.map((subnet) => subnet.id),
      securityGroupIds: [lambdaGroup.id],
    },
    fileSystemConfig: { arn: access.arn, localMountPath: bookSearchMount },
  };
}
