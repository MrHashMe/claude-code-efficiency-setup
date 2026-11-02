// The trust gate (M-9). Headless runs skip Claude Code's workspace-trust prompt, so before bench validates or runs anything it lists what the
// repository and the arms make it execute or apply, and goes on only when a fresh random code from that prompt is typed back at a terminal.
// Nothing is stored or remembered, and no flag, variable or file stands in for the typing. Residual risk: an agent that drives a
// pseudo-terminal can still answer, so the refusal inside agent sessions stays the first layer.
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fail, git, scrub, sha, unBom } from './io.mjs';

const MAX_VALUE = 2000, MAX_LINES = 2000;
const CONFIG_LIKE = /(^|\/)(\.claude\/|(CLAUDE|AGENTS)(\.local)?\.md$|\.mcp\.json$)/;
// Claude Code's two forms of a command in markdown (a block that is never closed is listed too), and where a YAML anchor, alias or tag starts a node.
const BLOCK = /```!\s*\n?([\s\S]*?)(?:\n?```|$)/g, INLINE = /!`([^`]+)`/g, NODE = /(?:^\s*|[:?-]\s+|[\[{,]\s*)[&*!]\S/;
// Everything that prints as nothing or as a blank: controls, format and invisible marks (Hangul fillers, variation selectors), line separators,
// the Braille blank and every space but the plain one. Built from the code point so that no invisible character sits in this file.
const ODD = new RegExp(String.raw`[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Variation_Selector}\p{Default_Ignorable_Code_Point}${String.fromCodePoint(0x2800)}]|(?! )\p{Zs}`, 'gu');
const NOTE = 'Bench is not a sandbox: the agent and these commands run with your full user rights, in scratch clones of the repository. For a repository you don\'t trust, use WSL or a dev container.';

// Reads one line from a terminal: all of the text but its last line is printed first, the last line is the prompt. null at the end of input.
export function terminalAsk(text, input = process.stdin, output = process.stderr) {
  const cut = text.lastIndexOf('\n') + 1;
  output.write(text.slice(0, cut));
  const rl = readline.createInterface({ input, output, terminal: false });
  return new Promise((resolve) => {
    rl.once('line', (line) => { resolve(line); rl.close(); });
    rl.once('close', () => resolve(null));
    rl.setPrompt(text.slice(cut));
    rl.prompt();
  });
}

const plain = (text) => String(text).replace(ODD, (ch) => {
  const n = ch.codePointAt(0);
  return n > 0xffff ? `\\u{${n.toString(16)}}` : `\\u${n.toString(16).padStart(4, '0')}`;
});
const groupBy = (items, pick, label) => {
  const by = new Map();
  for (const x of items) if (pick(x) != null) by.set(pick(x), [...(by.get(pick(x)) ?? []), label(x)]);
  return by;
};
// A JSON value as `path = value` calls. A server's args read as one command line, so a flag stays beside its value.
function flat(x, p, emit) {
  if (!x || typeof x !== 'object') return emit(p, x);
  if (p.endsWith('.args') && Array.isArray(x) && x.every((a) => typeof a === 'string')) return emit(p, x.join(' '));
  const kids = Array.isArray(x) ? x.map((y, i) => [`[${i}]`, y])
    : Object.entries(x).map(([key, y]) => [/^[\w$-]+$/.test(key) ? `${p ? '.' : ''}${key}` : `[${JSON.stringify(key)}]`, y]);
  if (!kids.length) return emit(p, Array.isArray(x) ? '[]' : '{}');
  for (const [suffix, y] of kids) flat(y, p + suffix, emit);
}

// Lines for a person to read. Every part of a line goes through v(): control and invisible characters become \uXXXX escapes, and a part
// longer than MAX_VALUE is replaced by its length and sha256 and counted, never cut. The line is then scrubbed of secrets without hiding code.
function sink() {
  const s = { out: [], over: 0, hidden: 0 };
  s.push = (line) => (s.out.length < MAX_LINES ? s.out.push(scrub(plain(line), true)) : s.over++);
  s.v = (x) => {
    const text = typeof x === 'string' ? x : JSON.stringify(x), shown = plain(text);
    if (shown.length <= MAX_VALUE) return shown;
    s.hidden++;
    return `<${text.length} characters, sha256 ${sha(text)}, NOT SHOWN>`;
  };
  s.json = (who, rel, data) => flat(data, '', (p, x) => s.push(`${who} ${s.v(rel)}: ${s.v(p)} = ${s.v(x)}`));
  return s;
}

// JSON is shown key by key (text that doesn't parse is shown as text, never skipped). Markdown shows every front matter line and every command
// it runs when invoked, found the way Claude Code finds them and wider: Claude ends front matter at the first --- anywhere in the text, a YAML
// loader at the first line that is only ---, so lines up to either are shown; where the two disagree, or YAML anchors, aliases or tags could
// make a line mean something else, the file is marked UNCHECKED and counted with the parts typing the code accepts as they are.
function describe(s, who, rel, text, json = /\.json$/i.test(rel)) {
  if (json) {
    let data;
    try {
      data = JSON.parse(unBom(text));
    } catch {
      return s.push(`${who} ${s.v(rel)}: not valid JSON, shown as text: ${s.v(text)}`);
    }
    return s.json(who, rel, data);
  }
  const src = unBom(text), ls = src.split(/\r\n|\r|\n/), find = (test) => ls.findIndex((l, i) => i > 0 && test(l)); // YAML reads a lone CR as a line break
  const open = ls[0].trim() === '---', only = open ? find((l) => l.trim() === '---') : -1, first = open ? find((l) => l.includes('---')) : -1;
  const head = open ? ls.slice(1, only >= 0 ? only : first >= 0 ? first + 1 : ls.length) : [];
  for (const l of head) if (l.trim()) s.push(`${who} ${s.v(rel)} front matter: ${s.v(l.trimEnd())}`);
  const doubt = first >= 0 && first !== only ? 'a closing --- that is not alone on its line' : head.some((l) => NODE.test(l)) ? 'YAML anchors, aliases or tags' : '';
  if (doubt) {
    s.hidden++;
    s.push(`${who} ${s.v(rel)} front matter has ${doubt}, so what it sets can't be read off the lines above: UNCHECKED`);
  }
  for (const [, cmd] of [...src.matchAll(BLOCK), ...src.matchAll(INLINE)]) s.push(`${who} ${s.v(rel)} runs when invoked: ${s.v(cmd)}`);
}

