// Hosting for app.winmetta.org: a private S3 bucket behind CloudFront (origin access
// control), an ACM certificate, a Route 53 zone and the GitHub OIDC deploy role.
// Design: docs/tech-architecture.md §6-§8. Steps: docs/implementation-plan.md §4 step 3.
//
// Everything lives in one region (us-east-1), so one AWS provider covers it, including
// the CloudFront certificate, which must be requested there.
//
// The first apply is staged: ACM DNS validation needs the DreamHost delegation to be
// live. Leave `delegationConfirmed` unset (false) to create only the hosted zone, add its
// four NS records in DreamHost, check delegation, then set it to true and apply again.
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

const config = new pulumi.Config();
const domain = config.get('domain') ?? 'app.winmetta.org';
const githubRepo = config.get('githubRepo') ?? 'winmetta/winmetta-platform';
const githubEnvironment = config.get('githubEnvironment') ?? 'production';
const siteBucketName =
  config.get('siteBucketName') ?? 'winmetta-app-production-site';
const delegationConfirmed = config.getBoolean('delegationConfirmed') ?? false;

const tags = {
  project: 'winmetta-platform',
  environment: 'production',
  'managed-by': 'pulumi',
};
const provider = new aws.Provider('aws', {
  region: 'us-east-1',
  defaultTags: { tags },
});
const opts: pulumi.CustomResourceOptions = { provider };

const account = aws.getCallerIdentityOutput({}, { provider });

// --- DNS: the zone for app.winmetta.org, delegated from DreamHost ------------------
// Protected: deleting the zone would change its name servers and break the delegation.
const zone = new aws.route53.Zone(
  'zone',
  { name: domain, comment: 'app.winmetta.org (Pulumi)' },
  { provider, protect: true },
);

export const nameServers = zone.nameServers;
export const siteBucket = siteBucketName;

