import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import https from 'https';

async function writePromptFile(root, prompt) {
  const resolvedRoot = path.resolve(root);
  await fs.mkdir(resolvedRoot, { recursive: true });
  const promptFile = path.join(resolvedRoot, 'prompt.txt');
  await fs.writeFile(promptFile, prompt, 'utf8');
  return promptFile;
}

function getDeepSeekConfig() {
  return {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-coder',
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'api.deepseek.com',
  };
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
        console.error(`[deepseek] Refusing to write outside repo. filename='${filename}'`);
        continue;
      }
      const filePath = path.resolve(path.join(repoAbs, filename));
      if (!filePath.startsWith(repoAbs + path.sep) && filePath !== repoAbs) {
        console.error(`[deepseek] Refusing to write outside repo after resolution. filename='${filename}'`);
        continue;
      }
      fsSync.mkdirSync(path.dirname(filePath), { recursive: true });
      fsSync.writeFileSync(filePath, content, 'utf8');
      executed.push(filename);
    } catch (e) {
      console.error(`[deepseek] Failed to write file ${filename}:`, e?.message || String(e));
    }
  }
  return executed;
}

function deepSeekChat(prompt, config, onStdout, onStderr) {
  const timeoutMs = Number(process.env.DEEPSEEK_TIMEOUT_MS || 120000);

  return new Promise((resolve, reject) => {
    if (!config.apiKey) {
      return reject(new Error('DEEPSEEK_API_KEY is not set. Please configure it in Settings.'));
    }

    const postData = JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert software engineering AI. Follow instructions precisely and generate complete, working code as requested.',
        },
        { role: 'user', content: prompt },
      ],
      stream: true,
    });

    const options = {
      hostname: config.baseUrl,
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let fullResponse = '';
      let buffer = '';

      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullResponse += delta;
              if (onStdout) onStdout(delta);
            }
          } catch {
            // skip malformed SSE line
          }
        }
      });

      res.on('end', () => {
        clearTimeout(t);
        if (res.statusCode !== 200) {
          return reject(new Error(`DeepSeek API error: HTTP ${res.statusCode} — ${fullResponse}`));
        }
        resolve({ exitCode: 0, output: fullResponse, logs: '' });
      });

      res.on('error', (err) => {
        clearTimeout(t);
        reject(err);
      });
    });

    const t = setTimeout(() => {
      req.destroy();
      reject(new Error(`DeepSeek API request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    req.on('error', (err) => {
      clearTimeout(t);
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

export async function runDeepSeekStage({ prompt, stageId, workspace, onStdout, onStderr }) {
  try {
    await writePromptFile(workspace, prompt);
    const config = getDeepSeekConfig();
    const repoPath = path.join(path.dirname(workspace), 'repo');

    const result = await deepSeekChat(prompt, config, onStdout, onStderr);

    if (result.output) {
      const written = writeFilesFromOutput(result.output, repoPath);
      if (written.length > 0) {
        onStdout?.(`\n[WRITTEN ${written.length} files: ${written.join(', ')}]\n`);
      }

      // Write completion token file if present
      const tokens = ['<<<PLANNER_COMPLETE>>>', '<<<CODER_COMPLETE>>>', '<<<REVIEWER_COMPLETE>>>'];
      for (const token of tokens) {
        if (result.output.includes(token)) {
          await fs.writeFile(path.join(workspace, '.done'), token).catch(() => {});
          break;
        }
      }
    }

    return result;
  } catch (error) {
    return { exitCode: 1, output: '', logs: error.message };
  }
}

export function buildStagePrompt(stage, task, previousArtifacts = [], repositoryPath = null) {
  const lines = [
    `Stage: ${stage.name}`,
    `Agent: DeepSeek`,
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
      lines.push('Implement the required changes. For each modified or created file, output EXACTLY:');
      lines.push('FILE: path/to/file.ext');
      lines.push('---');
      lines.push('<full file content>');
      lines.push('---');
      lines.push('');
      lines.push('Rules: use repo-relative paths only. No absolute paths. No diffs.');
      lines.push('After all FILE blocks, write a summary into implementation.diff.md.');
      lines.push('Print <<<CODER_COMPLETE>>> when finished.');
      break;
    case 'reviewing':
      lines.push('Review the implementation diff against the requirements.');
      lines.push('Write a review in reviewer.review.md.');
      lines.push('End your response with VERDICT: GO, FAIL, SPEC_FAIL, or ESCALATE.');
      lines.push('Print <<<REVIEWER_COMPLETE>>> when finished.');
      break;
    default:
      lines.push('Complete the current stage carefully and include a verdict if required.');
  }

  lines.push('', 'Output rules:');
  lines.push('- Keep output text-focused and machine-readable.');
  lines.push('- Use VERDICT: <value> only when prompted.');
  lines.push('- If the stage cannot complete, explain why and stop.');

  return lines.join('\n');
}
