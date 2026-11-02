// The command line's own output: human mode for each data shape, and a start through a linked folder.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT, sandbox } from './helpers.mjs';

const ep = (s, args, entry = join(ROOT, 'engine', 'ep.mjs')) =>
  spawnSync(process.execPath, [entry, ...args], { cwd: s.tmp, env: s.env, encoding: 'utf8', timeout: 60000 });

test('inspect prints in human mode, where git is a sentence rather than a change list', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const r = ep(s, ['inspect']);
  assert.equal(r.stderr, '');
  assert.match(r.stdout, /"git":/);
});

test('bidirectional and control characters from input never reach the terminal raw', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  // An argument can carry U+202E (right-to-left override), which reorders what the user reads after it, an
  // invisible tag character outside the basic plane and a line separator.
  const arg = `notes${String.fromCodePoint(0x202e)}txt${String.fromCodePoint(0xe0041, 0x2028)}.exe`;
  for (const args of [['inspect', arg, '--json'], ['inspect', arg]]) {
    const r = ep(s, args);
    assert.match(r.stdout, /unexpected argument/, r.stderr);
    // Line breaks are the output's own; nothing else in Unicode's control, format or separator classes may appear.
    assert.doesNotMatch(r.stdout.replace(/\n/g, ''), /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u);
    // JSON output stays valid and still says what the argument was.
    if (args.includes('--json')) assert.ok(JSON.parse(r.stdout).error.message.includes(arg));
  }
});

test('the engine runs when started through a linked folder', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const link = join(s.tmp, 'linked-engine');
  symlinkSync(join(ROOT, 'engine'), link, 'junction');
  const r = ep(s, ['help', '--json'], join(link, 'ep.mjs'));
  assert.equal(JSON.parse(r.stdout).command, 'help', r.stderr);
});
