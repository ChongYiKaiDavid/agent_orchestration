import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const skillsDir = path.join(__dirname, 'skills');

function loadSkills() {
  try {
    return fs.readdirSync(skillsDir)
      .filter(f => f.endsWith('.json'))
      .map(file => JSON.parse(fs.readFileSync(path.join(skillsDir, file), 'utf8')));
  } catch (e) {
    console.error('Failed to load agent skills:', e);
    return [];
  }
}

export function listAgents() {
  return loadSkills();
}

export function getAgent(id) {
  return loadSkills().find((agent) => agent.id === id) ?? null;
}
