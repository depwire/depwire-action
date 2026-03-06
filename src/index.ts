import * as core from '@actions/core';
import * as github from '@actions/github';
import * as exec from '@actions/exec';
import { installDepwire, runParse, runHealth } from './depwire';
import { computeDiff } from './diff';
import { analyzeImpact } from './impact';
import { buildComment } from './comment';

async function findExistingComment(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number,
  header: string
): Promise<number | null> {
  try {
    const comments = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber
    });
    
    const existing = comments.data.find((c: any) => c.body?.startsWith(header));
    return existing?.id ?? null;
  } catch (error) {
    core.warning(`Failed to list comments: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token', { required: true });
    const projectPath = core.getInput('path') || '.';
    const depwireVersion = core.getInput('depwire-version') || 'latest';
    const failOnScoreDrop = parseInt(core.getInput('fail-on-score-drop') || '0', 10);
    const commentHeader = core.getInput('comment-header') || '## 🔍 Depwire PR Impact Analysis';
    
    const octokit = github.getOctokit(token);
    const { owner, repo } = github.context.repo;
    const prNumber = github.context.payload.pull_request?.number;
    
    if (!prNumber) {
      core.warning('Not a pull request event. Skipping.');
      return;
    }
    
    core.info('Starting Depwire PR Impact Analysis...');
    
    await installDepwire(depwireVersion);
    
    core.info('Analyzing PR branch...');
    const prParse = await runParse(projectPath);
    const prHealth = await runHealth(projectPath);
    
    core.info('Checking out base branch...');
    const baseSha = github.context.payload.pull_request?.base?.sha;
    if (!baseSha) {
      throw new Error('Could not determine base SHA');
    }
    
    await exec.exec('git', ['fetch', 'origin', baseSha]);
    await exec.exec('git', ['checkout', baseSha]);
    
    core.info('Analyzing base branch...');
    const baseParse = await runParse(projectPath);
    const baseHealth = await runHealth(projectPath);
    
    core.info('Switching back to PR branch...');
    const prSha = github.context.payload.pull_request?.head?.sha;
    if (!prSha) {
      throw new Error('Could not determine PR SHA');
    }
    await exec.exec('git', ['checkout', prSha]);
    
    core.info('Computing diff...');
    const diff = computeDiff(baseParse, prParse, baseHealth, prHealth);
    
    core.info('Analyzing impact...');
    const impact = analyzeImpact(diff, prParse);
    
    core.info('Building comment...');
    const comment = buildComment(diff, impact, commentHeader);
    
    core.info('Posting comment to PR...');
    const existingId = await findExistingComment(octokit, owner, repo, prNumber, commentHeader);
    
    if (existingId) {
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existingId,
        body: comment
      });
      core.info('Updated existing PR comment.');
    } else {
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: comment
      });
      core.info('Posted new PR comment.');
    }
    
    core.setOutput('health-score', prHealth.overall);
    core.setOutput('health-grade', prHealth.grade);
    core.setOutput('health-delta', diff.healthDelta.overallDelta);
    core.setOutput('files-changed', diff.files.added.length + diff.files.removed.length + diff.files.modified.length);
    
    if (failOnScoreDrop > 0 && diff.healthDelta.overallDelta < -failOnScoreDrop) {
      core.setFailed(
        `Health score dropped by ${Math.abs(diff.healthDelta.overallDelta)} points ` +
        `(threshold: ${failOnScoreDrop}). Base: ${baseHealth.overall}, PR: ${prHealth.overall}`
      );
    }
    
    core.info('Depwire PR Impact Analysis complete!');
    
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(String(error));
    }
  }
}

run();
