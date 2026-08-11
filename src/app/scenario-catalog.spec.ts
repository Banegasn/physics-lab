import { SCENARIOS, SCENARIO_IDS, getScenarioBySlug } from './scenario-catalog';

describe('scenario catalog', () => {
  it('contains a unique static route for every simulation', () => {
    expect(SCENARIOS).toHaveLength(18);
    expect(new Set(SCENARIOS.map(({ id }) => id)).size).toBe(SCENARIO_IDS.length);
    expect(new Set(SCENARIOS.map(({ slug }) => slug)).size).toBe(SCENARIOS.length);
  });

  it('resolves the vortex-street simulation by its public slug', () => {
    expect(getScenarioBySlug('vortex-street-fluid').id).toBe('fluid');
  });

  it('resolves the three-dimensional wind tunnel by its public slug', () => {
    expect(getScenarioBySlug('wind-tunnel-3d').id).toBe('windTunnel3d');
  });
});
