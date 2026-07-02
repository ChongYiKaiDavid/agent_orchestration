import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

const pipelinesDir = path.resolve(process.cwd(), 'server/pipelines');

/**
 * Load and parse a YAML pipeline configuration file
 */

// Note: pipeline-loader is used by pipeline-loader->pipelines.js in this repo.
// Cache invalidation happens there (server/pipelines.js).
async function loadPipelineFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const config = yaml.load(content);
    return validatePipeline(config);
  } catch (error) {
    throw new Error(`Failed to load pipeline from ${filePath}: ${error.message}`);
  }
}

/**
 * Validate pipeline configuration structure
 */
function validatePipeline(config) {
  if (!config.id || typeof config.id !== 'string') {
    throw new Error('Pipeline must have an id');
  }
  if (!config.name || typeof config.name !== 'string') {
    throw new Error('Pipeline must have a name');
  }
  if (!config.stages || !Array.isArray(config.stages)) {
    throw new Error('Pipeline must have stages array');
  }
  if (config.stages.length === 0) {
    throw new Error('Pipeline must have at least one stage');
  }

  // Validate git configuration if present
  if (config.git) {
    if (config.git.create_branch !== undefined && typeof config.git.create_branch !== 'boolean') {
      throw new Error('git.create_branch must be a boolean');
    }
    if (config.git.from && typeof config.git.from !== 'string') {
      throw new Error('git.from must be a string');
    }
    if (config.git.pattern && typeof config.git.pattern !== 'string') {
      throw new Error('git.pattern must be a string');
    }
    if (config.git.commit_strategy && typeof config.git.commit_strategy !== 'string') {
      throw new Error('git.commit_strategy must be a string');
    }
  }

  // Validate on_complete hooks if present
  if (config.on_complete && Array.isArray(config.on_complete)) {
    for (const hook of config.on_complete) {
      if (!hook.hook || typeof hook.hook !== 'string') {
        throw new Error('on_complete hook must have a hook property');
      }
      if (hook.config && typeof hook.config !== 'object') {
        throw new Error('on_complete hook config must be an object');
      }
    }
  }

  // Validate each stage
  for (const stage of config.stages) {
    if (!stage.id || typeof stage.id !== 'string') {
      throw new Error('Stage must have an id');
    }
    if (!stage.name || typeof stage.name !== 'string') {
      throw new Error('Stage must have a name');
    }
    if (!stage.agent || typeof stage.agent !== 'string') {
      throw new Error('Stage must have an agent');
    }
    if (!stage.summary || typeof stage.summary !== 'string') {
      throw new Error('Stage must have a summary');
    }
  }

  return config;
}

/**
 * Load all pipeline configurations from the pipelines directory
 */
export async function loadPipelines() {
  try {
    await fs.mkdir(pipelinesDir, { recursive: true });
    const files = await fs.readdir(pipelinesDir);
    const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    
    if (yamlFiles.length === 0) {
      console.warn(`[pipeline-loader] No YAML pipeline files found in ${pipelinesDir}, using fallback to JS pipelines`);
      return null;
    }

    const pipelines = [];
    for (const file of yamlFiles) {
      const filePath = path.join(pipelinesDir, file);
      const pipeline = await loadPipelineFile(filePath);
      pipelines.push(pipeline);
    }

    console.log(`[pipeline-loader] Loaded ${pipelines.length} pipeline(s) from YAML files`);
    return pipelines;
  } catch (error) {
    console.error(`[pipeline-loader] Error loading pipelines: ${error.message}`);
    return null;
  }
}

/**
 * Get a specific pipeline by ID from loaded pipelines
 */
export function getPipelineById(pipelines, id) {
  return pipelines?.find(p => p.id === id) || null;
}
