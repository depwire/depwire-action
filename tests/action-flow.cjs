// Run the real Action entry point and CLI; replace only the GitHub API and the
// already-completed registry install. Local git fetch/checkout remain real.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const core = require('@actions/core');
const exec = require('@actions/exec');
const load = Module._load;
const posts = [], failures = [], outputs = {};
Module._load = function(id, parent, ...rest) {
  if (id === '@actions/core') return {
    ...core,
    getInput: name => ({'github-token': 'fixture', path: config.projectPath}[name] || ''),
    setFailed: message => failures.push(message),
    setOutput: (name, value) => { outputs[name] = value; }
  };
  if (id === '@actions/github') return {
    context: {repo: {owner: 'fixture', repo: 'fixture'}, payload: {pull_request: {
      number: 1, base: {sha: config.baseSha}, head: {sha: config.prSha, ref: config.branch}
    }}},
    getOctokit: () => ({rest: {issues: {
      listComments: async () => ({data: []}),
      createComment: async args => posts.push(args.body)
    }}})
  };
  if (id === '@actions/exec') return {...exec, exec: async (cmd, args, opts) => {
    if (cmd === 'npm') {
      assert.deepEqual(args, ['install', '-g', 'depwire-cli@1.21.2']);
      return 0;
    }
    return exec.exec(cmd, args, opts);
  }};
  return load.call(this, id, parent, ...rest);
};
require(config.entry);
process.on('beforeExit', () => {
  assert.deepEqual(failures, []);
  assert.equal(posts.length, 1);
  assert(posts[0].includes(config.empty ? 'nothing to analyze' : '### Impact Analysis'));
  if (!config.empty) assert.equal(typeof outputs['health-score'], 'number');
  assert(!fs.existsSync('INJECTION_MARKER'));
  fs.writeFileSync(config.result, JSON.stringify({posts, failures, outputs}, null, 2));
});
