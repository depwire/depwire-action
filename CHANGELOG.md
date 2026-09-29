# Changelog

## 1.0.7

- Bump the default `depwire-cli` pin from `1.20.1` to `1.20.2`. Source paths
  are consistently project-relative with POSIX separators.
- Retain project-root output discovery: CLI 1.20.2 still writes its JSON there;
  source-path normalization is separate and requires no Action transformation.
- CLI 1.20.2 exits 2 when no files are parseable, handled as neutral
  "nothing to analyze" by the existing exit-code branch. Keep the empty-graph
  fallback for older CLI overrides; it is bypassed for the new exit code.

## 1.0.6

### Default CLI: depwire-cli 1.15.0 → 1.20.1

Raises the default `depwire-version` pin from `1.15.0` to `1.20.1`. Releases through
v1.0.4 shipped the pre-audit `1.9.2` parser, so users pinned to those versions are
jumping from `1.9.2` straight to `1.20.1`.

`1.20.1` is a remediation and accuracy release on top of `1.20.0` — dependency updates
(production advisories 10 → 0) and scanner advisory-reporting accuracy. The graph shape
is unchanged from `1.20.0` (formatVersion 2), so nothing else in the Action shifts.

What this changes in PR-impact comments:

- **More accurate blast radius, fewer phantom dependents** — the call-edge audit and
  graph fixes released in depwire-cli 1.16–1.20 remove fabricated call edges, so files
  no longer appear as affected when nothing actually depends on them.
- **Type-reference edges** (`references-type`, new in 1.17.0) are part of the graph and
  counted toward impact, so types used across files now show up as real connections.
- **TypeScript inheritance edges** are emitted as `inherits` (unified in 1.18.0); the
  action accepts both `inherits` and `extends` so older pinned versions keep working.
- **Block-scoped symbol ids** (`$bN` lexical paths, graph formatVersion 2 in 1.20.0) are
  rendered readably in the comment instead of leaking internal block paths.
- **Partial-graph warning** — when source files fail to parse, the comment now shows how
  many were excluded (per branch) instead of silently reporting on a partial graph.

### Action fixes

- `depwire parse` output is now read from the analyzed project path (1.20.0+ writes
  `depwire-output.json` next to the project root, not the working directory), fixing
  monorepo usage with the `path` input. The previous working-directory location is kept
  as a fallback for older pinned CLI versions.
- Directories with no parseable files are detected from the (now empty) graph — 1.20.0+
  exits 0 there instead of the exit code 2 the action previously relied on — so the
  neutral "nothing to analyze" comment is still posted.

### Staleness alert

A weekly scheduled workflow (`cli-staleness-alert`) compares the pinned default against
the npm `latest` dist-tag and opens or updates a single tracking issue when they differ
by a minor or more. Alert only: it never bumps the pin, publishes, or modifies the
repository. Scoped to `issues: write` with `GITHUB_TOKEN` only.

### Documentation

- README documents the default version, the `depwire-version` override, and the
  hard-pinned-per-release policy with automatic drift alerting.
