export type FluidObstacleShape = 0 | 1;

export interface FluidParameters {
  reynolds: number;
  inflowVelocity: number;
  obstacleRadius: number;
  obstacleShape: FluidObstacleShape;
}

export interface FluidDiagnostics {
  latticeTime: number;
  viscosity: number;
  relaxationTime: number;
  dragCoefficient: number;
  liftCoefficient: number;
  strouhalNumber: number | null;
  maximumMach: number;
  stable: boolean;
}

const VELOCITY_X = [0, 1, 0, -1, 0, 1, -1, -1, 1] as const;
const VELOCITY_Y = [0, 0, 1, 0, -1, 1, 1, -1, -1] as const;
const OPPOSITE = [0, 3, 4, 1, 2, 7, 8, 5, 6] as const;
const WEIGHTS = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36] as const;
const LATTICE_SOUND_SPEED = 1 / Math.sqrt(3);

export class D2Q9Fluid {
  readonly density: Float32Array;
  readonly velocityX: Float32Array;
  readonly velocityY: Float32Array;
  readonly vorticity: Float32Array;
  readonly solid: Uint8Array;

  private distributions: Float32Array;
  private nextDistributions: Float32Array;
  private parameters: FluidParameters = {
    reynolds: 150,
    inflowVelocity: 0.055,
    obstacleRadius: 11,
    obstacleShape: 0,
  };
  private tick = 0;
  private filteredDrag = 0;
  private filteredLift = 0;
  private previousLift = 0;
  private lastPositiveLiftCrossing = 0;
  private measuredStrouhal: number | null = null;
  private stable = true;

  constructor(
    readonly gridWidth: number,
    readonly gridHeight: number,
  ) {
    if (gridWidth < 32 || gridHeight < 20) throw new Error('The fluid lattice is too small.');
    const cells = gridWidth * gridHeight;
    this.distributions = new Float32Array(cells * 9);
    this.nextDistributions = new Float32Array(cells * 9);
    this.density = new Float32Array(cells);
    this.velocityX = new Float32Array(cells);
    this.velocityY = new Float32Array(cells);
    this.vorticity = new Float32Array(cells);
    this.solid = new Uint8Array(cells);
    this.reset(this.parameters);
  }

  get bodyDiameter(): number {
    return 2 * this.parameters.obstacleRadius;
  }

  get diagnostics(): FluidDiagnostics {
    const viscosity =
      (this.parameters.inflowVelocity * this.bodyDiameter) / this.parameters.reynolds;
    return {
      latticeTime: this.tick,
      viscosity,
      relaxationTime: 0.5 + 3 * viscosity,
      dragCoefficient: this.filteredDrag,
      liftCoefficient: this.filteredLift,
      strouhalNumber: this.measuredStrouhal,
      maximumMach: this.parameters.inflowVelocity / LATTICE_SOUND_SPEED,
      stable: this.stable,
    };
  }

  reset(parameters: FluidParameters): void {
    this.parameters = { ...parameters };
    this.tick = 0;
    this.filteredDrag = 0;
    this.filteredLift = 0;
    this.previousLift = 0;
    this.lastPositiveLiftCrossing = 0;
    this.measuredStrouhal = null;
    this.stable = true;
    this.solid.fill(0);

    const centerX = this.gridWidth * 0.28;
    const centerY = (this.gridHeight - 1) / 2;
    const radius = parameters.obstacleRadius;

    for (let x = 0; x < this.gridWidth; x++) {
      this.solid[x] = 1;
      this.solid[(this.gridHeight - 1) * this.gridWidth + x] = 1;
    }
    for (let y = 1; y < this.gridHeight - 1; y++) {
      for (let x = 1; x < this.gridWidth - 1; x++) {
        const offsetX = x - centerX;
        const offsetY = y - centerY;
        const insideBody =
          parameters.obstacleShape === 0
            ? offsetX * offsetX + offsetY * offsetY <= radius * radius
            : Math.abs(offsetX) <= radius && Math.abs(offsetY) <= radius;
        if (insideBody) this.solid[y * this.gridWidth + x] = 2;
      }
    }

    for (let cell = 0; cell < this.gridWidth * this.gridHeight; cell++) {
      const x = cell % this.gridWidth;
      const y = Math.floor(cell / this.gridWidth);
      const wakeDistanceX = x - (centerX + 1.7 * radius);
      const wakeDistanceY = y - centerY;
      const initialVerticalPerturbation =
        this.solid[cell] === 0
          ? parameters.inflowVelocity *
            0.015 *
            Math.exp(
              -(wakeDistanceX * wakeDistanceX + wakeDistanceY * wakeDistanceY) /
                (2 * radius * radius),
            )
          : 0;
      this.writeEquilibrium(
        this.distributions,
        cell,
        1,
        this.solid[cell] === 0 ? parameters.inflowVelocity : 0,
        initialVerticalPerturbation,
      );
    }
    this.nextDistributions.set(this.distributions);
    this.computeMacroscopicFields();
  }

