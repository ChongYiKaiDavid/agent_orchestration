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
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findExecutableInPath(name) {
  const pathEnv = process.env.PATH || '';
  const pathDirs = pathEnv.split(path.delimiter).filter(Boolean);
  const extensions = process.platform === 'win32'
    ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';')
    : [''];

  for (const dir of pathDirs) {
    for (const ext of extensions) {
      const candidate = path.join(dir, `${name}${ext}`);
      if (await isExecutable(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

async function getDevinCommand() {
  if (process.env.DEVIN_PATH) {
    return process.env.DEVIN_PATH;
  }

  const defaultName = process.platform === 'win32' ? 'devin.exe' : 'devin';
  const found = await findExecutableInPath(defaultName);
  return found || defaultName;
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
  const promptFile = await writePromptFile(workspace, prompt);

  const command = await getDevinCommand();
  const args = ['--prompt-file', promptFile, '--print'];
  const env = {
    ...process.env,
    DEVIN_PERMISSION_MODE: process.env.DEVIN_PERMISSION_MODE || 'dangerous',
    // Allow selecting a cheaper/free model (if your Devin CLI supports it)
    // e.g. set DEVIN_MODEL=codex or opus in env.
    DEVIN_MODEL: process.env.DEVIN_MODEL,
  };

  const repoPath = path.join(path.dirname(workspace), 'repo');

  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: workspace, env, shell: process.platform === 'win32' });


    let stdout = '';
    let stderr = '';
    let completed = false;

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      if (onStdout) onStdout(text);

      // Detect completion tokens
      const completionTokens = ['<<<PLANNER_COMPLETE>>>', '<<<CODER_COMPLETE>>>', '<<<REVIEWER_COMPLETE>>>'];
      for (const token of completionTokens) {
        if (stdout.includes(token)) {
          console.log(`[runDevinStage] Detected completion token: ${token}`);
          if (!completed) {
            completed = true;
            // Create .done file
            fs.writeFile(path.join(workspace, '.done'), token).catch(err => {
              console.error('[runDevinStage] Failed to write .done file:', err);
            });
            // Kill process after a short delay to allow final output
            setTimeout(() => {
              try {
                child.kill('SIGTERM');
              } catch (e) {
                // Process may already be dead
              }
            }, 500);
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
      const output = stdout.trim();
      try {
        const written = writeFilesFromOutput(output, repoPath);
        if (written.length > 0) {
          onStdout?.(`\n[WRITTEN ${written.length} files: ${written.join(', ')}]\n`);
        }
      } catch {
        // ignore
      }

      resolve({
        exitCode: code,
        output,
        logs: stderr.trim(),
      });
    });


    child.on('error', (error) => {
      resolve({
        exitCode: 1,
        output: '',
        logs: `Failed to start Devin CLI at '${command}': ${error.message}`,
      });
    });
  });
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
