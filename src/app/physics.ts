export interface PhaseBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
}

export interface PhaseBody3D extends PhaseBody {
  z: number;
  vz: number;
}

export interface LorenzState {
  x: number;
  y: number;
  z: number;
}

export interface DuffingState {
  position: number;
  velocity: number;
}

interface Acceleration {
  x: number;
  y: number;
}

interface Acceleration3D extends Acceleration {
  z: number;
}

export function springChainAccelerations(
  displacements: Float64Array,
  springConstant: number,
  mass: number,
): Float64Array {
  const accelerations = new Float64Array(displacements.length);
  for (let index = 0; index < displacements.length; index++) {
    const left = index === 0 ? 0 : displacements[index - 1];
    const right = index === displacements.length - 1 ? 0 : displacements[index + 1];
    accelerations[index] = (springConstant / mass) * (left - 2 * displacements[index] + right);
  }
  return accelerations;
}

export function stepSpringChain(
  displacements: Float64Array,
  velocities: Float64Array,
  timeStep: number,
  springConstant: number,
  mass: number,
): void {
  const initial = springChainAccelerations(displacements, springConstant, mass);
  for (let index = 0; index < displacements.length; index++) {
    velocities[index] += 0.5 * initial[index] * timeStep;
    displacements[index] += velocities[index] * timeStep;
  }
  const final = springChainAccelerations(displacements, springConstant, mass);
  for (let index = 0; index < displacements.length; index++)
    velocities[index] += 0.5 * final[index] * timeStep;
}

export function springChainEnergy(
  displacements: Float64Array,
  velocities: Float64Array,
  springConstant: number,
  mass: number,
): number {
  let energy = 0;
  let previous = 0;
  for (let index = 0; index < displacements.length; index++) {
    energy += 0.5 * mass * velocities[index] ** 2;
    energy += 0.5 * springConstant * (displacements[index] - previous) ** 2;
    previous = displacements[index];
  }
  energy += 0.5 * springConstant * previous ** 2;
  return energy;
}

export function stepDuffing(
  state: DuffingState,
  time: number,
  timeStep: number,
  linearStiffness: number,
  cubicStiffness: number,
  damping: number,
  driveAmplitude: number,
  driveFrequency: number,
): void {
  const derivative = (sample: DuffingState, sampleTime: number): DuffingState => ({
    position: sample.velocity,
    velocity:
      driveAmplitude * Math.cos(driveFrequency * sampleTime) -
      damping * sample.velocity -
      linearStiffness * sample.position -
      cubicStiffness * sample.position ** 3,
  });
  const add = (base: DuffingState, slope: DuffingState, scale: number): DuffingState => ({
    position: base.position + slope.position * scale,
    velocity: base.velocity + slope.velocity * scale,
  });
  const first = derivative(state, time);
  const second = derivative(add(state, first, timeStep / 2), time + timeStep / 2);
  const third = derivative(add(state, second, timeStep / 2), time + timeStep / 2);
  const fourth = derivative(add(state, third, timeStep), time + timeStep);
  state.position +=
    (timeStep / 6) * (first.position + 2 * second.position + 2 * third.position + fourth.position);
  state.velocity +=
    (timeStep / 6) * (first.velocity + 2 * second.velocity + 2 * third.velocity + fourth.velocity);
}

export function duffingEnergy(
  state: DuffingState,
  linearStiffness: number,
  cubicStiffness: number,
): number {
  return (
    0.5 * state.velocity ** 2 +
    0.5 * linearStiffness * state.position ** 2 +
    0.25 * cubicStiffness * state.position ** 4
  );
}

export function stepLorenz(
  state: LorenzState,
  timeStep: number,
  sigma: number,
  rho: number,
  beta: number,
): void {
  const derivative = (sample: LorenzState): LorenzState => ({
    x: sigma * (sample.y - sample.x),
    y: sample.x * (rho - sample.z) - sample.y,
    z: sample.x * sample.y - beta * sample.z,
  });
  const add = (base: LorenzState, slope: LorenzState, scale: number): LorenzState => ({
    x: base.x + slope.x * scale,
    y: base.y + slope.y * scale,
    z: base.z + slope.z * scale,
  });
  const first = derivative(state);
  const second = derivative(add(state, first, timeStep / 2));
  const third = derivative(add(state, second, timeStep / 2));
  const fourth = derivative(add(state, third, timeStep));
  state.x += (timeStep / 6) * (first.x + 2 * second.x + 2 * third.x + fourth.x);
  state.y += (timeStep / 6) * (first.y + 2 * second.y + 2 * third.y + fourth.y);
  state.z += (timeStep / 6) * (first.z + 2 * second.z + 2 * third.z + fourth.z);
}