  step(): FluidDiagnostics {
    const { reynolds, inflowVelocity } = this.parameters;
    const viscosity = (inflowVelocity * this.bodyDiameter) / reynolds;
    const relaxationTime = 0.5 + 3 * viscosity;
    const relaxationRate = 1 / relaxationTime;
    let forceX = 0;
    let forceY = 0;
    this.nextDistributions.fill(0);

    for (let y = 1; y < this.gridHeight - 1; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const cell = y * this.gridWidth + x;
        if (this.solid[cell] !== 0) continue;
        const offset = cell * 9;
        let density = 0;
        let momentumX = 0;
        let momentumY = 0;

        for (let direction = 0; direction < 9; direction++) {
          const population = this.distributions[offset + direction];
          density += population;
          momentumX += population * VELOCITY_X[direction];
          momentumY += population * VELOCITY_Y[direction];
        }

        if (!Number.isFinite(density) || density < 0.2 || density > 5) {
          this.stable = false;
          continue;
        }
        const velocityX = momentumX / density;
        const velocityY = momentumY / density;
        const speedSquared = velocityX * velocityX + velocityY * velocityY;

        for (let direction = 0; direction < 9; direction++) {
          const projection = VELOCITY_X[direction] * velocityX + VELOCITY_Y[direction] * velocityY;
          const equilibrium =
            WEIGHTS[direction] *
            density *
            (1 + 3 * projection + 4.5 * projection * projection - 1.5 * speedSquared);
          const outgoing =
            this.distributions[offset + direction] -
            relaxationRate * (this.distributions[offset + direction] - equilibrium);
          const neighborX = x + VELOCITY_X[direction];
          const neighborY = y + VELOCITY_Y[direction];
          if (
            neighborX < 0 ||
            neighborX >= this.gridWidth ||
            neighborY < 0 ||
            neighborY >= this.gridHeight
          )
            continue;

          const neighbor = neighborY * this.gridWidth + neighborX;
          if (this.solid[neighbor] !== 0) {
            this.nextDistributions[offset + OPPOSITE[direction]] += outgoing;
            if (this.solid[neighbor] === 2) {
              forceX += 2 * outgoing * VELOCITY_X[direction];
              forceY += 2 * outgoing * VELOCITY_Y[direction];
            }
          } else {
            this.nextDistributions[neighbor * 9 + direction] += outgoing;
          }
        }
      }
    }

    for (let y = 1; y < this.gridHeight - 1; y++) {
      this.writeEquilibrium(this.nextDistributions, y * this.gridWidth, 1, inflowVelocity, 0);
      const outlet = y * this.gridWidth + this.gridWidth - 1;
      const source = outlet - 1;
      for (let direction = 0; direction < 9; direction++)
        this.nextDistributions[outlet * 9 + direction] =
          this.nextDistributions[source * 9 + direction];
    }

    [this.distributions, this.nextDistributions] = [this.nextDistributions, this.distributions];
    this.tick++;
    this.computeMacroscopicFields();

