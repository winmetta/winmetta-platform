# Feedback endpoint

A stateless Node.js 24 Lambda handler for the report dialog. Design and acceptance:
[docs/feedback.md](../../docs/feedback.md). Infrastructure: `../pulumi/feedback.ts`.
The feature is disabled unless the Pulumi stack and web build explicitly opt in.

From the repository root, after `npm ci`:

```bash
npm ci --prefix infra/feedback
npm run feedback:typecheck
npm run feedback:test
npm run feedback:build
```

The build bundles the pinned SNS SDK into `dist/index.cjs`. Pulumi archives that
bundle; build it before previewing an enabled feedback component. The tests use
synthetic requests and an injected delivery function, with no credentials or email.
The Pulumi tests also use mocks and require the bundle to exist.

`apps/web/src/lib/feedback-schema.ts` defines the contexts, allowed problem types,
validation and delivery routes for both the browser and Lambda. The Lambda accepts
at most 8 KiB of JSON, accepts only IAM-authorized Function URL invocations and publishes only the validated fields. The
execution role can publish to its feedback topic and write to its own log group.
The handler does not log events or errors containing report data.

Runtime environment: `FEEDBACK_TOPIC_ARN`. CloudFront OAC signs requests to the
IAM-protected Function URL; no shared secret is stored in Pulumi state.

SNS subscriptions, route filters, alert recipients, integration
tests against AWS and deployment approval belong in the private companion
repository's operations runbook. No live resources have been applied as part of
this implementation.
