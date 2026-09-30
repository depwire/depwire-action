# CLI integration fixture

Run as a non-root user (the unreadable-file case requires real permission denial):

```sh
npm ci
npm install -g depwire-cli@1.21.2
npm run test:integration
```

The harness compiles the Action into a temporary directory, creates a disposable
local git repository, and runs the real registry CLI. It retains generated
comments, Action logs, and captured outputs in the printed evidence directory.
Only GitHub API calls and the already-completed installation are replaced when
running the Action entry point. No real PR comments are posted. Git fetch and
checkout run against the local fixture repository.

The V2 base/PR sources reproduce the prior 1.20.2 fixture. Assertions cover:

- V2 graphs with `references-type` and `inherits`, without `extends`.
- Real lexical `$bN` IDs rendered as readable dotted paths in the comment.
- Project-relative POSIX paths and nested monorepo output discovery.
- An unreadable file yielding `failedFiles: 1` and a partial-graph warning.
- Empty parse exit 2 and a complete Action flow producing “nothing to analyze”.
- A complete Action flow on `security;touch${IFS}INJECTION_MARKER;#`, with a
  generated comment, health output, no failure, and no marker file.
- A direct CLI `diff` on the same branch, exercising the exact branch-restoration
  sink fixed in 1.21.1: the literal branch is restored and no marker is created.
  The Action itself invokes `parse`/`health` and uses argument-array git calls.

All checks passed against registry CLI 1.21.2. Output discovery and exit-code
fallbacks need no behavioral changes from the earlier PR verdict. The
[upstream changelog](https://github.com/depwire/depwire/blob/v1.21.2/CHANGELOG.md)
confirms unchanged graph format and parse contracts across 1.21.x.

Installation uses `npm install -g depwire-cli@<version>` in `src/depwire.ts`.
There is no CLI git-ref install in the Action. A clean registry install with
`--foreground-scripts` ran the SQLite dependency install but no Depwire
`prepare`/build. This matches the [npm lifecycle documentation](https://docs.npmjs.com/cli/v11/using-npm/scripts/):
`prepare` applies to git/local-source installs, not this named registry install.