    const dynamicPressureScale = Math.max(
      0.5 * inflowVelocity * inflowVelocity * this.bodyDiameter,
      1e-8,
    );
    const dragCoefficient = forceX / dynamicPressureScale;
    const liftCoefficient = forceY / dynamicPressureScale;
    this.filteredDrag = 0.94 * this.filteredDrag + 0.06 * dragCoefficient;
    this.filteredLift = 0.94 * this.filteredLift + 0.06 * liftCoefficient;

    const minimumTransient = Math.round((8 * this.bodyDiameter) / inflowVelocity);
    if (
      this.tick > minimumTransient &&
      this.previousLift <= 0 &&
      this.filteredLift > 0 &&
      this.tick - this.lastPositiveLiftCrossing > this.bodyDiameter / inflowVelocity
    ) {
      if (this.lastPositiveLiftCrossing > 0) {
        const period = this.tick - this.lastPositiveLiftCrossing;
        const strouhal = this.bodyDiameter / (period * inflowVelocity);
        if (strouhal > 0.02 && strouhal < 0.5)
          this.measuredStrouhal =
            this.measuredStrouhal === null
              ? strouhal
              : 0.7 * this.measuredStrouhal + 0.3 * strouhal;
      }
      this.lastPositiveLiftCrossing = this.tick;
    }
    this.previousLift = this.filteredLift;
    return this.diagnostics;
  }

  isSolidAt(x: number, y: number): boolean {
    const latticeX = Math.max(0, Math.min(this.gridWidth - 1, Math.round(x)));
    const latticeY = Math.max(0, Math.min(this.gridHeight - 1, Math.round(y)));
    return this.solid[latticeY * this.gridWidth + latticeX] !== 0;
  }

  sampleVelocity(x: number, y: number): { x: number; y: number } {
    const latticeX = Math.max(0, Math.min(this.gridWidth - 1, Math.round(x)));
    const latticeY = Math.max(0, Math.min(this.gridHeight - 1, Math.round(y)));
    const cell = latticeY * this.gridWidth + latticeX;
    return { x: this.velocityX[cell], y: this.velocityY[cell] };
  }

  private writeEquilibrium(
    target: Float32Array,
    cell: number,
    density: number,
    velocityX: number,
    velocityY: number,
  ): void {
    const speedSquared = velocityX * velocityX + velocityY * velocityY;
    const offset = cell * 9;
    for (let direction = 0; direction < 9; direction++) {
      const projection = VELOCITY_X[direction] * velocityX + VELOCITY_Y[direction] * velocityY;
      target[offset + direction] =
        WEIGHTS[direction] *
        density *
        (1 + 3 * projection + 4.5 * projection * projection - 1.5 * speedSquared);
    }
  }

  private computeMacroscopicFields(): void {
    this.density.fill(1);
    this.velocityX.fill(0);
    this.velocityY.fill(0);
    this.vorticity.fill(0);

    for (let y = 1; y < this.gridHeight - 1; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const cell = y * this.gridWidth + x;
        if (this.solid[cell] !== 0) continue;
        const offset = cell * 9;
        let density = 0;
        let momentumX = 0;
        let momentumY = 0;
        for (let direction = 0; direction < 9; direction++) {
          const population = this.distributions[offset + direction];
          density += population;
          momentumX += population * VELOCITY_X[direction];
          momentumY += population * VELOCITY_Y[direction];
        }
        if (!Number.isFinite(density) || density <= 0) {
          this.stable = false;
          continue;
        }
        this.density[cell] = density;
        this.velocityX[cell] = momentumX / density;
        this.velocityY[cell] = momentumY / density;
      }
    }

    for (let y = 1; y < this.gridHeight - 1; y++) {
      for (let x = 1; x < this.gridWidth - 1; x++) {
        const cell = y * this.gridWidth + x;
        if (this.solid[cell] !== 0) continue;
        this.vorticity[cell] =
          0.5 *
          (this.velocityY[cell + 1] -
            this.velocityY[cell - 1] -
            this.velocityX[cell + this.gridWidth] +
            this.velocityX[cell - this.gridWidth]);
      }
    }
  }
}
