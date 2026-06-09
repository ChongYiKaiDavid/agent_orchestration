import fs from 'fs/promises';
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

async function getGeminiCommand() {
  if (process.env.GEMINI_PATH) {
    return process.env.GEMINI_PATH;
  }

  const names = process.platform === 'win32'
    ? ['gemini.cmd', 'gemini.exe', 'Gemini.exe', 'gemini']
    : ['gemini', 'Gemini'];

  for (const name of names) {
    const found = await findExecutableInPath(name);
    if (found) return found;
  }

  return 'gemini';
}

function buildGeminiArgs(promptFile, promptText) {
  if (process.env.GEMINI_ARGS) {
    return process.env.GEMINI_ARGS.split(' ').map(arg =>
      arg === '<PROMPT_FILE>' ? promptFile : arg
    );
  }
  return ['-p', promptText, '--skip-trust'];
}

export async function runGeminiStage({ prompt, stageId, workspace, onStdout, onStderr }) {
  const promptFile = await writePromptFile(workspace, prompt);

  const command = await getGeminiCommand();
  const args = buildGeminiArgs(promptFile, prompt);
  const env = {
    ...process.env,
    GEMINI_PERMISSION_MODE: process.env.GEMINI_PERMISSION_MODE || 'auto',
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || '',
  };

  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: workspace, env, shell: process.platform === 'win32' });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      if (onStdout) onStdout(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (onStderr) onStderr(text);
    });

    child.on('close', (code) => {
      resolve({
        exitCode: code,
        output: stdout.trim(),
        logs: stderr.trim(),
      });
    });

    child.on('error', (error) => {
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
      break;
    case 'coding':
      lines.push('Using the plan and design artifacts, produce an implementation diff or summary.');
      lines.push('Write the output into implementation.diff.md.');
      lines.push('Include any assumptions and list the files changed.');
      break;
    case 'reviewing':
      lines.push('Review the implementation diff against the requirements.');
      lines.push('Write a review in reviewer.review.md.');
      lines.push('End your response with VERDICT: GO, FAIL, SPEC_FAIL, or ESCALATE.');
      break;
    default:
      lines.push('Complete the current stage carefully and include a verdict if one is required.');
      break;
  }

  lines.push('', 'Output rules:');
  lines.push('- Keep the report text-focused and machine-readable.');
  lines.push('- Use VERDICT: <value> only when prompted.');
  lines.push('- If the stage cannot complete, explain why and stop.');

  return lines.join('\\n');
}
