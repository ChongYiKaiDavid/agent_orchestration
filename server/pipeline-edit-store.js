import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { invalidatePipelinesCache } from './pipelines.js';

const overridesPath = path.resolve(process.cwd(), 'server', 'pipeline-overrides.json');
const pipelinesDir = path.resolve(process.cwd(), 'server', 'pipelines');

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonSafe(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function pipelineYamlPathById(pipelineId) {
  // Prefer exact match by filename convention: {id}.yaml
  const candidate = path.join(pipelinesDir, `${pipelineId}.yaml`);
  if (fs.existsSync(candidate)) return candidate;
  const candidateYml = path.join(pipelinesDir, `${pipelineId}.yml`);
  if (fs.existsSync(candidateYml)) return candidateYml;

  // Otherwise, try to find any yaml file whose parsed id matches.
  // This is slower but only needed for rare cases.
  const files = fs.readdirSync(pipelinesDir);
  for (const f of files) {
    if (!f.endsWith('.yaml') && !f.endsWith('.yml')) continue;
    const fp = path.join(pipelinesDir, f);
    const content = fs.readFileSync(fp, 'utf8');
    const config = yaml.load(content);
    if (config?.id === pipelineId) return fp;
  }
  return null;
}

function pipelineYamlTextById(pipelineId) {
  const yamlPath = pipelineYamlPathById(pipelineId);
  if (!yamlPath) {
    return { yamlPath: null, yamlText: null };
  }

  return {
    yamlPath,
    yamlText: fs.readFileSync(yamlPath, 'utf8'),
  };
}

function validatePipeline(config) {
  if (!config?.id || typeof config.id !== 'string') throw new Error('Pipeline must have an id');
  if (!config?.name || typeof config.name !== 'string') throw new Error('Pipeline must have a name');
  if (!Array.isArray(config.stages) || config.stages.length === 0) throw new Error('Pipeline must have at least one stage');

  for (const stage of config.stages) {
    if (!stage.id || typeof stage.id !== 'string') throw new Error('Stage must have an id');
    if (!stage.name || typeof stage.name !== 'string') throw new Error('Stage must have a name');
    if (!stage.agent || typeof stage.agent !== 'string') throw new Error('Stage must have an agent');
    if (!stage.summary || typeof stage.summary !== 'string') throw new Error('Stage must have a summary');
  }
  return true;
}

export function getOverrides() {
  return readJsonSafe(overridesPath, {});
}

export function setOverrides(next) {
  writeJsonSafe(overridesPath, next);
}

export function clearOverridesForPipeline(pipelineId) {
  const overrides = getOverrides();
  if (overrides?.[pipelineId]) {
    delete overrides[pipelineId];
    setOverrides(overrides);
  }
}

export function deletePipelineYaml(pipelineId) {
  const yamlPath = pipelineYamlPathById(pipelineId);
  if (!yamlPath) {
    // nothing to delete
    return { ok: true, deleted: false, yamlPath: null };
  }

  fs.unlinkSync(yamlPath);
  return { ok: true, deleted: true, yamlPath };
}

export function getPipelineYamlPreview(pipeline) {
  if (!pipeline?.id) {
    return { yamlPath: null, yamlText: '' };
  }

  const fromFile = pipelineYamlTextById(pipeline.id);
  if (fromFile.yamlText !== null) {
    return fromFile;
  }

  return {
    yamlPath: null,
    yamlText: yaml.dump(pipeline, { lineWidth: -1, noRefs: true }),
  };
}

export function savePipelineYaml(pipelineId, yamlText) {
  if (typeof yamlText !== 'string' || !yamlText.trim()) {
    throw new Error('Pipeline YAML text is required');
  }

  const yamlPath = pipelineYamlPathById(pipelineId);
  if (!yamlPath) {
    throw new Error(`No YAML file found for pipeline id '${pipelineId}' in server/pipelines`);
  }

  const parsed = yaml.load(yamlText);
  validatePipeline(parsed);
  if (parsed.id !== pipelineId) {
    throw new Error(`Pipeline YAML id must remain '${pipelineId}'`);
  }

  fs.writeFileSync(yamlPath, yamlText, 'utf8');
  invalidatePipelinesCache();
  clearOverridesForPipeline(pipelineId);

  return { ok: true, yamlPath };
}

export function getEffectivePipeline(pipeline) {
  if (!pipeline?.id) return pipeline;
  const overrides = getOverrides();
  const override = overrides[pipeline.id];
  if (!override) return pipeline;

  // Shallow merge top-level, and stage-by-stage merge by stage.id.
  const merged = {
    ...pipeline,
    ...override,
  };

  if (Array.isArray(pipeline.stages) && Array.isArray(override?.stages)) {
    const byStageId = new Map(pipeline.stages.map((s) => [s.id, { ...s }]));
    for (const oStage of override.stages) {
      if (!oStage?.id || !byStageId.has(oStage.id)) continue;
      byStageId.set(oStage.id, {
        ...byStageId.get(oStage.id),
        ...oStage,
      });
    }
    merged.stages = Array.from(byStageId.values());
  }

  return merged;
}

export function updatePipelineOverrides(pipelineId, patch) {
  const overrides = getOverrides();
  overrides[pipelineId] = overrides[pipelineId] || {};

  // Update uses full pipeline shape for stages; simpler & safer.
  if (patch?.stages) overrides[pipelineId].stages = patch.stages;
  if (typeof patch?.name === 'string') overrides[pipelineId].name = patch.name;
  if (typeof patch?.description === 'string') overrides[pipelineId].description = patch.description;

  setOverrides(overrides);
}

export function applyOverridesToYaml(pipelineId, effectivePipeline) {
  const yamlPath = pipelineYamlPathById(pipelineId);
  if (!yamlPath) throw new Error(`No YAML file found for pipeline id '${pipelineId}' in server/pipelines`);

  validatePipeline(effectivePipeline);

  // Do not persist stage.agent in YAML
  // Stage.agent is required for execution, but YAML does not store it
  const sanitized = {
    ...effectivePipeline,
    stages: effectivePipeline.stages.map((s) => {
      const { agent, ...rest } = s;
      return rest;
    }),
  };

  const yamlText = yaml.dump(sanitized, { lineWidth: -1, noRefs: true });
  fs.writeFileSync(yamlPath, yamlText, 'utf8');
}

export function persistPipelineEdit({ pipelineId, updatedPipeline, writeToYaml }) {
  const overridesBefore = getOverrides();

  // Always store override first so UI can reflect immediately.
  // This ensures we don't depend on YAML correctness during edit.
  updatePipelineOverrides(pipelineId, updatedPipeline);

  if (writeToYaml) {
    // Read current YAML pipeline, apply effective merge (including overrides), and overwrite YAML.
    const yamlPath = pipelineYamlPathById(pipelineId);
    if (!yamlPath) throw new Error(`No YAML file found for pipeline id '${pipelineId}' in server/pipelines`);

    const content = fs.readFileSync(yamlPath, 'utf8');
    const currentYamlPipeline = yaml.load(content);

    const effective = getEffectivePipeline({
      ...currentYamlPipeline,
      ...updatedPipeline,
      id: pipelineId,
    });

    // Apply YAML overwrite
    applyOverridesToYaml(pipelineId, effective);
    invalidatePipelinesCache();

    // Clear override after successful YAML write
    const overridesAfter = getOverrides();
    if (overridesAfter?.[pipelineId]) {
      delete overridesAfter[pipelineId];
      setOverrides(overridesAfter);
    }

    return { ok: true, writtenToYaml: true, yamlPath };
  }

  return { ok: true, writtenToYaml: false, overridesBefore };
}
