import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import https from 'https';
import http from 'http';
import { URL } from 'url';

async function writePromptFile(root, prompt) {
  const resolvedRoot = path.resolve(root);
  await fsPromises.mkdir(resolvedRoot, { recursive: true });
  const promptFile = path.join(resolvedRoot, 'prompt.txt');
  await fsPromises.writeFile(promptFile, prompt, 'utf8');
  return promptFile;
}

async function getOllamaCommand() {
  if (process.env.OLLAMA_PATH) {
    return process.env.OLLAMA_PATH;
  }
  return process.platform === 'win32' ? 'ollama.exe' : 'ollama';
}

function getModelName() {
  return process.env.OLLAMA_MODEL || 'qwen2.5-coder:1.5b'; // Use faster model by default
}

function getOllamaHost() {
  return process.env.OLLAMA_HOST || 'http://localhost:11434';
}

function ollamaGenerate(prompt, model, onStdout, onStderr) {
  const timeoutMs = Number(process.env.OLLAMA_HTTP_TIMEOUT_MS || 60000); // 1 minute

  return new Promise((resolve, reject) => {
    const host = getOllamaHost();
    const url = new URL(`${host}/api/generate`);

    const postData = JSON.stringify({
      model,
      prompt,
      system: "You are a world-class software engineering AI. Your task is to follow instructions precisely and generate code as requested, using the specified format.",
      stream: true, // Enable streaming
    });

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 11434),
      path: '/api/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const protocol = url.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let buffer = '';
      let fullResponse = '';
      
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        if (onStdout) onStdout(chunk.toString());

        // Process line-by-line JSON
        let boundary = buffer.indexOf('\n');
        while (boundary !== -1) {
          const jsonLine = buffer.substring(0, boundary);
          buffer = buffer.substring(boundary + 1);
          if (jsonLine) {
            try {
              const parsed = JSON.parse(jsonLine);
              if (parsed.response) {
                fullResponse += parsed.response;
              }
              if (parsed.done) {
                clearTimeout(t);
                resolve({
                  exitCode: 0,
                  output: fullResponse,
                  logs: '',
                });
                req.destroy(); // End the request
                return;
              }
            } catch (e) {
              if (onStderr) onStderr(`\nError parsing Ollama stream: ${e.message}\n`);
            }
          }
          boundary = buffer.indexOf('\n');
        }
      });

      res.on('end', () => {
        clearTimeout(t);
        resolve({
          exitCode: 0,
          output: fullResponse,
          logs: '',
        });
      });
    });

    const t = setTimeout(() => {
      try {
        req.destroy(new Error(`Ollama HTTP request timed out after ${timeoutMs}ms`));
      } catch {
        // ignore
      }
      reject(new Error(`Ollama HTTP request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    req.on('error', (err) => {
      clearTimeout(t);
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

function writeFilesFromOutput(output, repoPath) {
  const files = {};
  // More flexible regex to handle various spacing patterns
  const fileRegex = /FILE:\s*([^\s\n]+)\s*\n\s*---\s*\n([\s\S]*?)\s*\n\s*---\s*\n/g;
  let match;

  while ((match = fileRegex.exec(output)) !== null) {
    const filename = match[1].trim();
    const content = match[2].trim();
    files[filename] = content;
    console.log(`[ollama] Parsed file block: ${filename} (${content.length} chars)`);
  }

  const executed = [];
  for (const [filename, content] of Object.entries(files)) {
    try {
      // Enforce repo-relative paths only (no absolute paths, no path traversal)
      // Absolute paths from the model can cause writes outside the cloned repo.
      if (path.isAbsolute(filename) || filename.includes('..')) {
        console.error(`[ollama] Refusing to write outside repo. filename='${filename}'`);
        continue;
      }

      const repoAbs = path.resolve(repoPath);
      const filePath = path.resolve(path.join(repoAbs, filename));
      if (!filePath.startsWith(repoAbs + path.sep) && filePath !== repoAbs) {
        console.error(`[ollama] Refusing to write outside repo after resolution. filename='${filename}' resolved='${filePath}'`);
        continue;
      }

      console.log(`[ollama] Attempting to write: ${filePath}`);
      console.log(`[ollama] Repo path: ${repoPath}`);
      console.log(`[ollama] Filename: ${filename}`);
      console.log(`[ollama] Content length: ${content.length}`);
      console.log(`[ollama] Content preview: ${content.substring(0, 50)}...`);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, 'utf8');
      executed.push(filename);
      console.log(`[ollama] Successfully wrote file: ${filename} (${content.length} chars)`);

      
      // Verify the write
      const writtenContent = fs.readFileSync(filePath, 'utf8');
      if (writtenContent === content) {
        console.log(`[ollama] Verified file content matches`);
      } else {
        console.error(`[ollama] File content mismatch after write!`);
        console.error(`[ollama] Expected: ${content.substring(0, 50)}...`);
        console.error(`[ollama] Got: ${writtenContent.substring(0, 50)}...`);
      }
    } catch (error) {
      console.error(`[ollama] Failed to write file ${filename}:`, error.message);
    }
  }

  if (Object.keys(files).length > 0 && executed.length === 0) {
    console.error('[ollama] Warning: Parsed files but failed to write any');
  }

  return executed;
}

function executeCommandsFromOutput(output, repoPath) {
  const commandRegex = /(?:^|\n)\s*(\$\s*|`[^`]*`|printf|echo|cat|tee|mkdir|rm\s+-rf|cp|mv|sed|awk)\s+[^\n]*(?:\n\s+[^\n]+)*/gm;
  const matches = output.match(commandRegex);

  if (!matches || matches.length === 0) {
    return { executed: [], output };
  }

  const executed = [];
  for (const cmd of matches) {
    try {
      let cleanCmd = cmd.replace(/^[\$%`]?\s*/, '').replace(/`$/, '').trim();
      cleanCmd = cleanCmd.replace(/\\\n\s*/g, ' ');
      if (!cleanCmd || cleanCmd.match(/^(printf|echo|cat|tee|mkdir|rm|cp|mv|sed|awk)$/)) continue;
      if (cleanCmd.includes('rm -rf') || cleanCmd.includes('format') || cleanCmd.includes(';')) continue;
      if (cleanCmd.includes('rm ') && !cleanCmd.match(/rm\s+[\w.-]+$/)) continue;

      const { execSync } = require('child_process');
      execSync(cleanCmd, { cwd: repoPath, encoding: 'utf8', stdio: 'ignore' });
      executed.push(cleanCmd);
    } catch {
      // ignore
    }
  }

  return { executed, output };
}

export async function runOllamaStage({ prompt, stageId, workspace, onStdout, onStderr }) {
  await writePromptFile(workspace, prompt);

  // The repository is in the parent directory of the stage folder
  // workspace is: workspaceRoot/taskId/stageId
  // repo is at: workspaceRoot/taskId/repo
  const repoPath = path.join(path.dirname(workspace), 'repo');
  const model = getModelName();

  try {
    const result = await ollamaGenerate(prompt, model, onStdout, onStderr);

    if (repoPath && result.output) {
      const writtenFiles = writeFilesFromOutput(result.output, repoPath);
      if (writtenFiles.length > 0) {
        onStdout?.(`\n[WRITTEN ${writtenFiles.length} files: ${writtenFiles.join(', ')}]\n`);
      }

      const { executed } = executeCommandsFromOutput(result.output, repoPath);
      if (executed.length > 0) {
        onStdout?.(`\n[EXECUTED ${executed.length} commands]\n`);
      }
    }

    // Detect completion tokens in output
    const completionTokens = ['<<<PLANNER_COMPLETE>>>', '<<<CODER_COMPLETE>>>', '<<<REVIEWER_COMPLETE>>>'];
    for (const token of completionTokens) {
      if (result.output && result.output.includes(token)) {
        console.log(`[runOllamaStage] Detected completion token: ${token}`);
        fsPromises.writeFile(path.join(workspace, '.done'), token).catch(err => {
          console.error('[runOllamaStage] Failed to write .done file:', err);
        });
      }
    }

    return result;
  } catch (error) {
    console.error('[ollama] HTTP API failed, falling back to CLI:', error.message);
    let command = await getOllamaCommand();

    return new Promise((resolve) => {
      const cliTimeoutMs = Number(process.env.OLLAMA_CLI_TIMEOUT_MS || 60000); // 1 minute
      if (process.platform === 'win32' && command.includes(' ')) {
        command = `"${command}"`;
      }
      console.error(`[ollama] CLI fallback starting: ${command} run ${model} (timeout ${cliTimeoutMs}ms)`);
      const child = spawn(command, ['run', model], {
        shell: process.platform === 'win32',
        env: {
          ...process.env,
          OLLAMA_HOST: getOllamaHost(),
        },
      });

      console.error('[ollama] CLI child pid=', child.pid);

      let stdout = '';
      let stderr = '';
      let completed = false;

      child.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        stdout += text;
        onStdout?.(text);

        // Detect completion tokens
        const completionTokens = ['<<<PLANNER_COMPLETE>>>', '<<<CODER_COMPLETE>>>', '<<<REVIEWER_COMPLETE>>>'];
        for (const token of completionTokens) {
          if (stdout.includes(token)) {
            console.log(`[runOllamaStage] Detected completion token: ${token}`);
            if (!completed) {
              completed = true;
              fsPromises.writeFile(path.join(workspace, '.done'), token).catch(err => {
                console.error('[runOllamaStage] Failed to write .done file:', err);
              });
              setTimeout(() => {
                try {
                  child.kill('SIGTERM');
                } catch (e) {
                  // Process may already be dead
                }
              }, 3000);
            }
          }
        }
      });

      const timeoutMs = Number(process.env.OLLAMA_CLI_TIMEOUT_MS || 60000); // 1m

      const timeout = setTimeout(() => {
        console.error(`[ollama] CLI fallback timed out after ${timeoutMs}ms; killing pid=${child.pid}`);
        try {
          child.kill('SIGKILL');
        } catch {
          // ignore
        }
        resolve({
          exitCode: 124,
          output: stdout.trim(),
          logs: stderr.trim() + `\n[ollama] CLI timeout after ${timeoutMs}ms`,
        });
      }, timeoutMs);

      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        stderr += text;
        onStderr?.(text);
      });

      child.stdin.write(prompt);
      child.stdin.write('\n');
      child.stdin.end();

      child.on('close', (code) => {
        const output = stdout.trim();

        if (repoPath && output) {
          try {
            // IMPORTANT: Apply FILE:/---/--- blocks in CLI fallback too.
            const writtenFiles = writeFilesFromOutput(output, repoPath);
            if (writtenFiles && writtenFiles.length > 0) {
              onStdout?.(`\n[WRITTEN ${writtenFiles.length} files: ${writtenFiles.join(', ')}]\n`);
            }

            const { executed } = executeCommandsFromOutput(output, repoPath);
            if (executed && executed.length > 0) {
              onStdout?.(`\n[EXECUTED ${executed.length} commands]\n`);
            }
          } catch {
            // ignore
          }
        }

        resolve({
          exitCode: code,
          output,
          logs: stderr.trim(),
        });
      });

      child.on('error', (err) => {
        resolve({
          exitCode: 1,
          output: '',
          logs: `Failed to start Ollama: ${err.message}. Make sure Ollama is running (ollama serve)`,
        });
      });
    });
  }
}

