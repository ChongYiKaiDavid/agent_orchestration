import { describe, expect, it } from 'vitest';
import { listAgents, getAgent } from '../agents.js';

describe('Agent definitions', () => {
  it('returns the full agent list', () => {
    const agents = listAgents();

    expect(agents).toHaveLength(1);
    expect(agents[0].id).toBe('devin');
  });

  it('returns a specific agent by id', () => {
    const agent = getAgent('devin');

    expect(agent).not.toBeNull();
    expect(agent?.label).toBe('Devin');
  });

  it('returns null for unknown agent ids', () => {
    expect(getAgent('missing')).toBeNull();
  });
});
