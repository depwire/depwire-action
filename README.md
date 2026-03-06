# Depwire PR Impact Analysis

> GitHub Action that analyzes dependency changes, health score delta, and architecture impact on every pull request.

[![GitHub Action](https://img.shields.io/badge/GitHub-Action-blue?logo=github-actions)](https://github.com/marketplace/actions/depwire-pr-impact)
[![License: BSL 1.1](https://img.shields.io/badge/License-BSL%201.1-blue.svg)](LICENSE)

## What It Does

When a developer opens or updates a PR, this action:

1. **Compares base branch to PR branch** — shows exactly what changed
2. **Analyzes dependency impact** — identifies high-risk file modifications
3. **Calculates health score delta** — shows if code quality improved or degraded
4. **Posts a detailed comment** — clean, formatted markdown report on the PR

Every PR gets automatic dependency intelligence — no manual analysis required.

## Quick Start

Create `.github/workflows/depwire.yml`:

```yaml
name: Depwire PR Impact
on:
  pull_request:
    branches: [main]

jobs:
  depwire:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # Required for base branch comparison
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - uses: depwire/depwire-action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

That's it! The action will post a comment on every PR showing:

- Files added, removed, modified
- Symbols and edges added/removed
- Health score before/after with deltas per dimension
- Impact analysis: which files are risky to change
- New dependencies introduced by the PR

## Example Comment

<img width="800" alt="Depwire PR Comment Example" src="https://github.com/depwire/depwire-action/assets/example-comment.png">

_(Screenshot shows: summary table, health breakdown, files changed, impact analysis, new dependencies)_

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token for posting PR comments | Yes | `${{ github.token }}` |
| `path` | Path to the project to analyze (relative to repo root) | No | `.` |
| `depwire-version` | Version of `depwire-cli` to use | No | `latest` |
| `show-diagram` | Include arc diagram in PR comment | No | `true` |
| `fail-on-score-drop` | Fail the action if health score drops by more than this amount | No | `0` |
| `comment-header` | Custom header for the PR comment | No | `## 🔍 Depwire PR Impact Analysis` |

## Outputs

| Output | Description |
|--------|-------------|
| `health-score` | Current health score (0-100) |
| `health-grade` | Current health grade (A-F) |
| `health-delta` | Change in health score from base branch |
| `files-changed` | Total number of files added, removed, or modified |

## Advanced Usage

### Fail PR if Health Score Drops

Enforce a minimum health score threshold:

```yaml
- uses: depwire/depwire-action@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    fail-on-score-drop: 5
```

If the health score drops by more than 5 points, the action will fail and block the PR.

### Monorepo: Analyze Specific Package

For monorepos, analyze a specific subdirectory:

```yaml
- uses: depwire/depwire-action@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    path: packages/backend
```

### Pin Depwire Version

Lock to a specific version of `depwire-cli`:

```yaml
- uses: depwire/depwire-action@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    depwire-version: '1.2.3'
```

### Use Outputs in Subsequent Steps

Access the outputs in later steps:

```yaml
- uses: depwire/depwire-action@v1
  id: depwire
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}

- name: Check health score
  run: |
    echo "Health score: ${{ steps.depwire.outputs.health-score }}"
    echo "Grade: ${{ steps.depwire.outputs.health-grade }}"
    echo "Delta: ${{ steps.depwire.outputs.health-delta }}"
```

## How It Works

1. **Checkout PR branch** — analyze current state
2. **Checkout base branch** — analyze before state
3. **Run `depwire parse --json`** on both branches
4. **Run `depwire health --json`** on both branches
5. **Compute diff** — identify added/removed/modified files, symbols, edges
6. **Analyze impact** — flag high-risk file modifications (20+ connections)
7. **Build comment** — format results as clean markdown
8. **Post or update comment** — don't create duplicates on subsequent pushes

## What Is Depwire?

[Depwire](https://depwire.dev) is a **dependency intelligence tool** for modern codebases.

It parses your code (TypeScript, JavaScript, Python, Go), builds a cross-reference graph, and calculates a **health score** across 6 dimensions:

- **Coupling** — how tightly connected your modules are
- **Cohesion** — how focused each file is
- **Circular Dependencies** — import cycles that create fragility
- **God Files** — oversized files that do too much
- **Orphan Files** — disconnected code that may be dead
- **Depth** — how many layers deep your dependency tree goes

Depwire is designed for **AI coding tools** — it gives AI agents the context they need to understand your architecture before making changes.

## Local Usage

Install `depwire-cli` locally to run the same analysis on your machine:

```bash
npm install -g depwire-cli

depwire parse .
depwire health .
depwire impact src/auth/index.ts
depwire viz .
```

See [github.com/depwire/depwire](https://github.com/depwire/depwire) for full documentation.

## License

This action is licensed under the [Business Source License 1.1](LICENSE).

Free for:
- Personal use
- Open source projects
- Companies with <$1M annual revenue

Paid license required for larger commercial use. See [depwire.dev/pricing](https://depwire.dev/pricing).

## Support

- **Issues**: [github.com/depwire/depwire-action/issues](https://github.com/depwire/depwire-action/issues)
- **Discussions**: [github.com/depwire/depwire/discussions](https://github.com/depwire/depwire/discussions)
- **Twitter**: [@depwire](https://twitter.com/depwire)

---

<sub>Built by [Atef Ataya](https://github.com/atefataya) — Powered by [Depwire](https://depwire.dev)</sub>