export interface PendulumState {
  angle: number;
  angularVelocity: number;
  length: number;
}

export interface SirState {
  susceptible: number;
  infected: number;
  recovered: number;
}

export interface DoublePendulumState {
  angle1: number;
  angle2: number;
  angularVelocity1: number;
  angularVelocity2: number;
}

export function stepSchrodingerCrankNicolson(
  real: Float64Array,
  imaginary: Float64Array,
  potential: Float64Array,
  spatialStep: number,
  timeStep: number,
): void {
  const interior = real.length - 2;
  const cReal = new Float64Array(interior);
  const cImaginary = new Float64Array(interior);
  const dReal = new Float64Array(interior);
  const dImaginary = new Float64Array(interior);
  const inverseSpatialStepSquared = 1 / spatialStep ** 2;
  const hamiltonianOffDiagonal = -0.5 * inverseSpatialStepSquared;
  const matrixOffImaginary = 0.5 * timeStep * hamiltonianOffDiagonal;

  const divide = (
    numeratorReal: number,
    numeratorImaginary: number,
    denominatorReal: number,
    denominatorImaginary: number,
  ): [number, number] => {
    const denominator = denominatorReal ** 2 + denominatorImaginary ** 2;
    return [
      (numeratorReal * denominatorReal + numeratorImaginary * denominatorImaginary) / denominator,
      (numeratorImaginary * denominatorReal - numeratorReal * denominatorImaginary) / denominator,
    ];
  };

  for (let row = 0; row < interior; row++) {
    const index = row + 1;
    const hamiltonianDiagonal = inverseSpatialStepSquared + potential[index];
    const hamiltonianReal =
      hamiltonianDiagonal * real[index] +
      hamiltonianOffDiagonal * (real[index - 1] + real[index + 1]);
    const hamiltonianImaginary =
      hamiltonianDiagonal * imaginary[index] +
      hamiltonianOffDiagonal * (imaginary[index - 1] + imaginary[index + 1]);
    let rightReal = real[index] + 0.5 * timeStep * hamiltonianImaginary;
    let rightImaginary = imaginary[index] - 0.5 * timeStep * hamiltonianReal;
    let diagonalReal = 1;
    let diagonalImaginary = 0.5 * timeStep * hamiltonianDiagonal;

    if (row > 0) {
      const productReal = -matrixOffImaginary * cImaginary[row - 1];
      const productImaginary = matrixOffImaginary * cReal[row - 1];
      diagonalReal -= productReal;
      diagonalImaginary -= productImaginary;
      const rightProductReal = -matrixOffImaginary * dImaginary[row - 1];
      const rightProductImaginary = matrixOffImaginary * dReal[row - 1];
      rightReal -= rightProductReal;
      rightImaginary -= rightProductImaginary;
    }
    if (row < interior - 1) {
      [cReal[row], cImaginary[row]] = divide(
        0,
        matrixOffImaginary,
        diagonalReal,
        diagonalImaginary,
      );
    }
    [dReal[row], dImaginary[row]] = divide(
      rightReal,
      rightImaginary,
      diagonalReal,
      diagonalImaginary,
    );
  }

  for (let row = interior - 1; row >= 0; row--) {
    if (row === interior - 1) {
      real[row + 1] = dReal[row];
      imaginary[row + 1] = dImaginary[row];
    } else {
      const productReal = cReal[row] * real[row + 2] - cImaginary[row] * imaginary[row + 2];
      const productImaginary = cReal[row] * imaginary[row + 2] + cImaginary[row] * real[row + 2];
      real[row + 1] = dReal[row] - productReal;
      imaginary[row + 1] = dImaginary[row] - productImaginary;
    }
  }
  real[0] = 0;
  imaginary[0] = 0;
  real[real.length - 1] = 0;
  imaginary[imaginary.length - 1] = 0;
}

