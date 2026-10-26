#!/usr/bin/env node
// Checks this repo's agent skills (.agents/skills, symlinked from .claude/skills) with the
// skill-maintainer checker from winmetta/agent-skills. The checker is not vendored here: it is
// found in $SKILL_MAINTAINER_DIR (CI sets it to a pinned release), or in a global install
// (~/.agents/skills or ~/.claude/skills). Without one it skips locally and fails in CI.
//   npm run skills:check
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const candidates = [
  process.env.SKILL_MAINTAINER_DIR,
  join(homedir(), '.agents/skills/skill-maintainer'),
  join(homedir(), '.claude/skills/skill-maintainer'),
].filter(Boolean);
const checker = candidates
  .map((dir) => join(dir, 'scripts/check-skills.mjs'))
  .find((path) => existsSync(path));

if (!checker) {
  const install =
    'npx skills@latest add winmetta/agent-skills --skill skill-maintainer -g -a claude-code -a codex';
  if (process.env.CI) {
    console.error(
      'skills:check: SKILL_MAINTAINER_DIR does not point to a skill-maintainer folder.',
    );
    process.exit(1);
  }
  console.warn(
    `skills:check skipped: skill-maintainer is not installed. Install it globally with:\n  ${install}`,
  );
  process.exit(0);
}
const result = spawnSync(
  process.execPath,
  [checker, ...process.argv.slice(2)],
  {
    stdio: 'inherit',
  },
);
process.exit(result.status ?? 1);
