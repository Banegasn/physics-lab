import { describe, expect, it } from 'vitest';
import {
  doublePendulumEnergy,
  duffingEnergy,
  kineticEnergy,
  nBodyEnergy,
  nBodyEnergy3D,
  pendulumEnergy,
  powerLawEnergy,
  scatterEqualMassPair2D,
  scatterEqualMassPair3D,
  stepBoris,
  stepBoris3D,
  stepDoublePendulum,
  stepDuffing,
  stepLorenz,
  stepNBody,
  stepNBody3D,
  stepPendulum,
  stepPowerLaw,
  stepPowerLawSir,
  stepSchrodingerCrankNicolson,
  stepSpringChain,
  springChainEnergy,
  type DuffingState,
  type DoublePendulumState,
  type PendulumState,
  type PhaseBody,
  type PhaseBody3D,
  type SirState,
} from './physics';

describe('scientific solvers', () => {
  it('conserves energy in a fixed-end linear spring chain', () => {
    const count = 16;
    const displacements = new Float64Array(count);
    const velocities = new Float64Array(count);
    for (let index = 0; index < count; index++)
      displacements[index] = 0.6 * Math.sin((3 * Math.PI * (index + 1)) / (count + 1));
    const initialEnergy = springChainEnergy(displacements, velocities, 1.3, 0.8);
    for (let step = 0; step < 20_000; step++)
      stepSpringChain(displacements, velocities, 0.002, 1.3, 0.8);
    expect(
      Math.abs(
        (springChainEnergy(displacements, velocities, 1.3, 0.8) - initialEnergy) / initialEnergy,
      ),
    ).toBeLessThan(1e-6);
  });

  it('conserves Duffing mechanical energy without damping or forcing', () => {
    const state: DuffingState = { position: 0.7, velocity: -0.2 };
    const initialEnergy = duffingEnergy(state, -1, 1);
    let time = 0;
    for (let step = 0; step < 20_000; step++) {
      stepDuffing(state, time, 0.001, -1, 1, 0, 0, 1.2);
      time += 0.001;
    }
    expect(Math.abs((duffingEnergy(state, -1, 1) - initialEnergy) / initialEnergy)).toBeLessThan(
      1e-8,
    );
  });

  it('preserves the exact equilibrium at the Lorenz origin', () => {
    const state = { x: 0, y: 0, z: 0 };
    for (let step = 0; step < 1_000; step++) stepLorenz(state, 0.005, 10, 28, 8 / 3);
    expect(state).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('keeps a circular inverse-square orbit close to its initial energy', () => {
    const body: PhaseBody = { x: 1, y: 0, vx: 0, vy: 1, mass: 1 };
    const initialEnergy = powerLawEnergy(body, 1, 2);
    for (let step = 0; step < 10_000; step++) stepPowerLaw(body, 0.001, 1, 2);
    expect(Math.abs((powerLawEnergy(body, 1, 2) - initialEnergy) / initialEnergy)).toBeLessThan(
      1e-5,
    );
  });

  it('conserves figure-eight energy within numerical tolerance', () => {
    const bodies: PhaseBody[] = [
      { x: -0.97000436, y: 0.24308753, vx: 0.466203685, vy: 0.43236573, mass: 1 },
      { x: 0.97000436, y: -0.24308753, vx: 0.466203685, vy: 0.43236573, mass: 1 },
      { x: 0, y: 0, vx: -0.93240737, vy: -0.86473146, mass: 1 },
    ];
    const initialEnergy = nBodyEnergy(bodies, 1, 0.001);
    for (let step = 0; step < 5_000; step++) stepNBody(bodies, 0.001, 1, 0.001);
    expect(Math.abs((nBodyEnergy(bodies, 1, 0.001) - initialEnergy) / initialEnergy)).toBeLessThan(
      1e-4,
    );
  });

  it('preserves kinetic energy in a purely magnetic field', () => {
    const particle: PhaseBody = { x: 0, y: 0, vx: 0.8, vy: -0.35, mass: 1 };
    const initialEnergy = kineticEnergy(particle);
    for (let step = 0; step < 20_000; step++) stepBoris(particle, 0.002, 1.2, 0, 0, 1.7);
    expect(Math.abs(kineticEnergy(particle) - initialEnergy)).toBeLessThan(1e-10);
  });

  it('preserves speed under a three-dimensional Boris magnetic rotation', () => {
    const particle: PhaseBody3D = {
      x: 0,
      y: 0,
      z: 0,
      vx: 0.8,
      vy: -0.35,
      vz: 0.42,
      mass: 1,
    };
    const initialSpeed = Math.hypot(particle.vx, particle.vy, particle.vz);
    for (let step = 0; step < 20_000; step++)
      stepBoris3D(particle, 0.002, 1.2, [0, 0, 0], [0.4, -0.7, 1.7]);
    expect(Math.abs(Math.hypot(particle.vx, particle.vy, particle.vz) - initialSpeed)).toBeLessThan(
      1e-11,
    );
  });

  it('conserves momentum and energy in an equal-mass 2D collision', () => {
    const first: PhaseBody = { x: 0, y: 0, vx: 1.2, vy: -0.4, mass: 1 };
    const second: PhaseBody = { x: 0, y: 0, vx: -0.3, vy: 0.8, mass: 1 };
    const initialMomentum = { x: first.vx + second.vx, y: first.vy + second.vy };
    const initialEnergy = kineticEnergy(first) + kineticEnergy(second);
    scatterEqualMassPair2D(first, second, 1.17);
    expect(first.vx + second.vx).toBeCloseTo(initialMomentum.x, 14);
    expect(first.vy + second.vy).toBeCloseTo(initialMomentum.y, 14);
    expect(kineticEnergy(first) + kineticEnergy(second)).toBeCloseTo(initialEnergy, 14);
  });

  it('conserves momentum and energy in an equal-mass 3D collision', () => {
    const first: PhaseBody3D = {
      x: 0,
      y: 0,
      z: 0,
      vx: 0.9,
      vy: -0.4,
      vz: 0.2,
      mass: 1,
    };
    const second: PhaseBody3D = {
      x: 0,
      y: 0,
      z: 0,
      vx: -0.1,
      vy: 0.7,
      vz: -0.6,
      mass: 1,
    };
    const initialMomentum = {
      x: first.vx + second.vx,
      y: first.vy + second.vy,
      z: first.vz + second.vz,
    };
    const energy = (body: PhaseBody3D): number =>
      0.5 * (body.vx ** 2 + body.vy ** 2 + body.vz ** 2);
    const initialEnergy = energy(first) + energy(second);
    scatterEqualMassPair3D(first, second, [0.2, -0.7, 0.4]);
    expect(first.vx + second.vx).toBeCloseTo(initialMomentum.x, 14);
    expect(first.vy + second.vy).toBeCloseTo(initialMomentum.y, 14);
    expect(first.vz + second.vz).toBeCloseTo(initialMomentum.z, 14);
    expect(energy(first) + energy(second)).toBeCloseTo(initialEnergy, 14);
  });

  it('bounds energy drift for a three-dimensional two-body orbit', () => {
    const bodies: PhaseBody3D[] = [
      { x: -0.5, y: 0, z: 0, vx: 0, vy: -0.5, vz: 0, mass: 0.5 },
      { x: 0.5, y: 0, z: 0, vx: 0, vy: 0.5, vz: 0, mass: 0.5 },
    ];
    const initialEnergy = nBodyEnergy3D(bodies, 1, 0.001);
    for (let step = 0; step < 10_000; step++) stepNBody3D(bodies, 0.001, 1, 0.001);
    expect(
      Math.abs((nBodyEnergy3D(bodies, 1, 0.001) - initialEnergy) / initialEnergy),
    ).toBeLessThan(1e-5);
  });

  it('bounds nonlinear pendulum energy drift', () => {
    const pendulum: PendulumState = { angle: 0.8, angularVelocity: 0, length: 1.3 };
    const initialEnergy = pendulumEnergy(pendulum, 1);
    for (let step = 0; step < 20_000; step++) stepPendulum(pendulum, 0.002, 1);
    expect(Math.abs((pendulumEnergy(pendulum, 1) - initialEnergy) / initialEnergy)).toBeLessThan(
      1e-5,
    );
  });

  it('conserves total population in the power-law SIR model', () => {
    const state: SirState = { susceptible: 0.99, infected: 0.01, recovered: 0 };
    for (let step = 0; step < 5_000; step++) stepPowerLawSir(state, 0.002, 0.5, 0.14, 0.9);
    expect(state.susceptible + state.infected + state.recovered).toBeCloseTo(1, 10);
    expect(state.infected).toBeGreaterThanOrEqual(0);
  });

  it('keeps double-pendulum energy bounded with a small RK4 step', () => {
    const state: DoublePendulumState = {
      angle1: 1.2,
      angle2: 0.7,
      angularVelocity1: 0,
      angularVelocity2: 0,
    };
    const initialEnergy = doublePendulumEnergy(state, 1, 1, 1);
    for (let step = 0; step < 10_000; step++) stepDoublePendulum(state, 0.0005, 1, 1, 1);
    expect(
      Math.abs((doublePendulumEnergy(state, 1, 1, 1) - initialEnergy) / initialEnergy),
    ).toBeLessThan(1e-8);
  });

  it('conserves wavefunction norm under Crank–Nicolson evolution', () => {
    const points = 180;
    const spatialStep = 16 / (points - 1);
    const real = new Float64Array(points);
    const imaginary = new Float64Array(points);
    const potential = new Float64Array(points);
    for (let index = 1; index < points - 1; index++) {
      const x = -8 + index * spatialStep;
      const envelope = Math.exp(-((x + 4) ** 2) / (2 * 0.7 ** 2));
      real[index] = envelope * Math.cos(3 * x);
      imaginary[index] = envelope * Math.sin(3 * x);
      if (Math.abs(x) < 0.4) potential[index] = 6;
    }
    const norm = (): number =>
      real.reduce(
        (sum, value, index) => sum + (value ** 2 + imaginary[index] ** 2) * spatialStep,
        0,
      );
    const initialNorm = norm();
    for (let step = 0; step < 800; step++)
      stepSchrodingerCrankNicolson(real, imaginary, potential, spatialStep, 0.002);
    expect(Math.abs((norm() - initialNorm) / initialNorm)).toBeLessThan(1e-10);
  });
});
