// Owned text: fragments in content/rules with frontmatter (id, scopes, when), rendered per scope in
// file-name order. A fragment is included or not; the command map is the one filled template.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fail, normalize, readText } from './util.mjs';

export const BUDGET = { user: 600, project: 700, local: 700 };

export function loadFragments(root) {
  const dir = join(root, 'content', 'rules');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((file) => {
      const text = normalize(readText(join(dir, file)));
      const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
      if (!m) throw fail('EP-CONTENT', `content/rules/${file}: missing frontmatter`);
      const meta = Object.fromEntries(m[1].split('\n').map((line) => [line.slice(0, line.indexOf(':')).trim(), line.slice(line.indexOf(':') + 1).trim()]));
      if (!meta.id || !meta.scopes || !meta.when) throw fail('EP-CONTENT', `content/rules/${file}: frontmatter needs id, scopes and when`);
      return { file, id: meta.id, scopes: meta.scopes.split(/,\s*/), when: meta.when, body: text.slice(m[0].length).trim() };
    });
}

const bullets = (cmds) => cmds.map((c) => `- \`${c}\``).join('\n');

export function fillCommandMap(body, map) {
  if (!Array.isArray(map?.quick) || !Array.isArray(map?.full) || !map.quick.length || !map.full.length) {
    throw fail('EP-USAGE', 'the command map needs a list with at least one quick check and a list with one full acceptance command', { exit: 2 });
  }
  for (const c of [...map.quick, ...map.full]) {
    if (typeof c !== 'string' || !c.trim() || /[`\r\n]/.test(c)) throw fail('EP-USAGE', `command-map entries must be one-line commands without backticks: ${JSON.stringify(c)}`, { exit: 2 });
  }
  // A function, so "$'" and "$&" in a command are text, not replacement patterns.
  return body.replace(/<(quick|full)>/g, (_, k) => bullets(map[k]));
}

export const fragmentText = (f, answers = {}) => (f.id === 'command-map' ? fillCommandMap(f.body, answers.commandMap) : f.body);

// Null when only always-on headings would be written: no file beats an empty one. Fragments in skip are
// left out because another scope already loads them (S-2).
export function renderRules(fragments, scope, enabled, answers = {}, skip = new Set()) {
  const picked = fragments.filter((f) => f.scopes.includes(scope) && (f.when === 'always' || (enabled.has(f.when) && !skip.has(f.id))));
  if (!picked.some((f) => f.when !== 'always')) return null;
  return picked.map((f) => fragmentText(f, answers)).join('\n\n') + '\n';
}

// 06 section 5: on upgrade the engine re-renders the template around the commands the user confirmed.
export function readCommandMap(text) {
  const m = /(?:^|\n)# Commands\nQuick checks while iterating:\n([\s\S]*?)\n\nFull acceptance before you finish:\n([\s\S]*?)(?:\n\n|\n?$)/.exec(normalize(text ?? ''));
  if (!m) return null;
  const list = (s) => s.split('\n').map((line) => /^- `(.+)`$/.exec(line)?.[1]).filter(Boolean);
  return { quick: list(m[1]), full: list(m[2]) };
}
