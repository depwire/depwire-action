// Requires an installed depwire-cli@1.21.2 on PATH. No GitHub requests are sent.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'depwire-action-v2-'));
const compiled = path.join(tmp, 'compiled');
const repo = path.join(tmp, 'repo');
function run(cmd, args, cwd = repo) {
  return cp.execFileSync(cmd, args, {cwd, timeout: 120000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
}
function git(...args) { return run('git', args); }
function check(message) { console.log(`PASS: ${message}`); }
async function main() {
  assert.match(run('depwire', ['--version'], root), /\b1\.21\.2\b/);
  run(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--outDir', compiled], root);
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(compiled, 'node_modules'), 'dir');
  const {runParse, runHealth} = require(path.join(compiled, 'depwire.js'));
  const {computeDiff} = require(path.join(compiled, 'diff.js'));
  const {analyzeImpact} = require(path.join(compiled, 'impact.js'));
  const {buildComment} = require(path.join(compiled, 'comment.js'));
  fs.mkdirSync(repo);
  process.chdir(repo);
  git('init', '-b', 'base');
  git('config', 'user.name', 'Integration fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  fs.writeFileSync('.gitignore', '.depwire/\ndepwire-output.json\nINJECTION_MARKER\n');
  fs.cpSync(path.join(__dirname, 'fixtures/v2/base'), repo, {recursive: true});
  git('add', '.'); git('commit', '-m', 'base fixture');
  const baseSha = git('rev-parse', 'HEAD');
  const base = await runParse('.');
  const baseHealth = await runHealth('.');
  // Valid git ref; shell interpolation would run the harmless marker command.
  const branch = 'security;touch${IFS}INJECTION_MARKER;#';
  git('checkout', '-b', branch);
  fs.cpSync(path.join(__dirname, 'fixtures/v2/pr'), repo, {recursive: true});
  git('add', '.'); git('commit', '-m', 'PR fixture');
  const prSha = git('rev-parse', 'HEAD');
  const pr = await runParse('.');
  const prHealth = await runHealth('.');
  assert.equal(pr.graph.formatVersion, 2);
  const kinds = new Set(pr.graph.edges.map(e => e.kind));
  assert(kinds.has('references-type') && kinds.has('inherits') && !kinds.has('extends'));
  assert(pr.graph.nodes.some(n => /\$b\d/.test(n.id)));
  for (const p of [...pr.graph.files, ...pr.graph.nodes.map(n => n.filePath), ...pr.graph.edges.map(e => e.filePath)]) {
    assert(!path.isAbsolute(p) && !p.includes('\\') && fs.existsSync(p), p);
  }
  const diff = computeDiff(base.graph, pr.graph, baseHealth, prHealth);
  const comment = buildComment(diff, analyzeImpact(diff, pr.graph), '## V2 fixture', {pr: pr.failedFiles, base: base.failedFiles});
  assert(comment.includes('### Impact Analysis') && comment.includes('inherits') && comment.includes('references-type'));
  assert(!/\$b\d/.test(comment) && comment.includes('blockDependency.nested'));
  assert.equal(pr.failedFiles, 0); assert.equal(base.failedFiles, 0);
  fs.writeFileSync(path.join(tmp, 'comment.md'), comment);
  check(`V2 comment; kinds=${[...kinds].join(',')}; real $bN IDs rendered readably; source paths resolve`);

  fs.mkdirSync('packages/backend', {recursive: true});
  fs.writeFileSync('packages/backend/util.ts', 'export function id(x: string): string { return x; }\n');
  const mono = await runParse('packages/backend');
  assert.deepEqual(mono.graph.files, ['util.ts']);
  assert(mono.graph.nodes.every(n => n.filePath === 'util.ts'));
  assert(fs.existsSync(path.join('packages/backend', mono.graph.files[0])));
  check('monorepo packages/backend output found; util.ts resolves against project root');
  fs.rmSync('packages', {recursive: true});

  const unreadable = path.join(tmp, 'unreadable');
  fs.mkdirSync(unreadable);
  fs.writeFileSync(path.join(unreadable, 'ok.ts'), 'export const ok = 1;\n');
  const bad = path.join(unreadable, 'bad.ts');
  fs.writeFileSync(bad, 'export const bad = 1;\n'); fs.chmodSync(bad, 0);
  try {
    assert.throws(() => fs.readFileSync(bad), /EACCES/, 'run fixture as a non-root user');
    const partial = await runParse(unreadable);
    assert.equal(partial.failedFiles, 1);
    const partialDiff = computeDiff(base.graph, partial.graph, baseHealth, prHealth);
    const partialComment = buildComment(partialDiff, analyzeImpact(partialDiff, partial.graph), '## fixture', {pr: partial.failedFiles, base: 0});
    assert(partialComment.includes('**Partial graph**') && partialComment.includes('1 on this branch'));
    fs.writeFileSync(path.join(tmp, 'partial-comment.md'), partialComment);
    check('unreadable file: failedFiles=1 and partial-graph comment warning');
  } finally { fs.chmodSync(bad, 0o644); }

  const empty = path.join(tmp, 'empty'); fs.mkdirSync(empty);
  assert.equal(cp.spawnSync('depwire', ['parse', empty]).status, 2);
  assert.deepEqual(await runParse(empty), {status: 'no_parseable_files'});
  assert.deepEqual(await runHealth(empty), {status: 'no_parseable_files'});
  check('empty directory: raw parse exit=2; parse/health return neutral status');

  // Exercise the upstream vulnerability's actual sink, not just parse/health.
  run('depwire', ['diff', baseSha, prSha]);
  assert.equal(git('branch', '--show-current'), branch);
  assert(!fs.existsSync('INJECTION_MARKER'));
  check(`CLI diff restored literal branch ${branch}; no marker executed`);
  git('remote', 'add', 'origin', repo);
  for (const [name, projectPath, isEmpty] of [['crafted-branch', '.', false], ['empty', empty, true]]) {
    git('checkout', branch);
    const config = path.join(tmp, `${name}.json`);
    const result = path.join(tmp, `${name}-result.json`);
    fs.writeFileSync(config, JSON.stringify({entry: path.join(compiled, 'index.js'), projectPath, empty: isEmpty, baseSha, prSha, branch, result}));
    const log = run(process.execPath, [path.join(__dirname, 'action-flow.cjs'), config]);
    fs.writeFileSync(path.join(tmp, `${name}.log`), log);
    assert(fs.existsSync(result));
    assert(!fs.existsSync('INJECTION_MARKER'));
    check(`complete Action ${name} flow: comment generated, no failure, no marker (GitHub API mocked)`);
  }
  console.log(`Evidence: ${tmp}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
