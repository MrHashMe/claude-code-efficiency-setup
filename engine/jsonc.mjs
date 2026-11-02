// Format-preserving JSON and JSONC edits by JSON pointer (06 section 7): replace a value's text, insert a
// member before the closing brace with the file's indent and newline, cut a member or list element with its
// comma. An edit touches only the span it changes; comments around it stay where the user put them.
import { canonical, fail } from './util.mjs';

const BLANK = /^\s*$/; // \s covers the byte-order mark too

// Index of the next token after whitespace and comments.
function nextToken(text, i) {
  for (;;) {
    while (i < text.length && /\s/.test(text[i])) i++;
    if (text.startsWith('//', i)) {
      const j = text.indexOf('\n', i);
      i = j < 0 ? text.length : j + 1;
    } else if (text.startsWith('/*', i)) {
      const j = text.indexOf('*/', i + 2);
      if (j < 0) throw fail('EP-JSONC-PARSE', `unterminated comment at offset ${i}`);
      i = j + 2;
    } else return i;
  }
}

// An empty or BOM-only file reads as {}: Claude Code starts with one, and the first edit fills it.
export function parseTree(text) {
  if (BLANK.test(text)) return { type: 'object', start: 0, end: 0, members: [] };
  let i = 0;
  const n = text.length;
  const bad = (m) => {
    throw fail('EP-JSONC-PARSE', `${m} at offset ${i}`);
  };
  const skip = () => {
    i = nextToken(text, i);
  };
  const str = () => {
    const s = i++;
    while (i < n && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
    if (i >= n) bad('unterminated string');
    i++;
    return JSON.parse(text.slice(s, i));
  };
  const value = () => {
    skip();
    const start = i;
    if (text[i] === '{' || text[i] === '[') {
      const isObject = text[i] === '{';
      const close = isObject ? '}' : ']';
      i++;
      const kids = [];
      for (;;) {
        skip();
        if (text[i] === close) {
          i++;
          break;
        }
        const keyStart = i;
        let key;
        if (isObject) {
          if (text[i] !== '"') bad('expected a key');
          key = str();
          skip();
          if (text[i++] !== ':') bad('expected ":"');
        }
        const v = value();
        kids.push(isObject ? { key, start: keyStart, value: v } : v);
        skip();
        if (text[i] === ',') i++;
        else if (text[i] !== close) bad(`expected "," or "${close}"`);
      }
      return isObject ? { type: 'object', start, end: i, members: kids } : { type: 'array', start, end: i, items: kids };
    }
    if (text[i] === '"') {
      const v = str();
      return { type: 'string', start, end: i, value: v };
    }
    const m = /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i, i + 64));
    if (!m) bad('unexpected token');
    i += m[0].length;
    return { type: 'literal', start, end: i, value: JSON.parse(m[0]) };
  };
  const root = value();
  skip();
  if (i < n) bad('unexpected text after the value');
  return root;
}

export const toValue = (node) =>
  node.type === 'object'
    ? Object.fromEntries(node.members.map((m) => [m.key, toValue(m.value)]))
    : node.type === 'array'
      ? node.items.map(toValue)
      : node.value;

