import * as exec from '@actions/exec';
import * as core from '@actions/core';
import { ParseResult, HealthReport } from './types';

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

export async function runParse(projectPath: string): Promise<ParseResult> {
  core.info(`Running depwire parse ${projectPath} --json...`);
  
  let stdout = '';
  let stderr = '';
  let exitCode = 0;
  
  try {
    exitCode = await exec.exec('depwire', ['parse', projectPath, '--json'], {
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
    
    if (!stdout.trim()) {
      throw new Error(`No output from depwire parse. stderr: ${stderr || '(empty)'}`);
    }
    
    const result = JSON.parse(stdout) as ParseResult;
    core.info(`Parsed ${result.metadata.fileCount} files with ${result.metadata.nodeCount} symbols`);
    return result;
    
  } catch (error) {
    if (error instanceof SyntaxError) {
      core.error(`Failed to parse JSON. First 500 chars of output: ${stdout.substring(0, 500)}`);
      throw new Error(`Invalid JSON from depwire parse. Output: ${stdout.substring(0, 500)}`);
    }
    throw error;
  }
}

export async function runHealth(projectPath: string): Promise<HealthReport> {
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
