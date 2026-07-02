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
        // continue
      }
    }
  }

  return null;
}

async function getGeminiCommand() {
  // This supports two modes:
  // 1) Gemini CLI is installed and available in PATH.
  // 2) GEMINI_PATH is set to the CLI executable.
  if (process.env.GEMINI_PATH) {
    if (await isExecutable(process.env.GEMINI_PATH)) return process.env.GEMINI_PATH;
    throw new Error(`GEMINI_PATH is set to '${process.env.GEMINI_PATH}', but it is not executable or missing.`);
  }

  const defaultName = process.platform === 'win32' ? 'gemini.exe' : 'gemini';
  const found = await findExecutableInPath(defaultName);
  if (found) return found;

  // If gemini CLI isn't installed, we fail fast with a clear message.
  throw new Error("Gemini CLI executable not found. Install Gemini CLI or set GEMINI_PATH in .env.agent_orchestration.");
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
        console.error(`[gemini] Refusing to write outside repo. filename='${filename}'`);
        continue;
      }

      const filePath = path.resolve(path.join(repoAbs, filename));
      if (!filePath.startsWith(repoAbs + path.sep) && filePath !== repoAbs) {
        console.error(`[gemini] Refusing to write outside repo after resolution. filename='${filename}' resolved='${filePath}'`);
        continue;
      }

      fsSync.mkdirSync(path.dirname(filePath), { recursive: true });
      fsSync.writeFileSync(filePath, content, 'utf8');
      executed.push(filename);
    } catch (e) {
      console.error(`[gemini] Failed to write file ${filename}:`, e?.message || String(e));
    }
  }

  return executed;
}

export async function runGeminiStage({ prompt, stageId, workspace, onStdout, onStderr }) {
  // Gemnini CLI contract can vary. Here we use a best-effort generic CLI interface.
  // The rest of the orchestration expects FILE:/---/--- blocks in stdout.
  //
  // Expected env (per README):
  // - GEMINI_API_KEY (or GOOGLE_API_KEY as fallback)
  // - GEMINI_MODEL (optional)

  await writePromptFile(workspace, prompt);
  const command = await getGeminiCommand();

  const repoPath = path.join(path.dirname(workspace), 'repo');
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-pro';

  // Use -p/--prompt for non-interactive (headless) mode.
  // --skip-trust suppresses the "folder not trusted" interactive prompt that overrides --yolo.
  // -y/--yolo auto-approves all tool actions so the process doesn't block.
  const args = [
    '--model', model,
    '-p', prompt,
    '-y',
    '--skip-trust',
  ];

  // Auth: if GEMINI_API_KEY is set, use it exclusively and clear GOOGLE_API_KEY so
  // the CLI doesn't prefer a stale GOOGLE_API_KEY from the shell environment.
  // If neither is set, fall back to OAuth credentials (~/.gemini/settings.json).
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const env = { ...process.env };
  if (geminiApiKey) {
    env.GEMINI_API_KEY = geminiApiKey;
    delete env.GOOGLE_API_KEY; // prevent CLI from preferring a stale GOOGLE_API_KEY
  }

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let completed = false;
    let settled = false;

    const timeoutMs = parseInt(process.env.GEMINI_TIMEOUT_MS || '', 10) || 5 * 60 * 1000; // default 5 min

    const child = spawn(command, args, { cwd: workspace, env, shell: process.platform === 'win32' });

    const timeoutHandle = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill('SIGTERM'); } catch {}
      resolve({
        exitCode: 1,
        output: stdout.trim(),
        logs: `[gemini] Timed out after ${timeoutMs / 1000}s. Last stderr:\n${stderr.trim()}`,
      });
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      onStdout?.(text);

      const completionTokens = ['<<<PLANNER_COMPLETE>>>', '<<<CODER_COMPLETE>>>', '<<<REVIEWER_COMPLETE>>>'];
      for (const token of completionTokens) {
        if (stdout.includes(token) && !completed) {
          completed = true;
          fs.writeFile(path.join(workspace, '.done'), token).catch(() => {});
          setTimeout(() => {
            try { child.kill('SIGTERM'); } catch {}
          }, 500);
          break;
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      onStderr?.(text);
    });

    child.on('close', async (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);

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
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      resolve({
        exitCode: 1,
        output: '',
        logs: `Failed to start Gemini CLI at '${command}': ${error.message}`,
      });
    });
  });
}

export function buildStagePrompt(stage, task, previousArtifacts = [], repositoryPath = null) {
  const lines = [
    `Stage: ${stage.name}`,
    `Agent: Gemini`,
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
    previousArtifacts.forEach((a) => lines.push(`- ${a}`));
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
      lines.push('Implement the required changes. Output FILE blocks in the exact format:');
      lines.push('FILE: path/to/file.ext');
      lines.push('---');
      lines.push('<full file content>');
      lines.push('---');
      lines.push('Rules: use repo-relative paths only. No absolute paths. No diffs.');
      lines.push('After all FILE blocks, also write a summary into implementation.diff.md.');
      lines.push('Print <<<CODER_COMPLETE>>> when finished.');
      break;

    case 'reviewing':
      lines.push('Review the implementation and produce a verdict.');
      lines.push('Write a review in reviewer.review.md.');
      lines.push('End your response with VERDICT: GO, FAIL, SPEC_FAIL, or ESCALATE.');
      lines.push('Print <<<REVIEWER_COMPLETE>>> when finished.');
      break;

    default:
      lines.push('Complete the current stage carefully and include a verdict if required.');
      break;
  }

  lines.push('', 'Output rules:');
  lines.push('- Keep output text-focused and machine-readable.');
  lines.push('- Use VERDICT: <value> only when prompted.');

  return lines.join('\n');
}
