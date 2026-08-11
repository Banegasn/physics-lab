import { D2Q9Fluid } from './fluid';

describe('D2Q9Fluid', () => {
  it('derives the BGK relaxation time from Reynolds number', () => {
    const fluid = new D2Q9Fluid(72, 36);
    fluid.reset({
      reynolds: 120,
      inflowVelocity: 0.05,
      obstacleRadius: 5,
      obstacleShape: 0,
    });

    expect(fluid.diagnostics.viscosity).toBeCloseTo((0.05 * 10) / 120, 8);
    expect(fluid.diagnostics.relaxationTime).toBeCloseTo(0.5 + 3 * ((0.05 * 10) / 120), 8);
  });

  it('keeps finite macroscopic fields while a wake develops', () => {
    const fluid = new D2Q9Fluid(72, 36);
    fluid.reset({
      reynolds: 100,
      inflowVelocity: 0.05,
      obstacleRadius: 5,
      obstacleShape: 0,
    });

    for (let step = 0; step < 80; step++) fluid.step();

    expect(fluid.diagnostics.stable).toBe(true);
    expect([...fluid.density].every(Number.isFinite)).toBe(true);
    expect([...fluid.velocityX].every(Number.isFinite)).toBe(true);
    expect(fluid.diagnostics.dragCoefficient).toBeGreaterThan(0);
  });

  it.each([
    { reynolds: 40, inflowVelocity: 0.07, obstacleRadius: 6 },
    { reynolds: 200, inflowVelocity: 0.035, obstacleRadius: 5 },
  ])(
    'remains stable at a supported parameter boundary: Re $reynolds',
    ({ reynolds, inflowVelocity, obstacleRadius }) => {
      const fluid = new D2Q9Fluid(72, 36);
      fluid.reset({ reynolds, inflowVelocity, obstacleRadius, obstacleShape: 0 });

      for (let step = 0; step < 160; step++) fluid.step();

      expect(fluid.diagnostics.stable).toBe(true);
      expect(fluid.diagnostics.maximumMach).toBeLessThan(0.13);
    },
  );

  it('detects a physically plausible shedding frequency after the startup transient', () => {
    const fluid = new D2Q9Fluid(72, 36);
    fluid.reset({
      reynolds: 100,
      inflowVelocity: 0.06,
      obstacleRadius: 5,
      obstacleShape: 0,
    });

    for (let step = 0; step < 5200; step++) fluid.step();

    expect(fluid.diagnostics.stable).toBe(true);
    expect(fluid.diagnostics.strouhalNumber).not.toBeNull();
    expect(fluid.diagnostics.strouhalNumber!).toBeGreaterThan(0.08);
    expect(fluid.diagnostics.strouhalNumber!).toBeLessThan(0.35);
  });

  it('marks channel walls and the selected obstacle as solid', () => {
    const fluid = new D2Q9Fluid(72, 36);
    fluid.reset({
      reynolds: 100,
      inflowVelocity: 0.05,
      obstacleRadius: 5,
      obstacleShape: 1,
    });

    expect(fluid.isSolidAt(10, 0)).toBe(true);
    expect(fluid.isSolidAt(Math.round(72 * 0.28), 18)).toBe(true);
    expect(fluid.isSolidAt(60, 18)).toBe(false);
  });
});
