// Efficiency Playbook session-start nudge (component "nudge"): one message to the user, at most once a week, when
// the last `verify` found problems. Reads the cached summary only: no network, no engine import, no git.
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const env = process.env;
const home = (process.platform === 'win32' ? env.USERPROFILE : env.HOME) || homedir();
const root =
  env.EP_STATE_DIR ||
  (process.platform === 'win32'
    ? join(env.LOCALAPPDATA || join(home, 'AppData', 'Local'), 'efficiency-playbook')
    : join(env.XDG_STATE_HOME || join(home, '.local', 'state'), 'efficiency-playbook'));
const file = join(root, 'nudge.json');

// A missing or unreadable summary means nothing to say; session start must never fail because of this hook.
try {
  const n = JSON.parse(readFileSync(file, 'utf8'));
  if (n.count > 0 && Date.now() - (n.shownAt ?? 0) >= WEEK_MS) {
    // Saved first, so a summary that can't be saved is never shown again each session.
    writeFileSync(file, JSON.stringify({ ...n, shownAt: Date.now() }));
    // systemMessage is shown to the user and stays out of Claude's context; plain stdout would go into it.
    console.log(JSON.stringify({ systemMessage: `Efficiency Playbook: the last verify found ${n.count} problem(s), first ${n.top}. Type /efficiency-playbook:verify for details.` }));
  }
} catch {}
