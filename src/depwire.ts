import * as exec from '@actions/exec';
import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import { ParseResult, HealthReport, NoParseableFilesResult } from './types';

const NO_PARSEABLE_FILES_EXIT_CODE = 2;

export interface ParseRunResult {
  graph: ParseResult;
  failedFiles: number;
}

const FAILED_FILES_RE = /^(\d+) files failed$/m;
const ERROR_FILE_RE = /^Error parsing file /m;

function countFailedFiles(stdout: string, stderr: string): number {
  const m = stdout.match(FAILED_FILES_RE);
  if (m) {
    return parseInt(m[1], 10);
  }
  return (stderr.match(ERROR_FILE_RE) || []).length;
}

// depwire-cli 1.20.0 writes depwire-output.json next to the project root
// (the path argument), while older releases wrote it relative to the cwd.
// 1.20.2 still uses the project root; its POSIX source-path normalization
// does not change the output location. Keep fallbacks for older CLI overrides.
function outputCandidates(projectPath: string): string[] {
  const projectRoot = path.resolve(process.cwd(), projectPath);
  return [
    path.join(projectRoot, 'depwire-output.json'),
    path.join(projectRoot, '.depwire', 'depwire-output.json'),
    path.join(process.cwd(), 'depwire-output.json')
  ];
}

export async function installDepwire(version: string): Promise<void> {
  const pkg = version === 'latest' ? 'depwire-cli' : `depwire-cli@${version}`;
  core.info(`Installing ${pkg}...`);
  
  try {
    await exec.exec('npm', ['install', '-g', pkg], {
      silent: false
    });
    core.info(`Successfully installed ${pkg}`);
  } catch (error) {
    throw new Error(`Failed to install ${pkg}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function runParse(projectPath: string): Promise<ParseRunResult | NoParseableFilesResult> {
  core.info(`Running depwire parse ${projectPath}...`);
  
  const candidates = outputCandidates(projectPath);
  
  for (const outputFile of candidates) {
    if (fs.existsSync(outputFile)) {
      core.info(`Removing existing ${outputFile}`);
      fs.unlinkSync(outputFile);
    }
  }
  
  let stdout = '';
  let stderr = '';
  let exitCode = 0;
  
  try {
    exitCode = await exec.exec('depwire', ['parse', projectPath], {
      listeners: {
        stdout: (data: Buffer) => {
          stdout += data.toString();
        },
        stderr: (data: Buffer) => {
          stderr += data.toString();
        }
      },
      silent: true,
      ignoreReturnCode: true
    });
    
    if (exitCode === NO_PARSEABLE_FILES_EXIT_CODE) {
      core.info(`depwire parse found no parseable files at ${projectPath}`);
      return { status: 'no_parseable_files' };
    }
    
    if (exitCode !== 0) {
      core.error(`depwire parse exited with code ${exitCode}`);
      if (stderr.trim()) {
        core.error(`stderr: ${stderr}`);
      }
      if (stdout.trim()) {
        core.error(`stdout: ${stdout.substring(0, 1000)}`);
      }
      throw new Error(`depwire parse failed with exit code ${exitCode}. stderr: ${stderr || '(empty)'}`);
    }
    
    // Legacy 1.20.0/1.20.1 overrides exit 0 with an empty graph.
    // 1.20.2 exits 2 and returns above, so this fallback does not run twice.
    const failedFiles = countFailedFiles(stdout, stderr);
    const outputFile = candidates.find(f => fs.existsSync(f));
    
    if (!outputFile) {
      throw new Error(`depwire parse did not create output file (looked in ${candidates.join(', ')})`);
    }
    
    const fileContent = fs.readFileSync(outputFile, 'utf-8');
    const result = JSON.parse(fileContent) as ParseResult;
    
    if (result.files.length === 0 && result.nodes.length === 0) {
      core.info(`depwire parse found no parseable files at ${projectPath}`);
      fs.unlinkSync(outputFile);
      return { status: 'no_parseable_files' };
    }
    
    core.info(`Graph contains ${result.metadata.fileCount} files with ${result.metadata.nodeCount} symbols`);
    if (failedFiles > 0) {
      core.warning(`${failedFiles} file(s) failed to parse — analysis is based on a partial graph`);
    }
    
    fs.unlinkSync(outputFile);
    
    return { graph: result, failedFiles };
    
  } catch (error) {
    if (error instanceof SyntaxError) {
      core.error(`Failed to parse JSON from depwire output`);
      throw new Error(`Invalid JSON in depwire output file`);
    }
    throw error;
  }
}

export async function runHealth(projectPath: string): Promise<HealthReport | NoParseableFilesResult> {
  core.info(`Running depwire health ${projectPath} --json...`);
  
  let stdout = '';
  let stderr = '';
  let exitCode = 0;
  
  try {
    exitCode = await exec.exec('depwire', ['health', projectPath, '--json'], {
      listeners: {
        stdout: (data: Buffer) => {
          stdout += data.toString();
        },
        stderr: (data: Buffer) => {
          stderr += data.toString();
        }
      },
      silent: true,
      ignoreReturnCode: true
    });
    
    if (exitCode === NO_PARSEABLE_FILES_EXIT_CODE) {
      core.info(`depwire health found no parseable files at ${projectPath}`);
      return { status: 'no_parseable_files' };
    }
    
    if (exitCode !== 0) {
      core.error(`depwire health exited with code ${exitCode}`);
      if (stderr.trim()) {
        core.error(`stderr: ${stderr}`);
      }
      if (stdout.trim()) {
        core.error(`stdout: ${stdout.substring(0, 1000)}`);
      }
      throw new Error(`depwire health failed with exit code ${exitCode}. stderr: ${stderr || '(empty)'}`);
    }
    
    if (!stdout.trim()) {
      throw new Error(`No output from depwire health. stderr: ${stderr || '(empty)'}`);
    }
    
    const result = JSON.parse(stdout) as HealthReport;
    core.info(`Health score: ${result.overall}/100 (${result.grade})`);
    return result;
    
  } catch (error) {
    if (error instanceof SyntaxError) {
      core.error(`Failed to parse JSON. First 500 chars of output: ${stdout.substring(0, 500)}`);
      throw new Error(`Invalid JSON from depwire health. Output: ${stdout.substring(0, 500)}`);
    }
    throw error;
  }
}