// --- Site bucket: private, versioned, readable only through CloudFront --------------
const bucket = new aws.s3.Bucket(
  'site',
  { bucket: siteBucketName },
  { provider, protect: true },
);
// S3 rejects bucket-configuration calls made at the same time (OperationAborted), and
// Pulumi runs independent resources in parallel, so chain them one after another.
const ownership = new aws.s3.BucketOwnershipControls(
  'site',
  { bucket: bucket.id, rule: { objectOwnership: 'BucketOwnerEnforced' } },
  opts,
);
const publicAccessBlock = new aws.s3.BucketPublicAccessBlock(
  'site',
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
  'site',
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
// Versioning gives a way back from a bad upload. The lifecycle rule below only expires
// noncurrent versions (replaced or deleted objects). A hashed file that is no longer
// referenced but is still current is never expired by age, so the deploy workflow must
// prune those itself, about a week after they stop being referenced (plan step 5).
const versioning = new aws.s3.BucketVersioning(
  'site',
  { bucket: bucket.id, versioningConfiguration: { status: 'Enabled' } },
  { provider, dependsOn: [encryption] },
);
const lifecycle = new aws.s3.BucketLifecycleConfiguration(
  'site',
  {
    bucket: bucket.id,
    rules: [
      {
        id: 'expire-old-versions',
        status: 'Enabled',
        filter: {},
        noncurrentVersionExpiration: { noncurrentDays: 30 },
        abortIncompleteMultipartUpload: { daysAfterInitiation: 7 },
      },
    ],
  },
  { provider, dependsOn: [versioning] },
);

// --- CloudFront ---------------------------------------------------------------------
const originAccessControl = new aws.cloudfront.OriginAccessControl(
  'site',
  {
    name: 'winmetta-app-site',
    description: 'CloudFront access to the private site bucket',
    originAccessControlOriginType: 's3',
    signingBehavior: 'always',
    signingProtocol: 'sigv4',
  },
  opts,
);

// Maps directory URLs to index.html and adds the trailing slash (see the file's header).
const viewerRequest = new aws.cloudfront.Function(
  'viewer-request',
  {
    name: 'winmetta-app-viewer-request',
    runtime: 'cloudfront-js-2.0',
    comment: 'Directory index and trailing-slash redirect',
    publish: true,
    code: fs.readFileSync(
      path.join(__dirname, 'functions', 'viewer-request.js'),
      'utf8',
    ),
  },
  opts,
);

// Security headers only. Indexing is controlled by PUBLIC_ALLOW_INDEXING in the build
// (meta tag and robots.txt), never by a CloudFront header, so the two cannot disagree.
// No Content-Security-Policy yet: add one only after testing it against the built site.
const headersPolicy = new aws.cloudfront.ResponseHeadersPolicy(
  'security-headers',
  {
    name: 'winmetta-app-security-headers',
    comment: 'Security headers for app.winmetta.org',
    securityHeadersConfig: {
      strictTransportSecurity: {
        accessControlMaxAgeSec: 31536000,
        includeSubdomains: false,
        preload: false,
        override: true,
      },
      contentTypeOptions: { override: true },
      frameOptions: { frameOption: 'DENY', override: true },
      referrerPolicy: {
        referrerPolicy: 'strict-origin-when-cross-origin',
        override: true,
      },
    },
    customHeadersConfig: {
      items: [
        {
          header: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=()',
          override: true,
        },
      ],
    },
  },
  opts,
);

// AWS-managed cache policy: compression on, and the origin's Cache-Control decides the
// TTL (immutable for hashed files, short for HTML; see the deploy workflow).
const cachingOptimized = aws.cloudfront.getCachePolicyOutput(
  { name: 'Managed-CachingOptimized' },
  { provider },
);

const originId = 'site-bucket';
let distribution: aws.cloudfront.Distribution | undefined;
let certificateArn: pulumi.Output<string> | undefined;
let deployRoleArn: pulumi.Output<string> | undefined;

if (delegationConfirmed) {
  // --- ACM certificate, validated through Route 53 -----------------------------------
  const siteCertificate = new aws.acm.Certificate(
    'site',
    { domainName: domain, validationMethod: 'DNS' },
    opts,
  );
  // One domain name, so there is exactly one validation record.
  const validationOption = siteCertificate.domainValidationOptions.apply(
    (options) => {
      const first = options[0];
      if (!first) throw new Error('ACM returned no DNS validation option');
      return first;
    },
  );
  const validationRecord = new aws.route53.Record(
    'cert-validation',
    {
      zoneId: zone.zoneId,
      name: validationOption.resourceRecordName,
      type: validationOption.resourceRecordType,
      records: [validationOption.resourceRecordValue],
      ttl: 300,
      allowOverwrite: true,
    },
    opts,
  );
  const validation = new aws.acm.CertificateValidation(
    'site',
    {
      certificateArn: siteCertificate.arn,
      validationRecordFqdns: [validationRecord.fqdn],
    },
    opts,
  );
  certificateArn = validation.certificateArn;

  distribution = new aws.cloudfront.Distribution(
    'site',
    {
      enabled: true,
      comment: domain,
      aliases: [domain],
      httpVersion: 'http2and3',
      isIpv6Enabled: true,
      // Readers are worldwide, including Myanmar, and PriceClass_100 leaves out Asia.
      priceClass: 'PriceClass_All',
      origins: [
        {
          originId,
          domainName: bucket.bucketRegionalDomainName,
          originAccessControlId: originAccessControl.id,
        },
      ],
      defaultCacheBehavior: {
        targetOriginId: originId,
        viewerProtocolPolicy: 'redirect-to-https',
        allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
        cachedMethods: ['GET', 'HEAD'],
        cachePolicyId: cachingOptimized.id,
        responseHeadersPolicyId: headersPolicy.id,
        compress: true,
        functionAssociations: [
          { eventType: 'viewer-request', functionArn: viewerRequest.arn },
        ],
      },
      // With origin access control and no s3:ListBucket, S3 answers 403 for a missing
      // key, so both 403 and 404 serve the site's own 404 page with a real 404 status.
      customErrorResponses: [
        {
          errorCode: 403,
          responseCode: 404,
          responsePagePath: '/404.html',
          errorCachingMinTtl: 10,
        },
        {
          errorCode: 404,
          responseCode: 404,
          responsePagePath: '/404.html',
          errorCachingMinTtl: 10,
        },
      ],
      restrictions: { geoRestriction: { restrictionType: 'none' } },
      viewerCertificate: {
        acmCertificateArn: validation.certificateArn,
        sslSupportMethod: 'sni-only',
        minimumProtocolVersion: 'TLSv1.2_2021',
      },
    },
    opts,
  );

  // Only this distribution may read the bucket.
  new aws.s3.BucketPolicy(
    'site',
    {
      bucket: bucket.id,
      policy: pulumi.jsonStringify({
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'AllowCloudFrontRead',
            Effect: 'Allow',
            Principal: { Service: 'cloudfront.amazonaws.com' },
            Action: 's3:GetObject',
            Resource: pulumi.interpolate`${bucket.arn}/*`,
            Condition: { StringEquals: { 'AWS:SourceArn': distribution.arn } },
          },
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

  // Alias records (IPv4 and IPv6) to the distribution. Z2FDTNDATAQYW2 is the fixed hosted
  // zone ID that every CloudFront distribution uses.
  for (const type of ['A', 'AAAA']) {
    new aws.route53.Record(
      `alias-${type}`,
      {
        zoneId: zone.zoneId,
        name: domain,
        type,
        aliases: [
          {
            name: distribution.domainName,
            zoneId: 'Z2FDTNDATAQYW2',
            evaluateTargetHealth: false,
          },
        ],
      },
      opts,
    );
  }

  // --- Deploy role for GitHub Actions (OIDC, no stored keys) --------------------------
  // Trusts only this repository's `production` environment. It can sync the site bucket
  // and invalidate this one distribution, nothing else. The Pulumi preview role is
  // separate and arrives with the deploy workflow (plan step 5).
  const oidcProviderArn = pulumi.interpolate`arn:aws:iam::${account.accountId}:oidc-provider/token.actions.githubusercontent.com`;
  const deployRole = new aws.iam.Role(
    'deploy',
    {
      name: 'winmetta-app-deploy',
      description:
        'GitHub Actions deploy of app.winmetta.org (production environment only)',
      maxSessionDuration: 3600,
      assumeRolePolicy: pulumi.jsonStringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { Federated: oidcProviderArn },
            Action: 'sts:AssumeRoleWithWebIdentity',
            Condition: {
              StringEquals: {
                'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
                'token.actions.githubusercontent.com:sub': `repo:${githubRepo}:environment:${githubEnvironment}`,
              },
            },
          },
        ],
      }),
    },
    opts,
  );
  new aws.iam.RolePolicy(
    'deploy',
    {
      role: deployRole.id,
      policy: pulumi.jsonStringify({
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'ListSiteBucket',
            Effect: 'Allow',
            Action: [
              's3:ListBucket',
              's3:GetBucketLocation',
              's3:ListBucketMultipartUploads',
            ],
            Resource: bucket.arn,
          },
          {
            Sid: 'WriteSiteObjects',
            Effect: 'Allow',
            // AbortMultipartUpload lets `aws s3 sync` clean up a failed large upload.
            Action: [
              's3:PutObject',
              's3:GetObject',
              's3:DeleteObject',
              's3:AbortMultipartUpload',
            ],
            Resource: pulumi.interpolate`${bucket.arn}/*`,
          },
          {
            Sid: 'InvalidateDistribution',
            Effect: 'Allow',
            Action: [
              'cloudfront:CreateInvalidation',
              'cloudfront:GetInvalidation',
            ],
            Resource: distribution.arn,
          },
        ],
      }),
    },
    opts,
  );
  deployRoleArn = deployRole.arn;
}

const pending = 'not created yet (delegationConfirmed is false)';
export const distributionId = distribution ? distribution.id : pending;
export const distributionDomain = distribution
  ? distribution.domainName
  : pending;
export const certificate = certificateArn ?? pending;
export const deployRole = deployRoleArn ?? pending;
export const url = delegationConfirmed ? `https://${domain}/` : pending;