export function stepPowerLawSir(
  state: SirState,
  timeStep: number,
  transmissionRate: number,
  recoveryRate: number,
  incidenceExponent: number,
): void {
  const derivative = (sample: SirState): SirState => {
    const incidence =
      transmissionRate * Math.max(sample.susceptible, 0) ** incidenceExponent * sample.infected;
    return {
      susceptible: -incidence,
      infected: incidence - recoveryRate * sample.infected,
      recovered: recoveryRate * sample.infected,
    };
  };
  const shifted = (base: SirState, slope: SirState, scale: number): SirState => ({
    susceptible: base.susceptible + slope.susceptible * scale,
    infected: base.infected + slope.infected * scale,
    recovered: base.recovered + slope.recovered * scale,
  });
  const first = derivative(state);
  const second = derivative(shifted(state, first, timeStep / 2));
  const third = derivative(shifted(state, second, timeStep / 2));
  const fourth = derivative(shifted(state, third, timeStep));
  state.susceptible +=
    (timeStep / 6) *
    (first.susceptible + 2 * second.susceptible + 2 * third.susceptible + fourth.susceptible);
  state.infected +=
    (timeStep / 6) * (first.infected + 2 * second.infected + 2 * third.infected + fourth.infected);
  state.recovered +=
    (timeStep / 6) *
    (first.recovered + 2 * second.recovered + 2 * third.recovered + fourth.recovered);
}

function doublePendulumDerivative(
  state: DoublePendulumState,
  massRatio: number,
  lengthRatio: number,
  gravity: number,
): DoublePendulumState {
  const mass1 = 1;
  const mass2 = massRatio;
  const length1 = 1;
  const length2 = lengthRatio;
  const delta = state.angle1 - state.angle2;
  const shared = 2 * mass1 + mass2 - mass2 * Math.cos(2 * delta);
  const acceleration1 =
    (-gravity * (2 * mass1 + mass2) * Math.sin(state.angle1) -
      mass2 * gravity * Math.sin(state.angle1 - 2 * state.angle2) -
      2 *
        Math.sin(delta) *
        mass2 *
        (state.angularVelocity2 ** 2 * length2 +
          state.angularVelocity1 ** 2 * length1 * Math.cos(delta))) /
    (length1 * shared);
  const acceleration2 =
    (2 *
      Math.sin(delta) *
      (state.angularVelocity1 ** 2 * length1 * (mass1 + mass2) +
        gravity * (mass1 + mass2) * Math.cos(state.angle1) +
        state.angularVelocity2 ** 2 * length2 * mass2 * Math.cos(delta))) /
    (length2 * shared);
  return {
    angle1: state.angularVelocity1,
    angle2: state.angularVelocity2,
    angularVelocity1: acceleration1,
    angularVelocity2: acceleration2,
  };
}

export function stepDoublePendulum(
  state: DoublePendulumState,
  timeStep: number,
  massRatio: number,
  lengthRatio: number,
  gravity: number,
): void {
  const add = (
    base: DoublePendulumState,
    slope: DoublePendulumState,
    scale: number,
  ): DoublePendulumState => ({
    angle1: base.angle1 + slope.angle1 * scale,
    angle2: base.angle2 + slope.angle2 * scale,
    angularVelocity1: base.angularVelocity1 + slope.angularVelocity1 * scale,
    angularVelocity2: base.angularVelocity2 + slope.angularVelocity2 * scale,
  });
  const first = doublePendulumDerivative(state, massRatio, lengthRatio, gravity);
  const second = doublePendulumDerivative(
    add(state, first, timeStep / 2),
    massRatio,
    lengthRatio,
    gravity,
  );
  const third = doublePendulumDerivative(
    add(state, second, timeStep / 2),
    massRatio,
    lengthRatio,
    gravity,
  );
  const fourth = doublePendulumDerivative(
    add(state, third, timeStep),
    massRatio,
    lengthRatio,
    gravity,
  );
  state.angle1 +=
    (timeStep / 6) * (first.angle1 + 2 * second.angle1 + 2 * third.angle1 + fourth.angle1);
  state.angle2 +=
    (timeStep / 6) * (first.angle2 + 2 * second.angle2 + 2 * third.angle2 + fourth.angle2);
  state.angularVelocity1 +=
    (timeStep / 6) *
    (first.angularVelocity1 +
      2 * second.angularVelocity1 +
      2 * third.angularVelocity1 +
      fourth.angularVelocity1);
  state.angularVelocity2 +=
    (timeStep / 6) *
    (first.angularVelocity2 +
      2 * second.angularVelocity2 +
      2 * third.angularVelocity2 +
      fourth.angularVelocity2);
}

