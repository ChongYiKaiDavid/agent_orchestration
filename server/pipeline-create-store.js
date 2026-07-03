import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { invalidatePipelinesCache } from './pipelines.js';

const pipelinesDir = path.resolve(process.cwd(), 'server', 'pipelines');

function validatePipelineShape(config) {
  if (!config?.id || typeof config.id !== 'string') throw new Error('Pipeline must have an id');
  if (!config?.name || typeof config.name !== 'string') throw new Error('Pipeline must have a name');
  if (!Array.isArray(config.stages) || config.stages.length === 0) {
    throw new Error('Pipeline must have stages array');
  }

  for (const stage of config.stages) {
    if (!stage?.id || typeof stage.id !== 'string') throw new Error('Stage must have an id');
    if (!stage?.name || typeof stage.name !== 'string') throw new Error('Stage must have a name');
    if (!stage?.agent || typeof stage.agent !== 'string') throw new Error('Stage must have an agent');
    if (!stage?.summary || typeof stage.summary !== 'string') throw new Error('Stage must have a summary');
  }

  return true;
}

function pipelineYamlPathById(pipelineId) {
  return path.join(pipelinesDir, `${pipelineId}.yaml`);
}

export function createPipelineDefinition({ pipeline }) {
  validatePipelineShape(pipeline);

  fs.mkdirSync(pipelinesDir, { recursive: true });

  const yamlPath = pipelineYamlPathById(pipeline.id);
  if (fs.existsSync(yamlPath)) {
    throw new Error(`Pipeline YAML already exists: ${pipeline.id}.yaml`);
  }

  // Keep YAML deterministic-ish
  const yamlText = yaml.dump(pipeline, { lineWidth: -1, noRefs: true });
  fs.writeFileSync(yamlPath, yamlText, 'utf8');

  // Ensure caches are invalidated so list endpoint picks it up
  invalidatePipelinesCache();

  return { ok: true, yamlPath };
}