// A folder or file on disk, links named and not followed.
function walk(s, who, root, rel, note) {
  const abs = path.join(root, rel), st = fs.lstatSync(abs, { throwIfNoEntry: false });
  if (!st) return;
  if (st.isSymbolicLink()) return s.push(`${who}: ${s.v(rel)} is a link to ${s.v(fs.readlinkSync(abs))} (${note})`);
  if (st.isDirectory()) return fs.readdirSync(abs).sort().forEach((n) => walk(s, who, root, rel ? `${rel}/${n}` : n, note));
  s.push(`${who}: ${s.v(rel)}`);
  if (/\.(json|md)$/i.test(rel)) describe(s, who, rel, fs.readFileSync(abs, 'utf8'));
}

// Configuration at each task's base commit that today's tree doesn't replace (a nested .claude folder, an old CLAUDE.md), once per distinct file.
function baseConfig(s, k, tasks) {
  const found = new Map(), covered = (rel) => k.configFiles.some((f) => rel === f || rel.startsWith(`${f}/`));
  for (const base of new Set(tasks.map((t) => t.base)))
    for (const rec of git(k.env, k.repo, 'ls-tree', '-r', '-z', base).split('\0')) {
      const m = /^(\d+) (\w+) (\w+)\t([\s\S]+)$/.exec(rec);
      if (!m || m[2] !== 'blob' || !CONFIG_LIKE.test(m[4]) || covered(m[4])) continue;
      const key = `${m[4]}\0${m[3]}`;
      found.set(key, { mode: m[1], blob: m[3], rel: m[4], commits: [...(found.get(key)?.commits ?? []), base.slice(0, 10)] });
    }
  for (const e of found.values()) {
    const who = `base ${e.commits.join(', ')}`, blob = () => git(k.env, k.repo, 'cat-file', 'blob', e.blob);
    if (e.mode === '120000') s.push(`${who}: ${s.v(e.rel)} is a link to ${s.v(blob())} (a committed link)`);
    else {
      s.push(`${who}: ${s.v(e.rel)}`);
      if (/\.(json|md)$/i.test(e.rel)) describe(s, who, e.rel, blob());
    }
  }
}

