import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const skillsDir = path.join(__dirname, 'skills');

let allSkills = [];

try {
  const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.json'));
  allSkills = files.map(file => {
    const filePath = path.join(skillsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  });
} catch (e) {
  console.error('Failed to load agent skills:', e);
}

export function listAgents() {
  return allSkills;
}

export function getAgent(id) {
  return allSkills.find((agent) => agent.id === id) ?? null;
}

