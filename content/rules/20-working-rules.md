---
id: working-rules
scopes: user, project, local
when: rules
---
- In large files, read the relevant line ranges instead of the whole file. Use the LSP tool for definitions and references when it's available.
- Use a subagent for broad searches or long logs only when a summary is all you need, and keep file references for anything you'll change.
- Check narrowly while iterating (one test or file, quiet output), then run the full acceptance checks on the final state. Report failures with the failing test names and the key error lines.
- Shorten long command output with filters, but never filter out errors or warnings.
- Do only what was asked: no unrequested features, refactors or files.
- Keep prose concise without dropping results, caveats or risks.
- If I switch to an unrelated task in a long session, suggest /clear first.
