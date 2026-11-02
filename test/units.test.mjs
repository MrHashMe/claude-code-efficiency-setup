// Small pure functions: JSONC editing, rule rendering and budgets, path guards, formats.
import assert from 'node:assert/strict';
import { chmodSync, linkSync, lstatSync, mkdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { BUDGET, fillCommandMap, loadFragments, renderRules } from '../engine/content.mjs';
import { pluginArgs } from '../engine/installed.mjs';
import { addItem, dropItem, getValue, isBlank, parse, parsePointer, removeValue, setValue, toPointer } from '../engine/jsonc.mjs';
import { keyOf, withConfigDir } from '../engine/owned.mjs';
import { backup } from '../engine/state.mjs';
import { WIN, atomicWrite, displayPath, isSecretPath, matchFormat, printable, readText, redact, run, samePath, textHash, tokens, versionAtLeast } from '../engine/util.mjs';
import { ROOT, sandbox } from './helpers.mjs';

const BOM = String.fromCharCode(0xfeff);

test('setValue keeps comments and order, and builds missing parents', () => {
  const text = '{\n  // keep me\n  "a": 1, /* and me */\n  "b": [1, 2]\n}\n';
  const out = setValue(text, '/c/d', true);
  assert.match(out, /\/\/ keep me/);
  assert.match(out, /\/\* and me \*\//);
  assert.deepEqual(parse(out), { a: 1, b: [1, 2], c: { d: true } });
  assert.equal(setValue(text, '/a', 2), text.replace('"a": 1', '"a": 2'), 'a replaced value changes nothing else');
});

test('removeValue takes the member and its comma', () => {
  const t = '{\n  "a": 1,\n  "b": 2\n}\n';
  assert.equal(removeValue(t, '/b'), '{\n  "a": 1\n}\n');
  assert.equal(removeValue(t, '/a'), '{\n  "b": 2\n}\n');
  assert.equal(removeValue(t, '/missing'), t);
});

test('JSONC parsing: comments and trailing commas are fine, broken text is an error', () => {
  assert.deepEqual(parse('{"a": [1,], /* x */ "b": "//not a comment",}'), { a: [1], b: '//not a comment' });
  assert.throws(() => parse('{"a": }'));
  assert.equal(getValue('{"a": {"b/c": 1}}', toPointer(['a', 'b/c'])), 1);
  assert.deepEqual(parsePointer(toPointer(['x/y', 'z~w'])), ['x/y', 'z~w']);
});

test('rules stay within each scope budget with every fragment on', () => {
  const fragments = loadFragments(ROOT);
  const all = new Set(fragments.map((f) => f.when));
  const answers = { commandMap: { quick: ['npm test -- --watch=false'], full: ['npm run check'] } };
  for (const scope of ['user', 'project', 'local']) {
    const text = renderRules(fragments, scope, all, answers);
    assert.match(text, /^# Working rules/);
    assert.ok(tokens(text) <= BUDGET[scope], `${scope}: ${tokens(text)} > ${BUDGET[scope]}`);
  }
  assert.doesNotMatch(renderRules(fragments, 'user', all, answers), /^# Commands/m, 'the command map is per repository');
  assert.equal(renderRules(fragments, 'user', new Set(['always']), answers), null, 'only the title means no file');
});

test('the command map refuses entries that could break out of the list', () => {
  for (const bad of [{ quick: ['a`b'], full: ['ok'] }, { quick: ['a\nb'], full: ['ok'] }, { quick: [], full: ['ok'] }, { quick: ['ok'], full: [' '] }]) {
    assert.throws(() => fillCommandMap('x', bad), { code: 'EP-USAGE' });
  }
});

test('credential paths are never opened', () => {
  for (const p of ['.env', '.env.local', join('.ssh', 'id_ed25519'), '.credentials.json', '.claude.json', '.claude.json.backup', join('.codex', 'auth.json'), join('gh', 'hosts.yml'), '.npmrc']) {
    assert.ok(isSecretPath(p), p);
    assert.throws(() => readText(p), { code: 'EP-SECRET-PATH' });
  }
  assert.ok(!isSecretPath('settings.json') && !isSecretPath('environment.md'));
});

test('redact masks credentials and keeps the engine\'s own fields readable', () => {
  // Built at run time, so no credential-shaped text sits in the source.
  const tok = 'Zq9' + 'x7Y'.repeat(8);
  const aws = 'AKIA' + 'Q7'.repeat(8);
  const cases = [`sk-ant-${tok}`, `ghp_${tok}`, `xoxb-${tok}`, aws, `Authorization: Bearer ${tok}`, `API_KEY=${tok}`, `{"password": "${tok}"}`, `token: ${tok}`];
  for (const text of cases) {
    const out = redact(text);
    assert.ok(!out.includes(tok) && !out.includes(aws) && out.includes('[redacted]'), out);
  }
  for (const keep of ['key:~/.claude/settings.json#/autoCompactWindow', '"key": "user-claude-abc"', '"alwaysLoadedTokens": 12', 'the API key goes in settings']) {
    assert.equal(redact(keep), keep);
  }
});

test('formats: hashes ignore BOM and CRLF, writes keep them, versions compare numerically', () => {
  assert.equal(textHash(`${BOM}a\r\nb\r\n`), textHash('a\nb\n'));
  assert.equal(matchFormat('a\nb\n', `${BOM}x\r\n`), `${BOM}a\r\nb\r\n`);
  assert.equal(matchFormat('a\nb\n', null), 'a\nb\n');
  assert.ok(versionAtLeast('2.1.309', '2.1.281') && !versionAtLeast('2.1.99', '2.1.281') && versionAtLeast('2.1.281 (Claude Code)', '2.1.281'));
  assert.equal(displayPath(join('/h', 'x', '.claude', 'a.md'), { home: join('/h', 'x') }), '~/.claude/a.md');
});

test('the command map puts commands in verbatim, whatever replacement patterns they hold', () => {
  const cmd = "echo $' $& $$";
  assert.equal(fillCommandMap('<quick>\n<full>', { quick: [cmd], full: ['ok'] }), `- \`${cmd}\`\n- \`ok\``);
});

test('a command map whose lists are not lists is a usage error, not a crash', () => {
  for (const bad of [{ quick: 'make', full: ['ok'] }, { quick: ['ok'], full: 'make' }, { quick: { length: 1 }, full: ['ok'] }, 'make', 7]) {
    assert.throws(() => fillCommandMap('x', bad), { code: 'EP-USAGE', exit: 2 });
  }
});

test('setValue keeps the comments inside an empty object and a comment trailing the last member', () => {
  const out = setValue('{\n  "hooks": {\n    // none yet\n  }\n}\n', '/hooks/Stop', [1]);
  assert.match(out, /\/\/ none yet/);
  assert.deepEqual(parse(out), { hooks: { Stop: [1] } });
  assert.equal(setValue('{\n  "a": 1 // about a\n}\n', '/b', 2), '{\n  "a": 1, // about a\n  "b": 2\n}\n');
  assert.equal(setValue('{\n  "a": 1, // about a\n}\n', '/b', 2), '{\n  "a": 1, // about a\n  "b": 2,\n}\n', 'a trailing comma stays last');
});

test('removeValue keeps the comments around the member it takes', () => {
  const t = '{\n  "a": 1, // about a\n  // about b\n  "b": 2, // after b\n  "c": 3 // about c\n}\n';
  assert.equal(removeValue(t, '/b'), '{\n  "a": 1, // about a\n  // about b\n  // after b\n  "c": 3 // about c\n}\n');
  assert.equal(removeValue('{\n  "a": 1, // about a\n  "b": 2\n}\n', '/b'), '{\n  "a": 1 // about a\n}\n');
  assert.equal(removeValue('{\n  // keep\n  "a": 1\n}\n', '/a'), '{\n  // keep\n}\n');
  assert.equal(removeValue('{\n  "a": 1\n}\n', '/a'), '{}\n', 'an object left with nothing in it closes up');
  assert.equal(removeValue('{"a": 1, "b": 2}', '/b'), '{"a": 1}');
  assert.equal(removeValue('{"a": 1, "b": 2}', '/a'), '{"b": 2}');
});

test('addItem and dropItem change one list element and leave the rest of the list as written', () => {
  const t = '{\n  "deny": [\n    // secrets\n    "Read(./.env)", // dotenv\n    "Read(./id_rsa)"\n  ]\n}\n';
  const added = addItem(t, '/deny', 'Bash(rm -rf *)');
  assert.equal(added, '{\n  "deny": [\n    // secrets\n    "Read(./.env)", // dotenv\n    "Read(./id_rsa)",\n    "Bash(rm -rf *)"\n  ]\n}\n');
  assert.equal(dropItem(added, '/deny', 'Bash(rm -rf *)'), t, 'dropping what was added gives the bytes back');
  assert.equal(dropItem(t, '/deny', 'Read(./.env)'), '{\n  "deny": [\n    // secrets\n    // dotenv\n    "Read(./id_rsa)"\n  ]\n}\n');
  assert.equal(addItem(t, '/deny', 'Read(./id_rsa)'), t, 'an element already there is not added twice');
  assert.equal(dropItem('{\n  "deny": [\n    "x"\n  ]\n}\n', '/deny', 'x'), '{\n  "deny": []\n}\n');
  assert.deepEqual(parse(addItem('{}\n', '/permissions/deny', 'x')), { permissions: { deny: ['x'] } }, 'a missing list is built');
  assert.equal(addItem('{"deny": ["a"]}', '/deny', 'b'), '{"deny": ["a", "b"]}', 'a one-line list stays on one line');
  assert.equal(addItem('{\n  "deny": [ // none yet\n  ]\n}\n', '/deny', 'x'), '{\n  "deny": [ // none yet\n    "x"\n  ]\n}\n');
  assert.throws(() => addItem('{"deny": "x"}', '/deny', 'y'), { code: 'EP-JSONC-MANUAL' });
});

test('isBlank is true only for an object or list with nothing in it', () => {
  const t = '{"a": {}, "b": [ ], "c": {/* kept */}, "d": {"e": 1}, "f": 1}';
  assert.deepEqual(['/a', '/b', '/c', '/d', '/f', '/missing'].map((p) => isBlank(t, p)), [true, true, false, false, false, false]);
});

test('isBlank for the whole file also counts what lies outside its braces', () => {
  assert.deepEqual(['{}\n', `${BOM}{ }\r\n`, '// mine\n{}\n', '{}\n/* mine */\n'].map((t) => isBlank(t, '')), [true, true, false, false]);
});

test('printable shows control and bidi characters as visible escapes, and is idempotent', () => {
  const [rlo, zwsp, lri, pdi] = [0x202e, 0x200b, 0x2066, 0x2069].map((c) => String.fromCodePoint(c));
  const raw = `ok${rlo}gnp.md \x1b[31mred\x1b[0m \x85 ${zwsp} ${lri}x${pdi} tab\tnew\nline`;
  const out = printable(raw);
  assert.equal(out, 'ok\\u{202E}gnp.md \\u{1B}[31mred\\u{1B}[0m \\u{85} \\u{200B} \\u{2066}x\\u{2069} tab\tnew\nline');
  assert.equal(printable(out), out);
  assert.equal(printable(undefined), '');
  assert.equal(printable('plain ünïcode ✓ 日本'), 'plain ünïcode ✓ 日本');
  assert.equal(printable(String.fromCodePoint(0xad, 0xfeff, 0xe0041)), '\\u{AD}\\u{FEFF}\\u{E0041}', 'soft hyphen, byte-order mark and tag characters show too');
});

test('blank JSON text reads as an empty object and takes the first edit', () => {
  for (const blank of ['', '\n', BOM, `${BOM}\r\n`]) {
    assert.deepEqual(parse(blank), {}, JSON.stringify(blank));
    assert.equal(getValue(blank, '/a'), undefined);
    assert.equal(removeValue(blank, '/a'), blank);
    assert.deepEqual(parse(setValue(blank, '/a', 1)), { a: 1 });
  }
});

test('redact also masks URL credentials, private key blocks and bare JWTs', () => {
  // Built at run time, so no credential-shaped text sits in the source.
  const tok = 'Zq9' + 'x7Y'.repeat(8);
  const pem = ['-----BEGIN RSA PRIVATE', 'KEY-----'].join(' ') + `\n${tok}\n` + ['-----END RSA PRIVATE', 'KEY-----'].join(' ');
  const jwt = ['eyJ' + 'hbGciOiJIUzI1NiJ9', 'eyJ' + 'zdWIiOiIxMjM0NTY3ODkw', 'Zq9' + 'x7Y'.repeat(5)].join('.');
  for (const [text, secret] of [[`clone https://alice:${tok}@example.com/r.git failed`, tok], [`stderr:\n${pem}\nend`, tok], [`header ${jwt} done`, jwt]]) {
    const out = redact(text);
    assert.ok(!out.includes(secret) && out.includes('[redacted]'), out);
  }
  const plain = 'see https://example.com/docs and git@github.com:owner/repo.git';
  assert.equal(redact(plain), plain);
});

test('redact covers what the bench scrub added: -u user:pw, -pSecret, quoted values, Authorization schemes, flags, //user:pw@', () => {
  for (const [text, secret] of [
    ['curl -u admin:s3cret https://x.test', 's3cret'],
    ['curl --user admin:s3cret https://x.test', 's3cret'],
    ['mysql -u root -pHunter2 db', 'Hunter2'],
    ['PASSWORD="my secret zebra" run', 'zebra'],
    ['export DB_TOKEN=\'two words\' && go', 'words'],
    ['{"credential": "tw0 w0rds"}', 'w0rds'],
    ['curl -H "Authorization: Basic dXNlcjpwdw==" x', 'dXNlcjpwdw'],
    ['tool --auth abc123 go', 'abc123'],
    ['tool --api_key abc123 go', 'abc123'],
    ['tool --api-key=abc123 go', 'abc123'],
    ['curl -H "X-Api-Key: abc123" x', 'abc123'],
    ['git clone https://user:tok3n@host.test/x', 'tok3n'],
    ['fetch //alice:tok3n@host.test/x', 'tok3n'],
  ]) {
    assert.ok(!redact(text).includes(secret), `${text} -> ${redact(text)}`);
  }
  for (const plain of ['git push -u origin main', 'mkdir -p out && find . -print', 'npm test -- --token-file x', 'curl https://example.test/a/b?c=d', 'see //comment and a@b']) {
    assert.equal(redact(plain), plain);
  }
});

test('redact takes about as long for a long adversarial text as for a short one', () => {
  const size = 100000;
  const repeat = (unit) => unit.repeat(Math.ceil(size / unit.length));
  const shapes = {
    'names joined by dots': repeat('a.'),
    'underscored names joined by dots': repeat('_.'),
    'scheme characters that are not name characters': repeat('a+'),
    'JWT starts joined by dashes': repeat('eyJ-'),
    'dashes only': '-'.repeat(size),
    'blanks after a keyword': 'token' + ' '.repeat(size),
    'every keyword shape in a row': repeat('Authorization: token="x" --auth -u mysql -p Bearer sk- ://u: //a: '),
  };
  for (const [name, text] of Object.entries(shapes)) {
    const started = performance.now();
    redact(text);
    const ms = performance.now() - started;
    assert.ok(ms < 1000, `${name}: ${Math.round(ms)} ms for ${text.length} characters`);
  }
});

test('atomicWrite writes through a symlink instead of replacing it', (t) => {
  const s = sandbox(t);
  const real = join(s.tmp, 'dotfiles-settings.json');
  const link = join(s.tmp, 'settings.json');
  writeFileSync(real, '{}\n');
  try {
    symlinkSync(real, link);
  } catch (e) {
    if (e.code === 'EPERM') return t.skip('creating a symlink needs a privilege here');
    throw e;
  }
  atomicWrite(link, '{"a": 1}\n');
  assert.ok(lstatSync(link).isSymbolicLink(), 'the link is still a link');
  assert.equal(readFileSync(real, 'utf8'), '{"a": 1}\n');
});

test('atomicWrite keeps the file mode', { skip: WIN }, (t) => {
  const s = sandbox(t);
  const f = join(s.tmp, 'private.json');
  writeFileSync(f, '{}\n');
  chmodSync(f, 0o600);
  atomicWrite(f, '{"a": 1}\n');
  assert.equal(statSync(f).mode & 0o777, 0o600);
});

test('atomicWrite refuses a file that is not valid UTF-8, and leaves its bytes alone', (t) => {
  const s = sandbox(t);
  const f = join(s.tmp, 'latin1.json');
  const bytes = Buffer.from([0x7b, 0x22, 0xe9, 0x22, 0x3a, 0x31, 0x7d, 0x0a]);
  writeFileSync(f, bytes);
  assert.throws(() => atomicWrite(f, '{}\n'), (e) => e.code === 'EP-NOT-UTF8' && e.message.includes(f));
  assert.deepEqual(readFileSync(f), bytes);
});

test('atomicWrite never writes into a file planted at its temporary name', (t) => {
  const s = sandbox(t);
  const dest = join(s.tmp, 'efficiency-playbook.md');
  const victim = join(s.tmp, 'victim.txt');
  writeFileSync(victim, 'keep me\n');
  // A repository can commit a symlink at the name a writer would pick; a hard link stands in for it, since it needs
  // no privilege on Windows.
  linkSync(victim, `${dest}.ep-${process.pid}.tmp`);
  atomicWrite(dest, '# rules\n');
  assert.equal(readFileSync(victim, 'utf8'), 'keep me\n');
  assert.equal(readFileSync(dest, 'utf8'), '# rules\n');
});

test('a backup of a symlinked file holds its bytes, so a write through the link leaves the backup alone', (t) => {
  const s = sandbox(t);
  const real = join(s.tmp, 'dotfiles-settings.json');
  const link = join(s.tmp, 'settings.json');
  writeFileSync(real, '{"mine": 1}\n');
  try {
    symlinkSync(real, link);
  } catch (e) {
    if (e.code === 'EPERM') return t.skip('creating a symlink needs a privilege here');
    throw e;
  }
  const saved = backup({ dir: join(s.tmp, 'state') }, 'j1', 'r01', link);
  atomicWrite(link, '{}\n');
  assert.ok(!lstatSync(saved).isSymbolicLink(), 'the backup is a file, not a second link');
  assert.equal(readFileSync(saved, 'utf8'), '{"mine": 1}\n');
});

test('a plugin id read back from a journal or state file is name@marketplace before anything runs or is shown', () => {
  assert.deepEqual(pluginArgs({ plugin: 'ponytail@ponytail' }, 'user', true), ['plugin', 'install', 'ponytail@ponytail', '--scope', 'user']);
  for (const plugin of ['--help', '-x@y', 'a@b --scope project', 'a@b;calc', 'ponytail', '', undefined]) {
    assert.throws(() => pluginArgs({ plugin }, 'user', false), { code: 'EP-PLUGIN-ID' }, String(plugin));
  }
});

test('item keys for a path outside the home and the repository ignore letter case where the file system does', { skip: !(WIN || process.platform === 'darwin') }, () => {
  const sc = { home: join('/nowhere', 'home'), repo: null };
  assert.equal(keyOf(sc, { kind: 'file', target: join('/Elsewhere', 'Foo.md') }), keyOf(sc, { kind: 'file', target: join('/elsewhere', 'foo.md') }));
});

test('a config folder name with replacement patterns is written into settings verbatim', () => {
  const dir = "/tmp/a$'b$&c$$d";
  assert.deepEqual(withConfigDir({ path: '<configDir>/hooks', n: 1 }, dir), { path: `${dir}/hooks`, n: 1 });
});

test('a program the engine starts runs from the home folder unless a folder is given', (t) => {
  const s = sandbox(t);
  const where = (opts) => run(process.execPath, ['-p', 'process.cwd()'], { env: s.env, ...opts }).stdout.trim();
  assert.ok(samePath(where({}), s.home), 'a repository the user stands in is not where tools start');
  assert.ok(samePath(where({ cwd: s.tmp }), s.tmp));
});

test('a link to a credential folder is still a credential path', (t) => {
  const s = sandbox(t);
  mkdirSync(join(s.home, '.ssh'));
  writeFileSync(join(s.home, '.ssh', 'id_rsa'), 'not a real key\n');
  const link = join(s.tmp, 'docs');
  try {
    symlinkSync(join(s.home, '.ssh'), link, 'junction');
  } catch (e) {
    return t.skip(`no link rights here: ${e.code}`);
  }
  assert.throws(() => readText(join(link, 'id_rsa')), { code: 'EP-SECRET-PATH', exit: 3 });
  assert.throws(() => atomicWrite(join(link, 'id_rsa'), 'x'), { code: 'EP-SECRET-PATH' });
});