function armLines(s, plan) {
  const arms = (pick) => groupBy(plan.arms, pick, (a) => a.name);
  for (const [file, names] of arms((a) => a.settings)) describe(s, `arm ${names.join(', ')}`, 'settings', fs.readFileSync(file, 'utf8'), true);
  for (const [dir, names] of arms((a) => a.pluginDir)) walk(s, `arm ${names.join(', ')} plugin`, dir, '', 'NOT SCANNED, claude follows it');
  for (const [text, names] of arms((a) => a.append)) s.push(`arm ${names.join(', ')} appended system prompt: ${s.v(text)}`);
  for (const [file, names] of arms((a) => a.appendFile)) s.push(`arm ${names.join(', ')} appended system prompt from ${s.v(file)}: ${s.v(fs.readFileSync(file, 'utf8'))}`);
  s.push(`every run: permission mode = ${s.v(plan.permissionMode)}`);
  s.push(`every run: pre-approved tools (not a limit on what the agent can do): ${s.v(plan.allowedTools.join(', ') || 'none')}`);
  if (Object.keys(plan.mcpConfig?.mcpServers ?? {}).length) s.json('arms.json', 'mcpConfig', plan.mcpConfig);
}

// plan is null for validate, which runs only the tasks' own commands.
export function listing(k, tasks, plan) {
  const s = sink();
  for (const kind of ['prepare', 'accept'])
    for (const [cmd, ids] of groupBy(tasks, (t) => t[kind], (t) => t.id)) s.push(`task ${kind} command (tasks ${ids.join(', ')}): ${s.v(cmd)}`);
  if (plan) {
    for (const rel of k.configFiles) walk(s, 'project', k.repo, rel, 'NOT COPIED');
    baseConfig(s, k, tasks);
    armLines(s, plan);
  }
  if (s.over) s.out.push(`... ${s.over} more lines NOT SHOWN`);
  return { out: s.out, hidden: s.hidden + s.over };
}

export async function confirmRun(c, k, tasks, plan) {
  const what = plan ? 'run' : 'validate', ask = c.ctx.ask ?? (process.stdin.isTTY ? terminalAsk : null);
  if (!ask) throw fail('EP-BENCH-CONFIRM-TERMINAL', `bench ${what} lists what it will execute and goes on only when you type a code back, which needs a terminal on stdin, and this isn't one: run it in a terminal you opened yourself`, 3);
  const { out, hidden } = listing(k, tasks, plan), code = randomBytes(3).toString('hex');
  const head = plan ? 'Headless runs skip Claude Code\'s workspace-trust prompt, so check what this repository and the arms make every run execute or apply:'
    : 'bench validate runs these commands, and the scripts they start, on the repository\'s history:';
  const text = [head, '', ...out, '', NOTE, ...(hidden ? [`${hidden} part(s) above are too long to show or can't be checked (marked NOT SHOWN or UNCHECKED): typing the code accepts them as they are.`] : []),
    `Type ${code} to continue, anything else to stop: `].join('\n');
  if (String(await ask(text) ?? '').trim().toLowerCase() !== code) throw fail('EP-BENCH-NOT-CONFIRMED', 'stopped: the code was not typed back, so nothing was run', 3);
}
