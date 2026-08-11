/// <reference lib="webworker" />

export interface WindTunnelConfiguration {
  generation: number;
  width: number;
  height: number;
  depth: number;
  reynolds: number;
  inflowVelocity: number;
  obstacle: number;
  angleDegrees: number;
  triangles?: Float32Array;
}

interface InitializeMessage {
  type: 'initialize';
  configuration: WindTunnelConfiguration;
}

interface StepMessage {
  type: 'step';
  generation: number;
  steps: number;
}

type WindTunnelMessage = InitializeMessage | StepMessage;

export interface WindTunnelField {
  type: 'field';
  generation: number;
  width: number;
  height: number;
  depth: number;
  velocityX: Float32Array;
  velocityY: Float32Array;
  velocityZ: Float32Array;
  vorticity: Float32Array;
  solid?: Uint8Array;
  diagnostics: {
    latticeTime: number;
    viscosity: number;
    relaxationTime: number;
    dragCoefficient: number;
    liftCoefficient: number;
    maximumMach: number;
    referenceArea: number;
    stable: boolean;
  };
}

type WindTunnelPublisher = (message: WindTunnelField, transfers: Transferable[]) => void;

const VELOCITY_X = [0, 1, -1, 0, 0, 0, 0, 1, 1, 1, 1, -1, -1, -1, -1, 0, 0, 0, 0];
const VELOCITY_Y = [0, 0, 0, 1, -1, 0, 0, 1, -1, 0, 0, 1, -1, 0, 0, 1, 1, -1, -1];
const VELOCITY_Z = [0, 0, 0, 0, 0, 1, -1, 0, 0, 1, -1, 0, 0, 1, -1, 1, -1, 1, -1];
const OPPOSITE = [0, 2, 1, 4, 3, 6, 5, 12, 11, 14, 13, 8, 7, 10, 9, 18, 17, 16, 15];
const WEIGHTS = [
  1 / 3,
  1 / 18,
  1 / 18,
  1 / 18,
  1 / 18,
  1 / 18,
  1 / 18,
  1 / 36,
  1 / 36,
  1 / 36,
  1 / 36,
  1 / 36,
  1 / 36,
  1 / 36,
  1 / 36,
  1 / 36,
  1 / 36,
  1 / 36,
  1 / 36,
];
const LATTICE_SOUND_SPEED = 1 / Math.sqrt(3);

export class D3Q19WindTunnel {
  private configuration!: WindTunnelConfiguration;
  private distributions = new Float32Array(0);
  private nextDistributions = new Float32Array(0);
  private density = new Float32Array(0);
  private velocityX = new Float32Array(0);
  private velocityY = new Float32Array(0);
  private velocityZ = new Float32Array(0);
  private vorticity = new Float32Array(0);
  private solid = new Uint8Array(0);
  private tick = 0;
  private filteredDrag = 0;
  private filteredLift = 0;
  private stable = true;
  private characteristicLength = 10;
  private referenceArea = 1;

  constructor(
    private readonly publisher: WindTunnelPublisher = (message, transfers) =>
      postMessage(message, transfers),
  ) {}

  initialize(configuration: WindTunnelConfiguration): void {
    this.configuration = configuration;
    const cells = configuration.width * configuration.height * configuration.depth;
    this.distributions = new Float32Array(cells * 19);
    this.nextDistributions = new Float32Array(cells * 19);
    this.density = new Float32Array(cells);
    this.velocityX = new Float32Array(cells);
    this.velocityY = new Float32Array(cells);
    this.velocityZ = new Float32Array(cells);
    this.vorticity = new Float32Array(cells);
    this.solid = new Uint8Array(cells);
    this.tick = 0;
    this.filteredDrag = 0;
    this.filteredLift = 0;
    this.stable = true;
    this.buildSolidMask();
    this.initializeDistributions();
    this.computeMacroscopicFields();
    this.publish(true);
  }

  step(steps: number): void {
    for (let iteration = 0; iteration < Math.min(8, Math.max(1, steps)); iteration++) {
      if (!this.stable) break;
      this.singleStep();
    }
    this.publish(false);
  }