export function doublePendulumEnergy(
  state: DoublePendulumState,
  massRatio: number,
  lengthRatio: number,
  gravity: number,
): number {
  const delta = state.angle1 - state.angle2;
  const kinetic =
    0.5 * (1 + massRatio) * state.angularVelocity1 ** 2 +
    0.5 * massRatio * lengthRatio ** 2 * state.angularVelocity2 ** 2 +
    massRatio * lengthRatio * state.angularVelocity1 * state.angularVelocity2 * Math.cos(delta);
  const potential =
    -(1 + massRatio) * gravity * Math.cos(state.angle1) -
    massRatio * gravity * lengthRatio * Math.cos(state.angle2);
  return kinetic + potential;
}

export function stepBoris(
  body: PhaseBody,
  timeStep: number,
  chargeToMass: number,
  electricX: number,
  electricY: number,
  magneticZ: number,
): void {
  const halfElectricX = 0.5 * chargeToMass * electricX * timeStep;
  const halfElectricY = 0.5 * chargeToMass * electricY * timeStep;
  const minusX = body.vx + halfElectricX;
  const minusY = body.vy + halfElectricY;
  const rotation = 0.5 * chargeToMass * magneticZ * timeStep;
  const rotationScale = (2 * rotation) / (1 + rotation ** 2);
  const primeX = minusX + minusY * rotation;
  const primeY = minusY - minusX * rotation;
  body.vx = minusX + primeY * rotationScale + halfElectricX;
  body.vy = minusY - primeX * rotationScale + halfElectricY;
  body.x += body.vx * timeStep;
  body.y += body.vy * timeStep;
}

export function stepBoris3D(
  body: PhaseBody3D,
  timeStep: number,
  chargeToMass: number,
  electricField: readonly [number, number, number],
  magneticField: readonly [number, number, number],
): void {
  const halfElectricScale = 0.5 * chargeToMass * timeStep;
  const minusX = body.vx + halfElectricScale * electricField[0];
  const minusY = body.vy + halfElectricScale * electricField[1];
  const minusZ = body.vz + halfElectricScale * electricField[2];
  const tx = halfElectricScale * magneticField[0];
  const ty = halfElectricScale * magneticField[1];
  const tz = halfElectricScale * magneticField[2];
  const tSquared = tx * tx + ty * ty + tz * tz;
  const scale = 2 / (1 + tSquared);
  const sx = scale * tx;
  const sy = scale * ty;
  const sz = scale * tz;
  const primeX = minusX + minusY * tz - minusZ * ty;
  const primeY = minusY + minusZ * tx - minusX * tz;
  const primeZ = minusZ + minusX * ty - minusY * tx;
  body.vx = minusX + primeY * sz - primeZ * sy + halfElectricScale * electricField[0];
  body.vy = minusY + primeZ * sx - primeX * sz + halfElectricScale * electricField[1];
  body.vz = minusZ + primeX * sy - primeY * sx + halfElectricScale * electricField[2];
  body.x += body.vx * timeStep;
  body.y += body.vy * timeStep;
  body.z += body.vz * timeStep;
}

export function scatterEqualMassPair2D(
  first: PhaseBody,
  second: PhaseBody,
  scatteringAngle: number,
): void {
  const centerX = 0.5 * (first.vx + second.vx);
  const centerY = 0.5 * (first.vy + second.vy);
  const relativeSpeed = Math.hypot(first.vx - second.vx, first.vy - second.vy);
  const relativeX = relativeSpeed * Math.cos(scatteringAngle);
  const relativeY = relativeSpeed * Math.sin(scatteringAngle);
  first.vx = centerX + 0.5 * relativeX;
  first.vy = centerY + 0.5 * relativeY;
  second.vx = centerX - 0.5 * relativeX;
  second.vy = centerY - 0.5 * relativeY;
}

