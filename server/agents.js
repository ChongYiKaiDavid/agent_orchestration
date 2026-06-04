export const agents = [
  {
    id: 'devin',
    label: 'Devin',
    description: 'Stateless prompt-driven agent invoked through the Devin CLI.',
    reads: ['task.json', 'planner.requirements.md', 'implementation.diff.md', 'reviewer.review.md'],
    writes: ['planner.requirements.md', 'planner.design.md', 'implementation.diff.md', 'reviewer.review.md'],
    promptTemplate: 'Use Devin to complete the current pipeline stage based on task inputs and prior artifacts.',
  },
];

export function listAgents() {
  return agents;
}

export function getAgent(id) {
  return agents.find((agent) => agent.id === id) ?? null;
}
