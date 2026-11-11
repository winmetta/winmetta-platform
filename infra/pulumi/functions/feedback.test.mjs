// Pulumi mocks exercise registration without credentials or any AWS calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pulumi = require('@pulumi/pulumi');
const aws = require('@pulumi/aws');
const ts = require('typescript');
const resources = [];
pulumi.runtime.setMocks(
  {
    newResource(args) {
      resources.push(args);
      return {
        id: args.name,
        state: {
          ...args.inputs,
          name: args.inputs.name ?? args.name,
          arn: `arn:aws:test:us-east-1:000000000000:${args.name}`,
          functionUrl: 'https://synthetic.lambda-url.us-east-1.on.aws/',
        },
      };
    },
    call(args) {
      return args.inputs;
    },
  },
  'feedback-test',
  'test',
  false,
);

// The Pulumi program is CommonJS TypeScript. Compile it using the project's own
// compiler, preserving __dirname so the archive comes from the normal bundle path.
const filename = fileURLToPath(new URL('../feedback.ts', import.meta.url));
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', '__dirname', compiled)(
  require,
  mod,
  mod.exports,
  path.dirname(filename),
);
const { createFeedback } = mod.exports;

test('feedback infrastructure has IAM-only URL access, scoped delivery and bounded execution', async () => {
  const result = createFeedback({
    provider: new aws.Provider('test', { region: 'us-east-1' }),
    concurrency: 2,
    alertTopicArn: 'arn:aws:sns:us-east-1:000000000000:synthetic-alerts',
  });
  await pulumi.output(result).promise();
  const one = (type) => resources.find((r) => r.type === type).inputs;
  const fn = one('aws:lambda/function:Function');
  assert.equal(fn.runtime, 'nodejs24.x');
  assert.equal(fn.timeout, 5);
  assert.equal(fn.memorySize, 128);
  assert.equal(fn.reservedConcurrentExecutions, 2);
  assert.deepEqual(fn.architectures, ['arm64']);
  assert.equal(one('aws:cloudwatch/logGroup:LogGroup').retentionInDays, 14);
  const policy = JSON.parse(one('aws:iam/rolePolicy:RolePolicy').policy);
  assert.deepEqual(
    policy.Statement.map((s) => s.Action),
    [['logs:CreateLogStream', 'logs:PutLogEvents'], 'sns:Publish'],
  );
  assert.ok(policy.Statement.every((s) => s.Resource !== '*'));
  assert.equal(
    one('aws:lambda/functionUrl:FunctionUrl').authorizationType,
    'AWS_IAM',
  );
  assert.equal(
    resources.filter((r) => r.type === 'aws:lambda/permission:Permission')
      .length,
    0,
  );
  const alarm = one('aws:cloudwatch/metricAlarm:MetricAlarm');
  assert.equal(alarm.period, 86400);
  assert.equal(alarm.threshold, 200);
  assert.equal(
    alarm.alarmActions[0],
    'arn:aws:sns:us-east-1:000000000000:synthetic-alerts',
  );
  assert.equal(
    await result.originDomain.promise(),
    'synthetic.lambda-url.us-east-1.on.aws',
  );
});