export function scatterEqualMassPair3D(
  first: PhaseBody3D,
  second: PhaseBody3D,
  direction: readonly [number, number, number],
): void {
  const centerX = 0.5 * (first.vx + second.vx);
  const centerY = 0.5 * (first.vy + second.vy);
  const centerZ = 0.5 * (first.vz + second.vz);
  const relativeSpeed = Math.hypot(
    first.vx - second.vx,
    first.vy - second.vy,
    first.vz - second.vz,
  );
  const directionNorm = Math.max(Math.hypot(...direction), Number.EPSILON);
  const relativeX = (relativeSpeed * direction[0]) / directionNorm;
  const relativeY = (relativeSpeed * direction[1]) / directionNorm;
  const relativeZ = (relativeSpeed * direction[2]) / directionNorm;
  first.vx = centerX + 0.5 * relativeX;
  first.vy = centerY + 0.5 * relativeY;
  first.vz = centerZ + 0.5 * relativeZ;
  second.vx = centerX - 0.5 * relativeX;
  second.vy = centerY - 0.5 * relativeY;
  second.vz = centerZ - 0.5 * relativeZ;
}

export function kineticEnergy(body: PhaseBody): number {
  return 0.5 * body.mass * (body.vx ** 2 + body.vy ** 2);
}

export function stepPendulum(
  pendulum: PendulumState,
  timeStep: number,
  gravitationalAcceleration: number,
): void {
  const initialAcceleration =
    (-gravitationalAcceleration / pendulum.length) * Math.sin(pendulum.angle);
  pendulum.angularVelocity += 0.5 * initialAcceleration * timeStep;
  pendulum.angle += pendulum.angularVelocity * timeStep;
  const finalAcceleration =
    (-gravitationalAcceleration / pendulum.length) * Math.sin(pendulum.angle);
  pendulum.angularVelocity += 0.5 * finalAcceleration * timeStep;
}

export function pendulumEnergy(pendulum: PendulumState, gravitationalAcceleration: number): number {
  return (
    0.5 * pendulum.length ** 2 * pendulum.angularVelocity ** 2 +
    gravitationalAcceleration * pendulum.length * (1 - Math.cos(pendulum.angle))
  );
}

export function powerLawAcceleration(
  body: PhaseBody,
  strength: number,
  exponent: number,
): Acceleration {
  const radius = Math.max(Math.hypot(body.x, body.y), 1e-6);
  const factor = -strength / radius ** (exponent + 1);
  return { x: factor * body.x, y: factor * body.y };
}

export function stepPowerLaw(
  body: PhaseBody,
  timeStep: number,
  strength: number,
  exponent: number,
): void {
  const initial = powerLawAcceleration(body, strength, exponent);
  body.vx += 0.5 * initial.x * timeStep;
  body.vy += 0.5 * initial.y * timeStep;
  body.x += body.vx * timeStep;
  body.y += body.vy * timeStep;
  const final = powerLawAcceleration(body, strength, exponent);
  body.vx += 0.5 * final.x * timeStep;
  body.vy += 0.5 * final.y * timeStep;
}

export function powerLawEnergy(body: PhaseBody, strength: number, exponent: number): number {
  const radius = Math.max(Math.hypot(body.x, body.y), 1e-6);
  const kinetic = 0.5 * body.mass * (body.vx ** 2 + body.vy ** 2);
  const potential =
    exponent === 1
      ? strength * body.mass * Math.log(radius)
      : (strength * body.mass * radius ** (1 - exponent)) / (1 - exponent);
  return kinetic + potential;
}

export function nBodyAccelerations(
  bodies: readonly PhaseBody[],
  gravitationalConstant: number,
  softening: number,
): Acceleration[] {
  const accelerations = bodies.map(() => ({ x: 0, y: 0 }));
  for (let first = 0; first < bodies.length; first++) {
    for (let second = first + 1; second < bodies.length; second++) {
      const dx = bodies[second].x - bodies[first].x;
      const dy = bodies[second].y - bodies[first].y;
      const inverseRadiusCubed = (dx * dx + dy * dy + softening ** 2) ** -1.5;
      const factor = gravitationalConstant * inverseRadiusCubed;
      accelerations[first].x += factor * bodies[second].mass * dx;
      accelerations[first].y += factor * bodies[second].mass * dy;
      accelerations[second].x -= factor * bodies[first].mass * dx;
      accelerations[second].y -= factor * bodies[first].mass * dy;
    }
  }
  return accelerations;
}