export function buildStagePrompt(stage, task, previousArtifacts = [], repositoryPath = null) {
  const lines = [
    `Stage: ${stage.name}`,
    `Agent: Ollama (local AI)`,
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
    previousArtifacts.forEach((artifact) => lines.push(`- ${artifact}`));
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
      lines.push('You are a code generation AI. Your task is to implement the requested changes by providing the complete new content of the files that need to be modified.');
      lines.push('You MUST use the following format to specify file changes:');
      lines.push('');
      lines.push('FILE: path/to/your/file.ext');
      lines.push('---');
      lines.push('<<< The full and complete content of the file goes here >>>');
      lines.push('---');
      lines.push('');
      lines.push('You can specify multiple files by repeating the block.');
      lines.push('');
      lines.push('For example, to create a new file `src/hello.js`:');
      lines.push('FILE: src/hello.js');
      lines.push('---');
      lines.push('function sayHello() {');
      lines.push('  console.log("Hello, world!");');
      lines.push('}');
      lines.push('---');
      lines.push('');
      lines.push('IMPORTANT:');
      lines.push('- The file content must be complete.');
      lines.push('- Do not use placeholders or omit any part of the file.');
      lines.push('- You must implement the functionality described in the task.');
      lines.push('- After all file blocks, you must print <<<CODER_COMPLETE>>> on a new line.');
      lines.push('');
      lines.push('Now, apply the changes for the current task.');
      break;

    case 'reviewing':
      lines.push('Review the implementation diff against the requirements.');
      lines.push('Write a review in reviewer.review.md.');
      lines.push('End your response with VERDICT: GO, FAIL, SPEC_FAIL, or ESCALATE.');
      lines.push('Print <<<REVIEWER_COMPLETE>>> when finished.');
      break;

    default:
      lines.push('Complete the current stage carefully and include a verdict if required.');
      break;
  }

  lines.push('', 'Output rules:');
  lines.push('- Keep the report text-focused and machine-readable.');
  lines.push('- Use VERDICT: <value> only when prompted.');
  lines.push('- If the stage cannot complete, explain why and stop.');

  return lines.join('\n');
}