  private singleStep(): void {
    const { width, height, depth, reynolds, inflowVelocity } = this.configuration;
    const viscosity = (inflowVelocity * this.characteristicLength) / reynolds;
    const relaxationTime = 0.5 + 3 * viscosity;
    const relaxationRate = 1 / relaxationTime;
    let forceX = 0;
    let forceY = 0;
    this.nextDistributions.fill(0);

    for (let z = 1; z < depth - 1; z++) {
      for (let y = 1; y < height - 1; y++) {
        for (let x = 0; x < width; x++) {
          const cell = this.index(x, y, z);
          if (this.solid[cell] !== 0) continue;
          const offset = cell * 19;
          let density = 0;
          let momentumX = 0;
          let momentumY = 0;
          let momentumZ = 0;
          for (let direction = 0; direction < 19; direction++) {
            const population = this.distributions[offset + direction];
            density += population;
            momentumX += population * VELOCITY_X[direction];
            momentumY += population * VELOCITY_Y[direction];
            momentumZ += population * VELOCITY_Z[direction];
          }
          if (!Number.isFinite(density) || density < 0.2 || density > 5) {
            this.stable = false;
            continue;
          }
          const velocityX = momentumX / density;
          const velocityY = momentumY / density;
          const velocityZ = momentumZ / density;
          const speedSquared = velocityX ** 2 + velocityY ** 2 + velocityZ ** 2;

          for (let direction = 0; direction < 19; direction++) {
            const projection =
              VELOCITY_X[direction] * velocityX +
              VELOCITY_Y[direction] * velocityY +
              VELOCITY_Z[direction] * velocityZ;
            const equilibrium =
              WEIGHTS[direction] *
              density *
              (1 + 3 * projection + 4.5 * projection * projection - 1.5 * speedSquared);
            const outgoing =
              this.distributions[offset + direction] -
              relaxationRate * (this.distributions[offset + direction] - equilibrium);
            const neighborX = x + VELOCITY_X[direction];
            const neighborY = y + VELOCITY_Y[direction];
            const neighborZ = z + VELOCITY_Z[direction];
            if (
              neighborX < 0 ||
              neighborX >= width ||
              neighborY < 0 ||
              neighborY >= height ||
              neighborZ < 0 ||
              neighborZ >= depth
            )
              continue;
            const neighbor = this.index(neighborX, neighborY, neighborZ);
            if (this.solid[neighbor] !== 0) {
              this.nextDistributions[offset + OPPOSITE[direction]] += outgoing;
              if (this.solid[neighbor] === 2) {
                forceX += 2 * outgoing * VELOCITY_X[direction];
                forceY += 2 * outgoing * VELOCITY_Y[direction];
              }
            } else {
              this.nextDistributions[neighbor * 19 + direction] += outgoing;
            }
          }
        }
      }
    }

    for (let z = 1; z < depth - 1; z++) {
      for (let y = 1; y < height - 1; y++) {
        this.writeEquilibrium(this.nextDistributions, this.index(0, y, z), 1, inflowVelocity, 0, 0);
        const outlet = this.index(width - 1, y, z);
        const source = this.index(width - 2, y, z);
        for (let direction = 0; direction < 19; direction++)
          this.nextDistributions[outlet * 19 + direction] =
            this.nextDistributions[source * 19 + direction];
      }
    }

    [this.distributions, this.nextDistributions] = [this.nextDistributions, this.distributions];
    this.tick++;
    this.computeMacroscopicFields();
    const dynamicPressureArea = Math.max(
      0.5 * inflowVelocity * inflowVelocity * this.referenceArea,
      1e-8,
    );
    this.filteredDrag = 0.96 * this.filteredDrag + 0.04 * (forceX / dynamicPressureArea);
    this.filteredLift = 0.96 * this.filteredLift + 0.04 * (forceY / dynamicPressureArea);
  }

  private buildSolidMask(): void {
    const { width, height, depth, obstacle, angleDegrees, triangles } = this.configuration;
    this.solid.fill(0);
    const centerX = width * 0.34;
    const centerY = (height - 1) / 2;
    const centerZ = (depth - 1) / 2;
    const angle = (-angleDegrees * Math.PI) / 180;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);

