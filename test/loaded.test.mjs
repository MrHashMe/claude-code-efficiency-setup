// What a session here loads (C-9 and the loaded-file checks): instruction files past Claude Code's length
// guidance, auto memory past its load limit, files above the repository, and hidden characters.
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { gitFacts } from '../engine/scopes.mjs';
import { verify } from '../engine/verify.mjs';
import { gitRepo, sandbox } from './helpers.mjs';

const lines = (n) => Array.from({ length: n }, (_, k) => `- line ${k + 1}`).join('\n') + '\n';
const put = (p, text) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
};
const found = (ctx, code) => verify(ctx).findings.filter((f) => f.code === code);
// Built here, so no invisible character sits in this file.
const ch = (cp) => String.fromCodePoint(cp);

test('an instruction file over 200 lines is a warning; auto memory past its load limit is a note', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const repo = gitRepo(s);
  const ctx = { ...s.ctx, cwd: repo };
  s.write('CLAUDE.md', lines(200));
  assert.deepEqual(found(ctx, 'EP-SIZE-CAP'), [], '200 lines is within the guidance');
  s.write('CLAUDE.md', lines(201));
  s.write('rules/long.md', lines(201));
  put(join(repo, '.claude', 'CLAUDE.md'), lines(201));
  put(join(repo, '.claude', 'rules', 'deep', 'big.md'), lines(250));
  // The folder name is the main checkout's path with every other character than [A-Za-z0-9-] made "-".
  const key = dirname(gitFacts(repo, s.env).commonDir).replace(/[^A-Za-z0-9-]/g, '-');
  s.write(join('projects', key, 'memory', 'MEMORY.md'), 'x'.repeat(200).concat('\n').repeat(150));
  const caps = found(ctx, 'EP-SIZE-CAP').map((f) => `${f.severity} ${f.message.split(' is ')[0]}`);
  assert.deepEqual(caps.sort(), [
    `info ~/.claude/projects/${key}/memory/MEMORY.md`,
    'warn <repo>/.claude/CLAUDE.md',
    'warn <repo>/.claude/rules/deep/big.md',
    'warn ~/.claude/CLAUDE.md',
    'warn ~/.claude/rules/long.md',
  ]);
  assert.match(found(ctx, 'EP-SIZE-CAP').find((f) => f.severity === 'info').message, /is 150 lines and 30 KB; Claude Code loads only its first 200 lines or 25 KB/, 'under 200 lines, but past 25 KB');
});

test('instruction files above the repository are reported with their cost, but not the config folder\'s own', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const repo = gitRepo(s, join('home', 'work'));
  const ctx = { ...s.ctx, cwd: repo };
  s.write('CLAUDE.md', '- my own rules\n');
  writeFileSync(join(s.home, 'AGENTS.md'), '- an agents rule\n');
  writeFileSync(join(s.home, 'CLAUDE.md'), '- a rule for every repository below\n');
  const above = (c = ctx) => found(c, 'EP-ANCESTOR-INSTRUCTIONS');
  assert.equal(above().length, 1, 'AGENTS.md loads only where no CLAUDE.md does');
  assert.equal(above()[0].severity, 'info');
  assert.match(above()[0].message, /^~\/CLAUDE\.md is above the repository, so it loads into every session started under ~: about \d+ tokens each; .*claudeMdExcludes/);
  rmSync(join(s.home, 'CLAUDE.md'));
  assert.match(above()[0]?.message ?? '', /^~\/AGENTS\.md is above the repository/);
  const plain = join(s.tmp, 'plain');
  mkdirSync(plain);
  writeFileSync(join(s.tmp, 'CLAUDE.md'), '- a rule\n');
  assert.ok(above({ ...s.ctx, cwd: plain }).some((f) => /CLAUDE\.md is above this folder/.test(f.message)), 'outside a repository, the folders above the working folder');
});

test('hidden characters in loaded files are reported by file and line; a leading BOM is not', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const repo = gitRepo(s);
  const ctx = { ...s.ctx, cwd: repo };
  s.write('skills/demo/SKILL.md', `---\nname: demo${ch(0x202e)}\n---\n`);
  s.write('rules/plain.md', `${ch(0xfeff)}- a rule\n`);
  s.write('rules/mid.md', `- a rule\n- another${ch(0xfeff)}\n`);
  writeFileSync(join(repo, 'CLAUDE.local.md'), `- ok\n- also ok\n- hidden${ch(0xe0041)}${ch(0x200b)}\n`);
  const hits = found(ctx, 'EP-HIDDEN-UNICODE');
  assert.ok(hits.every((f) => f.severity === 'warn'));
  const at = (name) => hits.find((f) => f.message.includes(name)).message;
  assert.deepEqual(hits.map((f) => f.message.split(':')[0]).sort(), ['<repo>/CLAUDE.local.md line 3', '~/.claude/rules/mid.md line 2', '~/.claude/skills/demo/SKILL.md line 2']);
  assert.match(at('SKILL.md'), /\(U\+202E\)/);
  assert.match(at('mid.md'), /\(U\+FEFF\)/);
  assert.match(at('CLAUDE.local.md'), /\(U\+E0041, U\+200B\)/);
});

test('a run of variation selectors (bytes hidden after one character) is reported; one after an emoji is not', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  s.write('rules/emoji.md', `- ship it ${ch(0x2705)}${ch(0xfe0f)}\n`);
  s.write('rules/smuggled.md', `- a rule\n- tidy up${ch(0xfe01)}${ch(0xe0101)}${ch(0xe0142)}\n- ${ch(0x61c)}marked\n`);
  const hits = found(s.ctx, 'EP-HIDDEN-UNICODE');
  assert.deepEqual(hits.map((f) => f.message.split(':')[0]), ['~/.claude/rules/smuggled.md line 2 and 1 more line(s)']);
  assert.match(hits[0].message, /\(U\+FE01, U\+061C\)/);
});