export function stepNBody(
  bodies: PhaseBody[],
  timeStep: number,
  gravitationalConstant: number,
  softening: number,
): void {
  const initial = nBodyAccelerations(bodies, gravitationalConstant, softening);
  bodies.forEach((body, index) => {
    body.vx += 0.5 * initial[index].x * timeStep;
    body.vy += 0.5 * initial[index].y * timeStep;
    body.x += body.vx * timeStep;
    body.y += body.vy * timeStep;
  });
  const final = nBodyAccelerations(bodies, gravitationalConstant, softening);
  bodies.forEach((body, index) => {
    body.vx += 0.5 * final[index].x * timeStep;
    body.vy += 0.5 * final[index].y * timeStep;
  });
}

export function nBodyEnergy(
  bodies: readonly PhaseBody[],
  gravitationalConstant: number,
  softening: number,
): number {
  let energy = bodies.reduce(
    (sum, body) => sum + 0.5 * body.mass * (body.vx ** 2 + body.vy ** 2),
    0,
  );
  for (let first = 0; first < bodies.length; first++) {
    for (let second = first + 1; second < bodies.length; second++) {
      const dx = bodies[second].x - bodies[first].x;
      const dy = bodies[second].y - bodies[first].y;
      const radius = Math.sqrt(dx * dx + dy * dy + softening ** 2);
      energy -= (gravitationalConstant * bodies[first].mass * bodies[second].mass) / radius;
    }
  }
  return energy;
}

export function nBodyAccelerations3D(
  bodies: readonly PhaseBody3D[],
  gravitationalConstant: number,
  softening: number,
): Acceleration3D[] {
  const accelerations = bodies.map(() => ({ x: 0, y: 0, z: 0 }));
  for (let first = 0; first < bodies.length; first++) {
    for (let second = first + 1; second < bodies.length; second++) {
      const dx = bodies[second].x - bodies[first].x;
      const dy = bodies[second].y - bodies[first].y;
      const dz = bodies[second].z - bodies[first].z;
      const inverseRadiusCubed = (dx * dx + dy * dy + dz * dz + softening ** 2) ** -1.5;
      const factor = gravitationalConstant * inverseRadiusCubed;
      accelerations[first].x += factor * bodies[second].mass * dx;
      accelerations[first].y += factor * bodies[second].mass * dy;
      accelerations[first].z += factor * bodies[second].mass * dz;
      accelerations[second].x -= factor * bodies[first].mass * dx;
      accelerations[second].y -= factor * bodies[first].mass * dy;
      accelerations[second].z -= factor * bodies[first].mass * dz;
    }
  }
  return accelerations;
}

export function stepNBody3D(
  bodies: PhaseBody3D[],
  timeStep: number,
  gravitationalConstant: number,
  softening: number,
): void {
  const initial = nBodyAccelerations3D(bodies, gravitationalConstant, softening);
  bodies.forEach((body, index) => {
    body.vx += 0.5 * initial[index].x * timeStep;
    body.vy += 0.5 * initial[index].y * timeStep;
    body.vz += 0.5 * initial[index].z * timeStep;
    body.x += body.vx * timeStep;
    body.y += body.vy * timeStep;
    body.z += body.vz * timeStep;
  });
  const final = nBodyAccelerations3D(bodies, gravitationalConstant, softening);
  bodies.forEach((body, index) => {
    body.vx += 0.5 * final[index].x * timeStep;
    body.vy += 0.5 * final[index].y * timeStep;
    body.vz += 0.5 * final[index].z * timeStep;
  });
}

export function nBodyEnergy3D(
  bodies: readonly PhaseBody3D[],
  gravitationalConstant: number,
  softening: number,
): number {
  let energy = bodies.reduce(
    (sum, body) => sum + 0.5 * body.mass * (body.vx ** 2 + body.vy ** 2 + body.vz ** 2),
    0,
  );
  for (let first = 0; first < bodies.length; first++) {
    for (let second = first + 1; second < bodies.length; second++) {
      const dx = bodies[second].x - bodies[first].x;
      const dy = bodies[second].y - bodies[first].y;
      const dz = bodies[second].z - bodies[first].z;
      const radius = Math.sqrt(dx * dx + dy * dy + dz * dz + softening ** 2);
      energy -= (gravitationalConstant * bodies[first].mass * bodies[second].mass) / radius;
    }
  }
  return energy;
}
