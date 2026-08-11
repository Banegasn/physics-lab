import { D3Q19WindTunnel, type WindTunnelField } from './wind-tunnel.worker';

describe('D3Q19WindTunnel', () => {
  it('voxelizes a built-in body and derives a stable low-Mach relaxation time', () => {
    const fields: WindTunnelField[] = [];
    const tunnel = new D3Q19WindTunnel((field) => fields.push(field));
    tunnel.initialize({
      generation: 1,
      width: 42,
      height: 24,
      depth: 24,
      reynolds: 60,
      inflowVelocity: 0.05,
      obstacle: 0,
      angleDegrees: 0,
    });

    const initial = fields.at(-1)!;
    expect(initial.solid?.some((value) => value === 2)).toBe(true);
    expect(initial.diagnostics.relaxationTime).toBeCloseTo(0.525, 6);
    expect(initial.diagnostics.maximumMach).toBeLessThan(0.1);
  });

  it('maintains finite flow fields and positive drag while the wake develops', () => {
    const fields: WindTunnelField[] = [];
    const tunnel = new D3Q19WindTunnel((field) => fields.push(field));
    tunnel.initialize({
      generation: 2,
      width: 42,
      height: 24,
      depth: 24,
      reynolds: 50,
      inflowVelocity: 0.05,
      obstacle: 1,
      angleDegrees: 8,
    });

    for (let batch = 0; batch < 10; batch++) tunnel.step(5);

    const field = fields.at(-1)!;
    expect(field.diagnostics.stable).toBe(true);
    expect(field.diagnostics.dragCoefficient).toBeGreaterThan(0);
    expect([...field.velocityX].every(Number.isFinite)).toBe(true);
    expect([...field.vorticity].every(Number.isFinite)).toBe(true);
  });

  it('voxelizes a closed imported triangular mesh', () => {
    const vertices = [
      [-0.5, -0.5, -0.5],
      [0.5, -0.5, -0.5],
      [0.5, 0.5, -0.5],
      [-0.5, 0.5, -0.5],
      [-0.5, -0.5, 0.5],
      [0.5, -0.5, 0.5],
      [0.5, 0.5, 0.5],
      [-0.5, 0.5, 0.5],
    ];
    const faces = [
      [0, 2, 1],
      [0, 3, 2],
      [4, 5, 6],
      [4, 6, 7],
      [0, 1, 5],
      [0, 5, 4],
      [3, 7, 6],
      [3, 6, 2],
      [0, 4, 7],
      [0, 7, 3],
      [1, 2, 6],
      [1, 6, 5],
    ];
    const triangles = new Float32Array(
      faces.flatMap((face) => face.flatMap((vertex) => vertices[vertex])),
    );
    const fields: WindTunnelField[] = [];
    const tunnel = new D3Q19WindTunnel((field) => fields.push(field));

    tunnel.initialize({
      generation: 3,
      width: 42,
      height: 24,
      depth: 24,
      reynolds: 50,
      inflowVelocity: 0.05,
      obstacle: 3,
      angleDegrees: 0,
      triangles,
    });

    const field = fields.at(-1)!;
    expect(field.solid?.filter((value) => value === 2).length).toBeGreaterThan(400);
    expect(field.diagnostics.referenceArea).toBeGreaterThan(80);
  });
});
