import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { spawn } from 'child_process';

async function writePromptFile(root, prompt) {
  const resolvedRoot = path.resolve(root);
  await fs.mkdir(resolvedRoot, { recursive: true });
  const promptFile = path.join(resolvedRoot, 'prompt.txt');
  await fs.writeFile(promptFile, prompt, 'utf8');
  return promptFile;
}

async function isExecutable(filePath) {
  try {
    await fs.access(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findExecutableInPath(name) {
  const pathEnv = process.env.PATH || '';
  const pathDirs = pathEnv.split(path.delimiter).filter(Boolean);
  const extensions = process.platform === 'win32'
    ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';')
    : [''];

  for (const dir of pathDirs) {
    for (const ext of extensions) {
      const candidate = path.join(dir, `${name}${ext}`);
      try {
        if ((await fs.stat(candidate)).isFile() && (await isExecutable(candidate))) {
          return candidate;
        }
      } catch {
        // file does not exist or other error, continue
      }
    }
  }

  return null;
}

async function getDevinCommand() {
  if (process.env.DEVIN_PATH) {
    if (await isExecutable(process.env.DEVIN_PATH)) {
        return process.env.DEVIN_PATH;
    } else {
        throw new Error(`DEVIN_PATH is set to '${process.env.DEVIN_PATH}', but this file is not executable or does not exist.`);
    }
  }

  const defaultName = process.platform === 'win32' ? 'devin' : 'devin';
  const found = await findExecutableInPath(defaultName);
  
  if (found) {
    return found;
  }
  
  const exeName = process.platform === 'win32' ? 'devin.exe' : 'devin';
  throw new Error(`'${exeName}' not found in your PATH. Please install the Devin CLI or set the DEVIN_PATH environment variable to the full path of the executable.`);
}

function parseFileBlocks(output) {
  const files = {};
  const fileRegex = /FILE:\s*([^\s\n]+)\s*\n\s*---\s*\n([\s\S]*?)\s*\n\s*---\s*\n/g;
  let match;
  while ((match = fileRegex.exec(output)) !== null) {
    const filename = match[1].trim();
    const content = match[2].trim();
    files[filename] = content;
  }
  return files;
}

function writeFilesFromOutput(output, repoPath) {
  if (!repoPath || !output) return [];
  const files = parseFileBlocks(output);
  const executed = [];
  const repoAbs = path.resolve(repoPath);

  for (const [filename, content] of Object.entries(files)) {
    try {
      if (path.isAbsolute(filename) || filename.includes('..')) {
        console.error(`[devin] Refusing to write outside repo. filename='${filename}'`);
        continue;
      }

      const filePath = path.resolve(path.join(repoAbs, filename));
      if (!filePath.startsWith(repoAbs + path.sep) && filePath !== repoAbs) {
        console.error(`[devin] Refusing to write outside repo after resolution. filename='${filename}' resolved='${filePath}'`);
        continue;
      }

      fsSync.mkdirSync(path.dirname(filePath), { recursive: true });
      fsSync.writeFileSync(filePath, content, 'utf8');
      executed.push(filename);
    } catch (e) {
      console.error(`[devin] Failed to write file ${filename}:`, e?.message || String(e));
    }
  }

  return executed;
}

export async function runDevinStage({ prompt, stageId, workspace, onStdout, onStderr }) {
  try {
    const promptFile = await writePromptFile(workspace, prompt);

    let command = await getDevinCommand();
    const args = ['--prompt-file', promptFile, '--print'];
    const env = {
      ...process.env,
      DEVIN_PERMISSION_MODE: process.env.DEVIN_PERMISSION_MODE || 'dangerous',
    };
    // Only forward DEVIN_MODEL if it is explicitly set — passing an empty string
    // causes the Devin CLI to error with "Unknown model: ''"
    if (process.env.DEVIN_MODEL) {
      env.DEVIN_MODEL = process.env.DEVIN_MODEL;
    }

    const repoPath = path.join(path.dirname(workspace), 'repo');

    return new Promise((resolve) => {
      // Spawn the executable directly without a shell for consistent signal handling on Windows
      const finalArgs = args;
      const detachedMode = process.platform === 'win32';
      const child = spawn(command, finalArgs, { cwd: workspace, env, shell: false, detached: detachedMode });
      if (child && child.pid) {
        console.log(`[devin] spawned child pid=${child.pid} cmd=${command} args=${finalArgs.join(' ')} detached=${detachedMode}`);
      }
      // If detached, unref so parent can exit cleanly without holding stdio
      if (detachedMode) {
        try { child.unref(); } catch (e) {}
      }

      child.stdin.write(prompt);
      child.stdin.end();

      // Capture exit reason for diagnostics
      child.on('exit', (code, signal) => {
        console.log(`[devin] child exited code=${code} signal=${signal}`);
      });

      let stdout = '';
      let stderr = '';
      let completed = false;
      let resolved = false;

      child.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        stdout += text;
        if (onStdout) onStdout(text);

        const completionTokens = ['<<<PLANNER_COMPLETE>>>', '<<<CODER_COMPLETE>>>', '<<<REVIEWER_COMPLETE>>>'];
        for (const token of completionTokens) {
          if (stdout.includes(token)) {
            if (!completed) {
              completed = true;
              fs.writeFile(path.join(workspace, '.done'), token).catch(() => {});

              // attempt to write files immediately from current output
              try {
                const written = writeFilesFromOutput(stdout, repoPath);
                if (written.length > 0) {
                  onStdout?.(`\n[WRITTEN ${written.length} files: ${written.join(', ')}]\n`);
                }
              } catch {}

              if (!resolved) {
                resolved = true;
                resolve({
                  exitCode: 0,
                  output: stdout.trim(),
                  logs: stderr.trim(),
                });
              }

              // give child time to exit, then try to kill gracefully if still alive
              setTimeout(() => {
                try {
                  if (!child.killed) child.kill();
                } catch (e) {}
              }, 5000);
            }
          }
        }
      });

      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        stderr += text;
        if (onStderr) onStderr(text);
      });

      child.on('close', (code) => {
        if (resolved) return;
        const output = stdout.trim();
        try {
          const written = writeFilesFromOutput(output, repoPath);
          if (written.length > 0) {
            onStdout?.(`\n[WRITTEN ${written.length} files: ${written.join(', ')}]\n`);
          }
        } catch {}
        resolved = true;
        resolve({
          exitCode: code,
          output,
          logs: stderr.trim(),
        });
      });

      child.on('error', (error) => {
        if (resolved) return;
        resolved = true;
        resolve({
          exitCode: 1,
          output: '',
          logs: `Failed to start Devin CLI at '${command}': ${error.message}`,
        });
      });
    });
  } catch (error) {
    return {
      exitCode: 1,
      output: '',
      logs: error.message,
    };
  }
}