    if (obstacle === 3 && triangles && triangles.length >= 9) {
      this.characteristicLength = 12;
      this.voxelizeTriangles(triangles, centerX, centerY, centerZ, cosine, sine);
    } else {
      this.characteristicLength = obstacle === 2 ? 14 : 10;
      for (let z = 1; z < depth - 1; z++) {
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const offsetX = x - centerX;
            const offsetY = y - centerY;
            const offsetZ = z - centerZ;
            const localX = cosine * offsetX + sine * offsetY;
            const localY = -sine * offsetX + cosine * offsetY;
            let inside = false;
            if (obstacle === 0) {
              inside = localX ** 2 + localY ** 2 + offsetZ ** 2 <= 25;
            } else if (obstacle === 1) {
              inside = Math.max(Math.abs(localX), Math.abs(localY), Math.abs(offsetZ)) <= 5;
            } else {
              const chordPosition = localX / 14 + 0.5;
              if (chordPosition >= 0 && chordPosition <= 1 && Math.abs(offsetZ) <= 4) {
                const thickness =
                  5 *
                  0.12 *
                  (0.2969 * Math.sqrt(chordPosition) -
                    0.126 * chordPosition -
                    0.3516 * chordPosition ** 2 +
                    0.2843 * chordPosition ** 3 -
                    0.1015 * chordPosition ** 4);
                inside = Math.abs(localY) <= Math.max(0.45, 14 * thickness);
              }
            }
            if (inside) this.solid[this.index(x, y, z)] = 2;
          }
        }
      }
    }

    const projected = new Uint8Array(height * depth);
    for (let z = 1; z < depth - 1; z++) {
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          if (this.solid[this.index(x, y, z)] === 2) projected[z * height + y] = 1;
        }
      }
    }
    this.referenceArea = Math.max(
      1,
      projected.reduce((sum, value) => sum + value, 0),
    );

    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (y === 0 || y === height - 1 || z === 0 || z === depth - 1)
            this.solid[this.index(x, y, z)] = 1;
        }
      }
    }
  }

  private voxelizeTriangles(
    triangles: Float32Array,
    centerX: number,
    centerY: number,
    centerZ: number,
    cosine: number,
    sine: number,
  ): void {
    const { width, height, depth } = this.configuration;
    const surface = new Uint8Array(width * height * depth);
    const totalTriangles = Math.floor(triangles.length / 9);
    const stride = Math.max(1, Math.ceil(totalTriangles / 120_000));
    for (let triangle = 0; triangle < totalTriangles; triangle += stride) {
      const source = triangle * 9;
      const points = new Float64Array(9);
      for (let vertex = 0; vertex < 3; vertex++) {
        const localX = triangles[source + vertex * 3] * 12;
        const localY = triangles[source + vertex * 3 + 1] * 12;
        const localZ = triangles[source + vertex * 3 + 2] * 12;
        points[vertex * 3] = centerX + cosine * localX - sine * localY;
        points[vertex * 3 + 1] = centerY + sine * localX + cosine * localY;
        points[vertex * 3 + 2] = centerZ + localZ;
      }
      const minimumX = Math.max(1, Math.floor(Math.min(points[0], points[3], points[6]) - 1));
      const maximumX = Math.min(
        width - 2,
        Math.ceil(Math.max(points[0], points[3], points[6]) + 1),
      );
      const minimumY = Math.max(1, Math.floor(Math.min(points[1], points[4], points[7]) - 1));
      const maximumY = Math.min(
        height - 2,
        Math.ceil(Math.max(points[1], points[4], points[7]) + 1),
      );
      const minimumZ = Math.max(1, Math.floor(Math.min(points[2], points[5], points[8]) - 1));
      const maximumZ = Math.min(
        depth - 2,
        Math.ceil(Math.max(points[2], points[5], points[8]) + 1),
      );
      for (let z = minimumZ; z <= maximumZ; z++) {
        for (let y = minimumY; y <= maximumY; y++) {
          for (let x = minimumX; x <= maximumX; x++) {
            if (this.pointTriangleDistanceSquared(x, y, z, points) <= 0.72 ** 2)
              surface[this.index(x, y, z)] = 1;
          }
        }
      }
    }

    const exterior = new Uint8Array(surface.length);
    const queue = new Int32Array(surface.length);
    let head = 0;
    let tail = 0;
    const enqueue = (cell: number): void => {
      if (surface[cell] || exterior[cell]) return;
      exterior[cell] = 1;
      queue[tail++] = cell;
    };
    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < height; y++) {
        enqueue(this.index(0, y, z));
        enqueue(this.index(width - 1, y, z));
      }
    }
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        enqueue(this.index(x, 0, z));
        enqueue(this.index(x, height - 1, z));
      }
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        enqueue(this.index(x, y, 0));
        enqueue(this.index(x, y, depth - 1));
      }
    }
    while (head < tail) {
      const cell = queue[head++];
      const x = cell % width;
      const yz = Math.floor(cell / width);
      const y = yz % height;
      const z = Math.floor(yz / height);
      if (x > 0) enqueue(cell - 1);
      if (x < width - 1) enqueue(cell + 1);
      if (y > 0) enqueue(cell - width);
      if (y < height - 1) enqueue(cell + width);
      if (z > 0) enqueue(cell - width * height);
      if (z < depth - 1) enqueue(cell + width * height);
    }
    for (let cell = 0; cell < surface.length; cell++) {
      if (surface[cell] || !exterior[cell]) this.solid[cell] = 2;
    }
  }

  private pointTriangleDistanceSquared(
    pointX: number,
    pointY: number,
    pointZ: number,
    triangle: Float64Array,
  ): number {
    const ax = triangle[0];
    const ay = triangle[1];
    const az = triangle[2];
    const abx = triangle[3] - ax;
    const aby = triangle[4] - ay;
    const abz = triangle[5] - az;
    const acx = triangle[6] - ax;
    const acy = triangle[7] - ay;
    const acz = triangle[8] - az;
    const apx = pointX - ax;
    const apy = pointY - ay;
    const apz = pointZ - az;
    const d1 = abx * apx + aby * apy + abz * apz;
    const d2 = acx * apx + acy * apy + acz * apz;
    if (d1 <= 0 && d2 <= 0) return apx ** 2 + apy ** 2 + apz ** 2;

    const bpx = pointX - triangle[3];
    const bpy = pointY - triangle[4];
    const bpz = pointZ - triangle[5];
    const d3 = abx * bpx + aby * bpy + abz * bpz;
    const d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) return bpx ** 2 + bpy ** 2 + bpz ** 2;

    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) {
      const v = d1 / (d1 - d3);
      return (apx - v * abx) ** 2 + (apy - v * aby) ** 2 + (apz - v * abz) ** 2;
    }

    const cpx = pointX - triangle[6];
    const cpy = pointY - triangle[7];
    const cpz = pointZ - triangle[8];
    const d5 = abx * cpx + aby * cpy + abz * cpz;
    const d6 = acx * cpx + acy * cpy + acz * cpz;
    if (d6 >= 0 && d5 <= d6) return cpx ** 2 + cpy ** 2 + cpz ** 2;

    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
      const w = d2 / (d2 - d6);
      return (apx - w * acx) ** 2 + (apy - w * acy) ** 2 + (apz - w * acz) ** 2;
    }

    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
      const w = (d4 - d3) / (d4 - d3 + d5 - d6);
      const edgeX = triangle[6] - triangle[3];
      const edgeY = triangle[7] - triangle[4];
      const edgeZ = triangle[8] - triangle[5];
      return (bpx - w * edgeX) ** 2 + (bpy - w * edgeY) ** 2 + (bpz - w * edgeZ) ** 2;
    }

    const denominator = 1 / (va + vb + vc);
    const v = vb * denominator;
    const w = vc * denominator;
    return (
      (apx - abx * v - acx * w) ** 2 +
      (apy - aby * v - acy * w) ** 2 +
      (apz - abz * v - acz * w) ** 2
    );
  }

  private initializeDistributions(): void {
    const { width, height, depth, inflowVelocity } = this.configuration;
    const centerX = width * 0.34 + this.characteristicLength * 0.75;
    const centerY = (height - 1) / 2;
    const centerZ = (depth - 1) / 2;
    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const cell = this.index(x, y, z);
          const fluid = this.solid[cell] === 0;
          const distanceSquared = (x - centerX) ** 2 + (y - centerY) ** 2 + (z - centerZ) ** 2;
          const perturbation = fluid
            ? inflowVelocity *
              0.012 *
              Math.exp(-distanceSquared / (0.7 * this.characteristicLength ** 2))
            : 0;
          this.writeEquilibrium(
            this.distributions,
            cell,
            1,
            fluid ? inflowVelocity : 0,
            perturbation,
            0,
          );
        }
      }
    }
    this.nextDistributions.set(this.distributions);
  }

  private computeMacroscopicFields(): void {
    const { width, height, depth } = this.configuration;
    this.density.fill(1);
    this.velocityX.fill(0);
    this.velocityY.fill(0);
    this.velocityZ.fill(0);
    this.vorticity.fill(0);
    for (let cell = 0; cell < this.solid.length; cell++) {
      if (this.solid[cell] !== 0) continue;
      const offset = cell * 19;
      let density = 0;
      let momentumX = 0;
      let momentumY = 0;
      let momentumZ = 0;
      for (let direction = 0; direction < 19; direction++) {
        const population = this.distributions[offset + direction];
        density += population;
        momentumX += population * VELOCITY_X[direction];
        momentumY += population * VELOCITY_Y[direction];
        momentumZ += population * VELOCITY_Z[direction];
      }
      if (!Number.isFinite(density) || density <= 0) {
        this.stable = false;
        continue;
      }
      this.density[cell] = density;
      this.velocityX[cell] = momentumX / density;
      this.velocityY[cell] = momentumY / density;
      this.velocityZ[cell] = momentumZ / density;
    }
    const strideZ = width * height;
    for (let z = 1; z < depth - 1; z++) {
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const cell = this.index(x, y, z);
          if (this.solid[cell] !== 0) continue;
          const curlX =
            0.5 *
            (this.velocityZ[cell + width] -
              this.velocityZ[cell - width] -
              this.velocityY[cell + strideZ] +
              this.velocityY[cell - strideZ]);
          const curlY =
            0.5 *
            (this.velocityX[cell + strideZ] -
              this.velocityX[cell - strideZ] -
              this.velocityZ[cell + 1] +
              this.velocityZ[cell - 1]);
          const curlZ =
            0.5 *
            (this.velocityY[cell + 1] -
              this.velocityY[cell - 1] -
              this.velocityX[cell + width] +
              this.velocityX[cell - width]);
          this.vorticity[cell] = Math.hypot(curlX, curlY, curlZ);
        }
      }
    }
  }

  private writeEquilibrium(
    target: Float32Array,
    cell: number,
    density: number,
    velocityX: number,
    velocityY: number,
    velocityZ: number,
  ): void {
    const offset = cell * 19;
    const speedSquared = velocityX ** 2 + velocityY ** 2 + velocityZ ** 2;
    for (let direction = 0; direction < 19; direction++) {
      const projection =
        VELOCITY_X[direction] * velocityX +
        VELOCITY_Y[direction] * velocityY +
        VELOCITY_Z[direction] * velocityZ;
      target[offset + direction] =
        WEIGHTS[direction] *
        density *
        (1 + 3 * projection + 4.5 * projection * projection - 1.5 * speedSquared);
    }
  }

  private publish(includeSolid: boolean): void {
    const velocityX = this.velocityX.slice();
    const velocityY = this.velocityY.slice();
    const velocityZ = this.velocityZ.slice();
    const vorticity = this.vorticity.slice();
    const viscosity =
      (this.configuration.inflowVelocity * this.characteristicLength) / this.configuration.reynolds;
    const message: WindTunnelField = {
      type: 'field',
      generation: this.configuration.generation,
      width: this.configuration.width,
      height: this.configuration.height,
      depth: this.configuration.depth,
      velocityX,
      velocityY,
      velocityZ,
      vorticity,
      solid: includeSolid ? this.solid.slice() : undefined,
      diagnostics: {
        latticeTime: this.tick,
        viscosity,
        relaxationTime: 0.5 + 3 * viscosity,
        dragCoefficient: this.filteredDrag,
        liftCoefficient: this.filteredLift,
        maximumMach: this.configuration.inflowVelocity / LATTICE_SOUND_SPEED,
        referenceArea: this.referenceArea,
        stable: this.stable,
      },
    };
    const transfers: Transferable[] = [
      velocityX.buffer,
      velocityY.buffer,
      velocityZ.buffer,
      vorticity.buffer,
    ];
    if (message.solid) transfers.push(message.solid.buffer);
    this.publisher(message, transfers);
  }

  private index(x: number, y: number, z: number): number {
    return (z * this.configuration.height + y) * this.configuration.width + x;
  }
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  const tunnel = new D3Q19WindTunnel();
  addEventListener('message', ({ data }: MessageEvent<WindTunnelMessage>) => {
    if (data.type === 'initialize') tunnel.initialize(data.configuration);
    else tunnel.step(data.steps);
  });
}