export const parse = (text) => toValue(parseTree(text));
export const parsePointer = (p) => (p === '' ? [] : p.replace(/^\//, '').split('/').map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~')));
export const toPointer = (segs) => '/' + segs.map((s) => String(s).replace(/~/g, '~0').replace(/\//g, '~1')).join('/');

function locate(root, segs) {
  let node = root;
  let depth = 0;
  for (let k = 0; k < segs.length; k++) {
    if (node.type !== 'object') return { node, depth, rest: segs.slice(k), blocked: true };
    const hits = node.members.filter((m) => m.key === segs[k]);
    if (hits.length > 1) throw fail('EP-JSONC-DUPLICATE', `manual edit needed: duplicate key "${segs[k]}"`);
    if (!hits.length) return { node, depth, rest: segs.slice(k) };
    node = hits[0].value;
    depth++;
  }
  return { node, depth, rest: [] };
}

export function getValue(text, pointer) {
  const { node, rest } = locate(parseTree(text), parsePointer(pointer));
  return rest.length ? undefined : toValue(node);
}

// True for an object or list with nothing in it, not even a comment.
// '' is the whole file, so a comment before or after its braces counts too.
export function isBlank(text, pointer) {
  const { node, rest } = locate(parseTree(text), parsePointer(pointer));
  const around = pointer === '' ? text.slice(0, node.start) + text.slice(node.end) : '';
  return !rest.length && (node.type === 'object' || node.type === 'array') && BLANK.test(text.slice(node.start + 1, node.end - 1)) && BLANK.test(around);
}

const eolOf = (text) => (text.includes('\r\n') ? '\r\n' : '\n');
const unitOf = (text) => /\n([ \t]+)\S/.exec(text)?.[1] ?? '  ';
const render = (value, unit, indent, eol) => JSON.stringify(value, null, unit).split('\n').join(eol + indent);

// Add `piece` as the new last child after the node that ends at `end`. A comment on that node's line stays with
// it, and a trailing comma stays last.
function appendAfter(src, end, pad, piece) {
  const m = /^(,?)([ \t]*\/\/[^\r\n]*)?/.exec(src.slice(end));
  return src.slice(0, end) + ',' + (m[2] ?? '') + pad + piece + m[1] + src.slice(end + m[0].length);
}

// Fill an object or list that has no children; whatever comments it holds stay above the new child.
function fillEmpty(src, node, piece, depth, unit, eol) {
  const inner = src.slice(node.start + 1, node.end - 1).trimEnd();
  return src.slice(0, node.start + 1) + inner + eol + unit.repeat(depth + 1) + piece + eol + unit.repeat(depth) + src.slice(node.end - 1);
}

export function setValue(text, pointer, value) {
  const segs = parsePointer(pointer);
  if (!segs.length) throw fail('EP-USAGE', 'empty JSON pointer');
  const src = BLANK.test(text) ? '{}\n' : text;
  const { node, depth, rest, blocked } = locate(parseTree(src), segs);
  if (blocked || (rest.length && node.type !== 'object')) throw fail('EP-JSONC-MANUAL', `manual edit needed: ${pointer} crosses a value that isn't an object`);
  const eol = eolOf(src);
  const unit = unitOf(src);
  if (!rest.length) return src.slice(0, node.start) + render(value, unit, unit.repeat(depth), eol) + src.slice(node.end);
  const built = rest.slice(1).reduceRight((acc, k) => ({ [k]: acc }), value);
  const member = `${JSON.stringify(rest[0])}: ${render(built, unit, unit.repeat(depth + 1), eol)}`;
  if (node.members.length) return appendAfter(src, node.members.at(-1).value.end, eol + unit.repeat(depth + 1), member);
  return fillEmpty(src, node, member, depth, unit, eol);
}

// Cut child k of an object or list with one comma and, when it sat alone on its lines, those lines. Comments
// stay. A container left with only blanks closes up to {} or [].
function cutChild(text, node, k) {
  const kids = node.type === 'object' ? node.members : node.items;
  const span = (c) => (node.type === 'object' ? [c.start, c.value.end] : [c.start, c.end]);
  const [s, end] = span(kids[k]);
  const after = nextToken(text, end);
  const comma = text[after] === ',';
  const e = comma ? after + 1 : end;
  const cuts = [];
  if (!comma && k > 0) {
    const p = nextToken(text, span(kids[k - 1])[1]); // the last child loses the comma before it
    cuts.push([p, p + 1]);
  }
  const ls = text.lastIndexOf('\n', s - 1) + 1;
  const eolAfter = /^[ \t]*\r?\n/.exec(text.slice(e));
  if (/^[ \t]*$/.test(text.slice(ls, s)) && eolAfter) cuts.push([ls, e + eolAfter[0].length]);
  else if (comma) cuts.push([s, e + /^[ \t]*/.exec(text.slice(e))[0].length]);
  else cuts.push([s - /[ \t]*$/.exec(text.slice(0, s))[0].length, e]);
  let out = text;
  for (const [a, b] of cuts.sort((x, y) => y[0] - x[0])) out = out.slice(0, a) + out.slice(b);
  const close = node.end - 1 - cuts.reduce((n, [a, b]) => n + b - a, 0);
  return BLANK.test(out.slice(node.start + 1, close)) ? out.slice(0, node.start + 1) + out.slice(close) : out;
}

export function removeValue(text, pointer) {
  const segs = parsePointer(pointer);
  const { node: obj, rest } = locate(parseTree(text), segs.slice(0, -1));
  if (rest.length || obj.type !== 'object') return text;
  const hits = obj.members.filter((m) => m.key === segs.at(-1));
  if (hits.length > 1) throw fail('EP-JSONC-DUPLICATE', `manual edit needed: duplicate key "${segs.at(-1)}"`);
  if (!hits.length) return text;
  return cutChild(text, obj, obj.members.indexOf(hits[0]));
}

// Lists in a settings file (permission rules, hook entries): add or drop one element and leave the rest of
// the list as it was written, comments and all.
export function addItem(text, pointer, value) {
  const src = BLANK.test(text) ? '{}\n' : text;
  const { node, depth, rest } = locate(parseTree(src), parsePointer(pointer));
  if (rest.length) return setValue(src, pointer, [value]);
  if (node.type !== 'array') throw fail('EP-JSONC-MANUAL', `manual edit needed: ${pointer} isn't a list`);
  if (node.items.some((x) => canonical(toValue(x)) === canonical(value))) return text;
  const eol = eolOf(src);
  const unit = unitOf(src);
  const last = node.items.at(-1);
  if (!last) return fillEmpty(src, node, render(value, unit, unit.repeat(depth + 1), eol), depth, unit, eol);
  if (!src.slice(node.start, node.end).includes('\n')) return appendAfter(src, last.end, ' ', JSON.stringify(value));
  const lead = src.slice(src.lastIndexOf('\n', last.start - 1) + 1, last.start);
  const indent = /^[ \t]*$/.test(lead) ? lead : unit.repeat(depth + 1);
  return appendAfter(src, last.end, eol + indent, render(value, unit, indent, eol));
}

export function dropItem(text, pointer, value) {
  for (let out = text; ; ) {
    const { node, rest } = locate(parseTree(out), parsePointer(pointer));
    const k = rest.length || node.type !== 'array' ? -1 : node.items.findIndex((x) => canonical(toValue(x)) === canonical(value));
    if (k < 0) return out;
    out = cutChild(out, node, k);
  }
}