export function buildStagePrompt(stage, task, previousArtifacts = [], repositoryPath = null) {
  const lines = [
    `Stage: ${stage.name}`,
    `Agent: Devin`,
    `Task: ${task.title}`,
    `Repository: ${task.repository || 'not specified'}`,
    `Target branch: ${task.target_branch || 'not specified'}`,
    repositoryPath ? `Repository path: ${repositoryPath}` : null,
    '',
    `Description: ${task.description || 'No additional description provided.'}`,
    '',
  ].filter(Boolean);

  if (previousArtifacts.length > 0) {
    lines.push('Previous artifacts:');
    previousArtifacts.forEach((artifact) => {
      lines.push(`- ${artifact}`);
    });
    lines.push('');
  }

  switch (stage.id) {
    case 'planning':
      lines.push('Produce a short requirements document and a design summary for this task.');
      lines.push('Write two artifacts: planner.requirements.md and planner.design.md.');
      lines.push('Format the response clearly and include a final line with VERDICT: GO.');
      lines.push('Print <<<PLANNER_COMPLETE>>> when finished.');
      break;
    case 'coding':
      lines.push('Target working directory: the cloned repository at: ' + (repositoryPath ? repositoryPath : '<repoPath>') + '.');
      lines.push('After modifications, also write a human-readable summary of what you changed into implementation.diff.md (does not replace actual file edits).');
      lines.push('Include a line formatted exactly as: FILES_CHANGED: <comma-separated file paths>.');
      lines.push('Include any assumptions and list the files changed.');
      lines.push('Print <<<CODER_COMPLETE>>> when finished.');
      break;
    case 'reviewing':
      lines.push('Review the implementation diff against the requirements.');
      lines.push('Write a review in reviewer.review.md.');
      lines.push('End your response with VERDICT: GO, FAIL, SPEC_FAIL, or ESCALATE.');
      lines.push('Print <<<REVIEWER_COMPLETE>>> when finished.');
      break;
    default:
      lines.push('Complete the current stage carefully and include a verdict if one is required.');
      break;
  }

  lines.push('', 'Output rules:');
  lines.push('- Keep the report text-focused and machine-readable.');
  lines.push('- Use VERDICT: <value> only when prompted.');
  lines.push('- If the stage cannot complete, explain why and stop.');

  return lines.join('\n');
}
