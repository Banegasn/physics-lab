import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

export interface WindTunnel3DParameters {
  reynolds: number;
  inflowVelocity: number;
  obstacle: number;
  angleDegrees: number;
  resolution: number;
}

export interface LoadedWindModel {
  name: string;
  triangleCount: number;
}

interface WindDiagnostics {
  latticeTime: number;
  viscosity: number;
  relaxationTime: number;
  dragCoefficient: number;
  liftCoefficient: number;
  maximumMach: number;
  referenceArea: number;
  stable: boolean;
}

interface FieldMessage {
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
  diagnostics: WindDiagnostics;
}

const WORLD_HEIGHT = 15;
const WORLD_DEPTH = 15;

export class WindTunnel3D {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(43, 1, 0.1, 160);
  private readonly orbitControls: OrbitControls;
  private readonly worker = new Worker(new URL('./wind-tunnel.worker', import.meta.url), {
    type: 'module',
  });
  private readonly obstacleMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xe7fff7,
    roughness: 0.25,
    metalness: 0.08,
    clearcoat: 0.55,
    emissive: 0x132e30,
    emissiveIntensity: 0.55,
  });
  private readonly particleMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    vertexShader: `
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(72.0 / max(4.0, -viewPosition.z), 3.0, 8.0);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        float radius = distance(gl_PointCoord, vec2(0.5));
        if (radius > 0.5) discard;
        float glow = smoothstep(0.5, 0.05, radius);
        gl_FragColor = vec4(vColor * (1.0 + 0.72 * glow), 0.5 + 0.5 * glow);
      }
    `,
  });
  private obstacleMesh: THREE.Object3D | null = null;
  private customGeometry: THREE.BufferGeometry | null = null;
  private customTriangles: Float32Array | null = null;
  private points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private particleLattice = new Float32Array(0);
  private particlePositions = new Float32Array(0);
  private particleColors = new Float32Array(0);
  private particleCount = 0;
  private velocityX: Float32Array<ArrayBufferLike> = new Float32Array(0);
  private velocityY: Float32Array<ArrayBufferLike> = new Float32Array(0);
  private velocityZ: Float32Array<ArrayBufferLike> = new Float32Array(0);
  private vorticity: Float32Array<ArrayBufferLike> = new Float32Array(0);
  private solid: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  private width = 54;
  private height = 30;
  private depth = 30;
  private generation = 0;
  private busy = false;
  private inflowVelocity = 0.05;
  private currentView = 0;

  constructor(
    private readonly host: HTMLElement,
    private readonly reportMetric: (metric: string) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x080b18, 1);
    this.renderer.domElement.className = 'wind-tunnel-canvas';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.host.replaceChildren(this.renderer.domElement);

    this.scene.fog = new THREE.FogExp2(0x080b18, 0.013);
    this.camera.position.set(28, 17, 25);
    this.camera.lookAt(0, 0, 0);
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.065;
    this.orbitControls.minDistance = 17;
    this.orbitControls.maxDistance = 70;
    this.orbitControls.target.set(-1.5, 0, 0);

    this.scene.add(new THREE.HemisphereLight(0xaedfff, 0x111326, 1.7));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(-4, 10, 12);
    this.scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x68e5c1, 2.1);
    rimLight.position.set(12, -4, -9);
    this.scene.add(rimLight);
    this.addTunnelGeometry();

    const pointGeometry = new THREE.BufferGeometry();
    this.points = new THREE.Points(pointGeometry, this.particleMaterial);
    this.scene.add(this.points);

    this.worker.addEventListener('message', ({ data }: MessageEvent<FieldMessage>) => {
      if (data.type !== 'field' || data.generation !== this.generation) return;
      this.busy = false;
      this.width = data.width;
      this.height = data.height;
      this.depth = data.depth;
      this.velocityX = data.velocityX;
      this.velocityY = data.velocityY;
      this.velocityZ = data.velocityZ;
      this.vorticity = data.vorticity;
      if (data.solid) this.solid = data.solid;
      const status = data.diagnostics.stable ? '' : ' · unstable';
      this.reportMetric(
        `step = ${data.diagnostics.latticeTime} · grid = ${data.width}×${data.height}×${data.depth} · Ma = ${data.diagnostics.maximumMach.toFixed(3)} · τ = ${data.diagnostics.relaxationTime.toFixed(4)} · Cd = ${data.diagnostics.dragCoefficient.toFixed(2)} · Cl = ${data.diagnostics.liftCoefficient.toFixed(2)}${status}`,
      );
    });
  }

  configure(parameters: WindTunnel3DParameters): void {
    const dimensions = [
      [42, 24, 24],
      [54, 30, 30],
      [66, 36, 36],
    ][Math.max(0, Math.min(2, Math.round(parameters.resolution)))] ?? [54, 30, 30];
    [this.width, this.height, this.depth] = dimensions;
    this.inflowVelocity = parameters.inflowVelocity;
    this.generation++;
    this.busy = true;
    this.velocityX = new Float32Array(0);
    this.velocityY = new Float32Array(0);
    this.velocityZ = new Float32Array(0);
    this.vorticity = new Float32Array(0);
    this.solid = new Uint8Array(0);
    this.setObstacleMesh(parameters.obstacle, parameters.angleDegrees);
    this.createParticles(this.particleCount || 1800);
    const triangles = parameters.obstacle === 3 ? this.customTriangles?.slice() : undefined;
    this.worker.postMessage(
      {
        type: 'initialize',
        configuration: {
          generation: this.generation,
          width: this.width,
          height: this.height,
          depth: this.depth,
          reynolds: parameters.reynolds,
          inflowVelocity: parameters.inflowVelocity,
          obstacle: parameters.obstacle,
          angleDegrees: parameters.angleDegrees,
          triangles,
        },
      },
      triangles ? [triangles.buffer] : [],
    );
  }

  frame(delta: number, running: boolean, view: number, particleCount: number): void {
    this.currentView = Math.round(view);
    if (particleCount !== this.particleCount) this.createParticles(particleCount);
    if (running && this.velocityX.length > 0) {
      this.advanceParticles(delta);
      if (!this.busy) {
        this.busy = true;
        this.worker.postMessage({
          type: 'step',
          generation: this.generation,
          steps: Math.max(1, Math.min(5, Math.round(delta * 0.8))),
        });
      }
    }
    this.updateParticleGeometry();
    this.orbitControls.update();
    this.renderer.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  async loadModel(file: File): Promise<LoadedWindModel> {
    if (file.size > 25 * 1024 * 1024) throw new Error('Model files must be smaller than 25 MB.');
    const extension = file.name.split('.').pop()?.toLowerCase();
    let object: THREE.Object3D;
    if (extension === 'obj') {
      object = new OBJLoader().parse(await file.text());
    } else if (extension === 'stl') {
      const geometry = new STLLoader().parse(await file.arrayBuffer());
      object = new THREE.Mesh(geometry);
    } else if (extension === 'glb' || extension === 'gltf') {
      const contents = extension === 'glb' ? await file.arrayBuffer() : await file.text();
      const result = await new GLTFLoader().parseAsync(contents, '');
      object = result.scene;
    } else {
      throw new Error('Use a GLB, self-contained GLTF, OBJ or STL model.');
    }
    const normalized = this.extractNormalizedTriangles(object);
    this.customGeometry?.dispose();
    this.customGeometry = normalized.geometry;
    this.customTriangles = normalized.triangles;
    return { name: file.name, triangleCount: normalized.triangles.length / 9 };
  }

  hasCustomModel(): boolean {
    return this.customTriangles !== null;
  }

  dispose(): void {
    this.worker.terminate();
    this.orbitControls.dispose();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.points.geometry.dispose();
    this.particleMaterial.dispose();
    this.customGeometry?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private addTunnelGeometry(): void {
    const tunnel = new THREE.BoxGeometry(27, WORLD_HEIGHT, WORLD_DEPTH);
    const edges = new THREE.EdgesGeometry(tunnel);
    const wireframe = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x6fe7c3, transparent: true, opacity: 0.17 }),
    );
    this.scene.add(wireframe);
    tunnel.dispose();

    const floor = new THREE.GridHelper(27, 18, 0x426e73, 0x24313f);
    floor.position.y = -WORLD_HEIGHT / 2;
    floor.material.transparent = true;
    floor.material.opacity = 0.24;
    this.scene.add(floor);

    const inletGeometry = new THREE.RingGeometry(5.1, 5.18, 64);
    const inlet = new THREE.Mesh(
      inletGeometry,
      new THREE.MeshBasicMaterial({ color: 0x6fe7c3, transparent: true, opacity: 0.22 }),
    );
    inlet.rotation.y = Math.PI / 2;
    inlet.position.x = -13.48;
    this.scene.add(inlet);
  }

  private setObstacleMesh(obstacle: number, angleDegrees: number): void {
    if (this.obstacleMesh) {
      this.scene.remove(this.obstacleMesh);
      this.obstacleMesh.traverse((object) => {
        if (object instanceof THREE.Mesh && object.geometry !== this.customGeometry)
          object.geometry.dispose();
      });
    }
    let geometry: THREE.BufferGeometry;
    let scale: number;
    if (obstacle === 0) {
      geometry = new THREE.SphereGeometry(1, 56, 32);
      scale = 2.5;
    } else if (obstacle === 1) {
      geometry = new THREE.BoxGeometry(1, 1, 1, 5, 5, 5);
      scale = 5;
    } else if (obstacle === 2) {
      geometry = this.createAirfoilGeometry();
      scale = 7;
    } else if (this.customGeometry) {
      geometry = this.customGeometry;
      scale = 6;
    } else {
      geometry = new THREE.SphereGeometry(1, 56, 32);
      scale = 2.5;
    }
    const mesh = new THREE.Mesh(geometry, this.obstacleMaterial);
    mesh.scale.setScalar(scale);
    mesh.rotation.z = (-angleDegrees * Math.PI) / 180;
    mesh.position.x = -4.32;
    this.obstacleMesh = mesh;
    this.scene.add(mesh);
  }

  private createAirfoilGeometry(): THREE.BufferGeometry {
    const shape = new THREE.Shape();
    const surface: { x: number; y: number }[] = [];
    for (let index = 0; index <= 48; index++) {
      const x = index / 48;
      surface.push({ x: x - 0.5, y: this.airfoilThickness(x) });
    }
    for (let index = 47; index >= 0; index--) {
      const x = index / 48;
      surface.push({ x: x - 0.5, y: -this.airfoilThickness(x) });
    }
    shape.moveTo(surface[0].x, surface[0].y);
    surface.slice(1).forEach(({ x, y }) => shape.lineTo(x, y));
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 8 / 14,
      bevelEnabled: false,
      curveSegments: 2,
    });
    geometry.translate(0, 0, -4 / 14);
    geometry.computeVertexNormals();
    return geometry;
  }

  private airfoilThickness(x: number): number {
    return (
      5 *
      0.12 *
      (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1015 * x ** 4)
    );
  }

  private extractNormalizedTriangles(object: THREE.Object3D): {
    geometry: THREE.BufferGeometry;
    triangles: Float32Array;
  } {
    object.updateMatrixWorld(true);
    const positions: number[] = [];
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const source = child.geometry.getAttribute('position');
      if (!source) return;
      const index = child.geometry.index;
      const vertexCount = index ? index.count : source.count;
      const point = new THREE.Vector3();
      for (let vertex = 0; vertex < vertexCount; vertex++) {
        const sourceIndex = index ? index.getX(vertex) : vertex;
        point.fromBufferAttribute(source, sourceIndex).applyMatrix4(child.matrixWorld);
        positions.push(point.x, point.y, point.z);
      }
    });
    if (positions.length < 9) throw new Error('The model does not contain a triangular mesh.');
    const box = new THREE.Box3();
    const point = new THREE.Vector3();
    for (let offset = 0; offset < positions.length; offset += 3) {
      point.set(positions[offset], positions[offset + 1], positions[offset + 2]);
      box.expandByPoint(point);
    }
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maximumExtent = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(maximumExtent) || maximumExtent <= 1e-9)
      throw new Error('The model has no measurable volume.');
    const triangles = new Float32Array(positions.length);
    for (let offset = 0; offset < positions.length; offset += 3) {
      triangles[offset] = (positions[offset] - center.x) / maximumExtent;
      triangles[offset + 1] = (positions[offset + 1] - center.y) / maximumExtent;
      triangles[offset + 2] = (positions[offset + 2] - center.z) / maximumExtent;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(triangles.slice(), 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return { geometry, triangles };
  }

  private createParticles(count: number): void {
    this.particleCount = count;
    this.particleLattice = new Float32Array(count * 3);
    this.particlePositions = new Float32Array(count * 3);
    this.particleColors = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) this.respawnParticle(index, true);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 3));
    this.points.geometry.dispose();
    this.points.geometry = geometry;
  }

  private advanceParticles(delta: number): void {
    const displacementScale = Math.min(8, Math.max(0, delta)) * 2.7;
    for (let index = 0; index < this.particleCount; index++) {
      const offset = index * 3;
      const x = this.particleLattice[offset];
      const y = this.particleLattice[offset + 1];
      const z = this.particleLattice[offset + 2];
      const cell = this.sampleCell(x, y, z);
      if (cell < 0 || this.solid[cell] !== 0) {
        this.respawnParticle(index, false);
        continue;
      }
      this.particleLattice[offset] += this.velocityX[cell] * displacementScale;
      this.particleLattice[offset + 1] += this.velocityY[cell] * displacementScale;
      this.particleLattice[offset + 2] += this.velocityZ[cell] * displacementScale;
      const nextCell = this.sampleCell(
        this.particleLattice[offset],
        this.particleLattice[offset + 1],
        this.particleLattice[offset + 2],
      );
      if (nextCell < 0 || this.solid[nextCell] !== 0) this.respawnParticle(index, false);
    }
  }

  private updateParticleGeometry(): void {
    const color = new THREE.Color();
    for (let index = 0; index < this.particleCount; index++) {
      const offset = index * 3;
      const x = this.particleLattice[offset];
      const y = this.particleLattice[offset + 1];
      const z = this.particleLattice[offset + 2];
      this.particlePositions[offset] = (x / (this.width - 1) - 0.5) * 27;
      this.particlePositions[offset + 1] = (y / (this.height - 1) - 0.5) * WORLD_HEIGHT;
      this.particlePositions[offset + 2] = (z / (this.depth - 1) - 0.5) * WORLD_DEPTH;
      const cell = this.sampleCell(x, y, z);
      if (this.currentView === 1 && cell >= 0) {
        const speed = Math.hypot(
          this.velocityX[cell] ?? 0,
          this.velocityY[cell] ?? 0,
          this.velocityZ[cell] ?? 0,
        );
        const normalized = Math.min(1, speed / Math.max(this.inflowVelocity * 1.7, 1e-6));
        color.setRGB(
          0.18 + 0.78 * normalized,
          0.38 + 0.48 * (1 - normalized),
          0.95 - 0.62 * normalized,
        );
      } else if (this.currentView === 2 && cell >= 0) {
        const normalized = Math.min(1, (this.vorticity[cell] ?? 0) / 0.035);
        color.setRGB(0.25 + 0.75 * normalized, 0.85 - 0.42 * normalized, 0.78 - 0.55 * normalized);
      } else {
        color.setRGB(0.43, 0.91, 0.77);
      }
      this.particleColors[offset] = color.r;
      this.particleColors[offset + 1] = color.g;
      this.particleColors[offset + 2] = color.b;
    }
    const positions = this.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colors = this.points.geometry.getAttribute('color') as THREE.BufferAttribute;
    positions.needsUpdate = true;
    colors.needsUpdate = true;
  }

  private respawnParticle(index: number, fillDomain: boolean): void {
    const offset = index * 3;
    const phaseA = ((index + 1) * 0.61803398875) % 1;
    const phaseB = ((index + 1) * 0.41421356237) % 1;
    const phaseC = ((index + 1) * 0.73205080757) % 1;
    this.particleLattice[offset] = fillDomain ? 1 + phaseC * (this.width - 3) : 1.15;
    this.particleLattice[offset + 1] = 1.4 + phaseA * (this.height - 3.8);
    this.particleLattice[offset + 2] = 1.4 + phaseB * (this.depth - 3.8);
  }

  private sampleCell(x: number, y: number, z: number): number {
    const latticeX = Math.round(x);
    const latticeY = Math.round(y);
    const latticeZ = Math.round(z);
    if (
      latticeX < 0 ||
      latticeX >= this.width ||
      latticeY < 0 ||
      latticeY >= this.height ||
      latticeZ < 0 ||
      latticeZ >= this.depth
    )
      return -1;
    return (latticeZ * this.height + latticeY) * this.width + latticeX;
  }
}
