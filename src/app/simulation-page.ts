import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  stepSchrodingerCrankNicolson,
  stepSpringChain,
  springChainEnergy,
  type DoublePendulumState,
  type DuffingState,
  type LorenzState,
  type PendulumState,
  type PhaseBody,
  type PhaseBody3D,
} from './physics';
import {
  DEFAULT_SCENARIO,
  SCENARIOS,
  getScenarioBySlug,
  type Scenario,
  type ScenarioDefinition,
} from './scenario-catalog';
type ControlKey =
  | 'orbitalEccentricity'
  | 'orbitalMassRatio'
  | 'orbitalStep'
  | 'particleCount'
  | 'magneticField'
  | 'electricField'
  | 'chargeMassRatio'
  | 'thermalSpeed'
  | 'fieldCollisionRate'
  | 'fieldStep'
  | 'pendulums'
  | 'spread'
  | 'pendulumGravity'
  | 'revivalTime'
  | 'baseCycles'
  | 'pendulumStep'
  | 'powerExponent'
  | 'powerStrength'
  | 'initialVelocity'
  | 'powerStep'
  | 'thirdMass'
  | 'softening'
  | 'integrationStep'
  | 'epidemicBeta'
  | 'epidemicGamma'
  | 'epidemicExponent'
  | 'initialInfected'
  | 'epidemicDensity'
  | 'epidemicRadius'
  | 'epidemicStep'
  | 'reactionFeed'
  | 'reactionKill'
  | 'reactionDiffU'
  | 'reactionDiffV'
  | 'reactionStep'
  | 'doubleMassRatio'
  | 'doubleLengthRatio'
  | 'doubleGravity'
  | 'doubleInitialAngle'
  | 'doubleStep'
  | 'waveCfl'
  | 'waveFrequency'
  | 'waveDamping'
  | 'waveSeparation'
  | 'nBodyCount'
  | 'nBodyScale'
  | 'nBodyVirialRatio'
  | 'nBodySoftening'
  | 'nBodyStep'
  | 'quantumMomentum'
  | 'quantumPacketWidth'
  | 'quantumBarrierHeight'
  | 'quantumBarrierWidth'
  | 'quantumStep'
  | 'lorenzSigma'
  | 'lorenzRho'
  | 'lorenzBeta'
  | 'lorenzStep'
  | 'gravity3dCount'
  | 'gravity3dVirial'
  | 'gravity3dSoftening'
  | 'gravity3dStep'
  | 'magnetic3dCount'
  | 'magnetic3dField'
  | 'magnetic3dElectric'
  | 'magnetic3dPitch'
  | 'magnetic3dCollisionRate'
  | 'magnetic3dStep'
  | 'springCount'
  | 'springConstant'
  | 'springMass'
  | 'springMode'
  | 'springAmplitude'
  | 'springStep'
  | 'duffingLinear'
  | 'duffingCubic'
  | 'duffingDamping'
  | 'duffingDrive'
  | 'duffingFrequency'
  | 'duffingStep';

interface Control {
  key: ControlKey;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}
interface Particle extends PhaseBody {
  hue: number;
  trail: { x: number; y: number }[];
}
interface ScientificBody extends PhaseBody {
  color: string;
  radius: number;
  trail: { x: number; y: number }[];
}
interface Point3D {
  x: number;
  y: number;
  z: number;
}
interface VisualBody3D extends PhaseBody3D {
  color: string;
  radius: number;
  trail: Point3D[];
}
interface ProjectedPoint {
  x: number;
  y: number;
  depth: number;
  scale: number;
}
interface VisualPendulum extends PendulumState {
  hue: number;
}
interface EpidemicPoint {
  time: number;
  susceptible: number;
  infected: number;
  recovered: number;
  incidence: number;
}
interface ScalarHistoryPoint {
  time: number;
  value: number;
}
interface DuffingPoint {
  position: number;
  velocity: number;
}
interface ModelGuide {
  overview: string;
  parameters: { name: string; meaning: string }[];
  method: string;
  limitation: string;
  reference: { label: string; url: string };
}

const MODEL_GUIDES: Record<Scenario, ModelGuide> = {
  orbit: {
    overview:
      'An isolated Newtonian two-body system initialized at periapsis. Both finite masses orbit their shared center of mass; the displayed cross marks that barycenter.',
    parameters: [
      {
        name: 'e',
        meaning:
          'Orbital eccentricity: 0 is circular; values approaching 1 are increasingly elongated.',
      },
      {
        name: 'm₂/m₁',
        meaning:
          'Secondary-to-primary mass ratio. It controls how far both bodies move around the barycenter.',
      },
      {
        name: 'Δt',
        meaning:
          'Fixed dimensionless Velocity Verlet timestep. Smaller values reduce numerical energy drift.',
      },
    ],
    method:
      'The model uses G = 1 and semi-major axis a = 1. Periapsis speed is derived from the vis-viva relation, then both states are transformed into barycentric coordinates.',
    limitation:
      'It excludes other bodies, relativity, tides and radiation. Real planetary trajectories are only approximately Keplerian.',
    reference: {
      label: 'NASA — Orbits and Kepler’s laws',
      url: 'https://science.nasa.gov/solar-system/orbits-and-keplers-laws/',
    },
  },
  field: {
    overview:
      'An ensemble of non-relativistic charged particles in uniform electric and magnetic fields. It is collisionless by default; an optional stochastic binary-scattering rate couples equal-mass pairs.',
    parameters: [
      { name: 'N', meaning: 'Number of independent test particles in the ensemble.' },
      { name: 'Bz', meaning: 'Out-of-plane magnetic field. Its sign reverses gyromotion.' },
      {
        name: 'Ex',
        meaning: 'Uniform horizontal electric field, which can do work and change kinetic energy.',
      },
      {
        name: 'q/m',
        meaning: 'Signed charge-to-mass ratio; together with Bz it sets cyclotron frequency ωc.',
      },
      {
        name: 'σ',
        meaning:
          'Scale of a deterministic, truncated Rayleigh speed distribution (the 2D Maxwellian speed law).',
      },
      {
        name: 'Δt',
        meaning:
          'Boris-pusher timestep. Resolve the gyroperiod with many steps for accurate phase.',
      },
      { name: 'ν', meaning: 'Mean elastic collision frequency; ν = 0 disables collisions.' },
    ],
    method:
      'The Boris split rotates velocity under B between two electric half-kicks. Optional equal-mass Monte Carlo pairs scatter isotropically in their center-of-mass frame, exactly conserving pair momentum and kinetic energy.',
    limitation:
      'Fields are uniform and static; self-consistent fields, radiation and relativistic effects are omitted. The isotropic collision operator is a homogeneous relaxation model, not a calibrated velocity-dependent Coulomb operator; positions wrap only for display.',
    reference: {
      label: 'Hairer, Lubich & Wang — Boris integration analysis',
      url: 'https://arxiv.org/abs/1907.07452',
    },
  },
  pendulum: {
    overview:
      'Independent nonlinear pendula whose lengths are chosen from small-angle periods so neighboring bobs complete successive integer cycle counts at the design revival time.',
    parameters: [
      { name: 'N', meaning: 'Number of uncoupled pendula.' },
      { name: 'Amplitude', meaning: 'Common initial angular displacement in radians.' },
      {
        name: 'g',
        meaning: 'Dimensionless gravitational acceleration; lengths are recalculated with it.',
      },
      { name: 'Revival', meaning: 'Time at which the small-angle design predicts rephasing.' },
      {
        name: 'Base cycles',
        meaning: 'Cycles completed by the longest pendulum during the design revival.',
      },
      { name: 'Δt', meaning: 'Nonlinear Velocity Verlet timestep.' },
    ],
    method:
      'Each bob integrates θ̈ = −(g/L)sinθ. If b is the base cycle count, lengths follow Lᵢ = g[T/(2π(b+i))]², while the solver retains the full sine nonlinearity.',
    limitation:
      'The length formula is a small-angle design. Larger amplitudes lengthen the true periods and deliberately detune the ideal revival; rods are massless and drag is absent.',
    reference: {
      label: 'Amore et al. — Nonlinear pendulum period',
      url: 'https://rmf.smf.mx/ojs/index.php/rmf-e/article/view/4544',
    },
  },
  powerLaw: {
    overview:
      'A unit-mass test particle in an attractive central field whose magnitude decays as r⁻ⁿ. Varying n reveals precession, escape and the special inverse-square case.',
    parameters: [
      { name: 'n', meaning: 'Radial force exponent in F = −kr⁻ⁿr̂.' },
      { name: 'k', meaning: 'Positive coupling strength of the central attraction.' },
      { name: 'vₜ', meaning: 'Initial tangential speed at radius r = 1.' },
      { name: 'Δt', meaning: 'Velocity Verlet timestep used for the conservative trajectory.' },
    ],
    method:
      'The diagnostic uses the matching potential: U = k ln r for n = 1 and U = kr¹⁻ⁿ/(1−n) otherwise. Angular momentum should also remain constant.',
    limitation:
      'The origin is singular and close passages require a much smaller timestep. The model is classical, planar and dimensionless.',
    reference: {
      label: 'Princeton Physics — Attractive power-law central force',
      url: 'https://phy.princeton.edu/sites/g/files/toruqf6851/files/graduate-program/prelims/J04.pdf',
    },
  },
  threeBody: {
    overview:
      'Three gravitating point masses begin from the celebrated planar figure-eight initial state. Equal masses and negligible softening recover the periodic choreography.',
    parameters: [
      {
        name: 'm₃',
        meaning:
          'Third mass relative to the other two. Moving away from 1 perturbs the choreography.',
      },
      {
        name: 'ε',
        meaning:
          'Plummer softening length that regularizes close forces but changes the Hamiltonian.',
      },
      { name: 'Δt', meaning: 'Fixed Velocity Verlet timestep.' },
    ],
    method:
      'Pairwise Newtonian accelerations are integrated symplectically. Center-of-mass position and momentum are removed after any mass change.',
    limitation:
      'The figure eight is not a generic three-body orbit. Softening, unequal masses and accumulated numerical error can destroy its periodicity.',
    reference: {
      label: 'Chenciner & Montgomery — Figure-eight solution',
      url: 'https://arxiv.org/abs/math/0011268',
    },
  },
  nBody: {
    overview:
      'A direct planar gravitational N-body calculation. Equal-mass particles begin in a deterministic, truncated projected Plummer-like cluster and interact through every pairwise force.',
    parameters: [
      { name: 'N', meaning: 'Number of gravitating bodies. Direct force cost grows as O(N²).' },
      { name: 'a', meaning: 'Scale radius of the initial projected cluster.' },
      {
        name: 'Q',
        meaning:
          'Initial virial ratio T/|W|. Q = 0.5 is virial equilibrium; lower values collapse and higher values expand.',
      },
      { name: 'ε', meaning: 'Plummer force-softening length for close encounters.' },
      { name: 'Δt', meaning: 'Shared fixed Velocity Verlet timestep.' },
    ],
    method:
      'Total mass and G are one. Center-of-mass motion is removed and velocities are rescaled to the requested Q before direct O(N²) integration.',
    limitation:
      'This is a deterministic planar teaching model, not a full 3D equilibrium realization. Equal masses, a global timestep and softening suppress realistic binaries and close encounters.',
    reference: {
      label: 'Rodriguez et al. — Dense-cluster N-body modeling',
      url: 'https://arxiv.org/abs/2106.02643',
    },
  },
  quantum: {
    overview:
      'A normalized Gaussian matter-wave packet approaches a rectangular potential barrier. Its probability amplitude can partially reflect and partially tunnel through even when the mean kinetic energy is below the barrier.',
    parameters: [
      {
        name: 'k₀',
        meaning:
          'Central wave number and mean momentum. In these units the mean kinetic energy is approximately k₀²/2.',
      },
      {
        name: 'σ',
        meaning: 'Initial spatial width. Narrower packets contain a broader momentum distribution.',
      },
      { name: 'V₀', meaning: 'Height of the rectangular potential barrier.' },
      {
        name: 'w',
        meaning: 'Barrier width. Increasing either width or height generally suppresses tunneling.',
      },
      { name: 'Δt', meaning: 'Crank–Nicolson timestep for unitary time propagation.' },
    ],
    method:
      'The linear time-dependent Schrödinger equation is discretized on 256 points with ħ = m = 1. A complex tridiagonal Crank–Nicolson solve advances ψ with fixed zero boundaries.',
    limitation:
      'This is a one-dimensional, single-particle, non-relativistic model. Left and right probabilities become reflection/transmission estimates only after barrier separation and before reflections from the fixed outer boundaries return.',
    reference: {
      label: 'Crank & Nicolson — Implicit finite-difference method',
      url: 'https://doi.org/10.1017/S0305004100023197',
    },
  },
  epidemic: {
    overview:
      'A spatial stochastic SIR epidemic on a two-dimensional population lattice. Every visible point is a person; infection pressure from an infectious neighbor decays with distance as K(r) ∝ r⁻ᵖ.',
    parameters: [
      {
        name: 'β',
        meaning:
          'Transmission intensity per unit model time after the spatial kernel is normalized.',
      },
      {
        name: 'γ',
        meaning: 'Per-capita recovery rate; 1/γ is the mean infectious duration in model time.',
      },
      {
        name: 'p',
        meaning:
          'Distance-kernel exponent. Larger p concentrates transmission among close neighbors.',
      },
      {
        name: 'I₀',
        meaning:
          'Initially infectious fraction among occupied sites, rounded to a whole person and seeded near the center.',
      },
      {
        name: 'ρ',
        meaning: 'Population density: the fraction of lattice sites occupied by people.',
      },
      { name: 'R', meaning: 'Maximum interaction radius, measured in lattice cells.' },
      { name: 'Δt', meaning: 'Duration of each stochastic transmission and recovery step.' },
    ],
    method:
      'For each susceptible person, the normalized exposure is ΣⱼIⱼrᵢⱼ⁻ᵖ/Z within radius R. Infection and recovery are independent Bernoulli events with probabilities 1 − exp(−βΔt·exposure) and 1 − exp(−γΔt). Fixed boundaries and a reproducible pseudo-random sequence make parameter comparisons repeatable.',
    limitation:
      'This is an educational spatial scenario, not a forecast. People do not move, births and deaths are absent, and the lattice omits household structure, age, latency, superspreading and changing interventions.',
    reference: {
      label: 'Meyer & Held — Power-law spatial transmission kernels',
      url: 'https://doi.org/10.1214/14-AOAS743',
    },
  },
  reaction: {
    overview:
      'The Gray–Scott model couples diffusion with the autocatalytic reaction U + 2V → 3V and removal of V, generating spots, stripes and traveling structures.',
    parameters: [
      { name: 'F', meaning: 'Feed rate replenishing U.' },
      { name: 'k', meaning: 'Removal rate of V, in addition to the feed dilution.' },
      { name: 'Dᵤ, Dᵥ', meaning: 'Diffusion coefficients for the two concentrations.' },
      {
        name: 'Δt',
        meaning: 'Explicit Euler timestep. The displayed λ = 4 max(D)Δt must remain at or below 1.',
      },
    ],
    method:
      'A five-point Laplacian with Δx = 1 advances two nondimensional concentration fields on a 96×64 periodic grid. Concentrations are numerically clipped to [0,1].',
    limitation:
      'Grid resolution and clipping affect fine structures. Parameters are nondimensional and patterns are qualitative rather than a calibrated chemical experiment.',
    reference: {
      label: 'Gray & Scott — Autocatalytic reactions',
      url: 'https://doi.org/10.1016/0009-2509(84)87017-7',
    },
  },
  doublePendulum: {
    overview:
      'A planar double pendulum demonstrates deterministic chaos: nearby initial states obey the same equations yet can separate exponentially in phase space.',
    parameters: [
      { name: 'm₂/m₁', meaning: 'Lower-to-upper bob mass ratio.' },
      { name: 'L₂/L₁', meaning: 'Lower-to-upper rod length ratio.' },
      { name: 'g', meaning: 'Dimensionless gravitational acceleration.' },
      { name: 'θ₁', meaning: 'Initial upper-arm angle; the lower angle starts at 0.53θ₁.' },
      { name: 'Δt', meaning: 'Fourth-order Runge–Kutta timestep.' },
    ],
    method:
      'The coupled Euler–Lagrange equations are integrated directly. Relative energy drift is a useful local numerical check, though RK4 is not symplectic.',
    limitation:
      'Point masses, rigid massless rods and frictionless pivots are assumed. Long-term path agreement is impossible in a chaotic regime even when energy drift is small.',
    reference: {
      label: 'RBEF — Double-pendulum numerical analysis',
      url: 'https://www.scielo.br/j/rbef/a/SsWk5qnzBgvmYB4hRtkbwqM/',
    },
  },
  wave: {
    overview:
      'A scalar two-dimensional wave field driven by two coherent in-phase point sources. Their path difference produces moving constructive and destructive interference.',
    parameters: [
      {
        name: 'CFL',
        meaning: 'Courant number cΔt/Δx. For this 2D stencil it must not exceed 1/√2 ≈ 0.707.',
      },
      {
        name: 'Frequency',
        meaning: 'Cycles per unit model time, shared by both coherent sources.',
      },
      { name: 'Damping', meaning: 'Numerical linear attenuation applied at every field update.' },
      { name: 'Separation', meaning: 'Distance between sources measured in grid cells.' },
    ],
    method:
      'Centered second differences update a 96×64 field with Δx = 1, Δt = 0.05 and fixed zero boundaries; wave speed is therefore c = CFL/Δt. The displayed RMS summarizes field amplitude.',
    limitation:
      'This is a scalar, linear, homogeneous medium. It omits vector polarization, material dispersion and absorbing boundaries, so edge reflections are physical to this setup.',
    reference: {
      label: 'MIT OCW — Wave equation and leapfrog stability',
      url: 'https://ocw.mit.edu/courses/18-086-mathematical-methods-for-engineers-ii-spring-2006/8eaa23367474c809cc0816f24fdacc7f_am53.pdf',
    },
  },
  lorenz3d: {
    overview:
      'A trajectory through the three-dimensional phase space of the Lorenz system. The two lobes are not physical objects: they encode the evolving state (x, y, z) of a reduced convection model.',
    parameters: [
      { name: 'σ', meaning: 'Prandtl-like parameter controlling fast thermal relaxation.' },
      {
        name: 'ρ',
        meaning:
          'Rayleigh-like forcing parameter. With σ = 10 and β = 8/3, the classical chaotic example uses ρ = 28.',
      },
      { name: 'β', meaning: 'Geometric dissipation parameter; the classical value is 8/3.' },
      { name: 'Δt', meaning: 'Fourth-order Runge–Kutta timestep.' },
    ],
    method:
      'The autonomous three-variable ODE is advanced with RK4. The colored trail is the recent phase-space trajectory, rendered with perspective projection and an orbitable camera.',
    limitation:
      'The Lorenz equations are a severe spectral truncation of fluid convection. They demonstrate sensitive dependence and strange-attractor geometry, not quantitative weather prediction.',
    reference: {
      label: 'Lorenz — Deterministic nonperiodic flow',
      url: 'https://doi.org/10.1175/1520-0469(1963)020%3C0130:DNF%3E2.0.CO;2',
    },
  },
  gravity3d: {
    overview:
      'A direct three-dimensional softened-Newtonian N-body cluster. Every particle attracts every other particle, allowing collapse, virialization, evaporation and close gravitational encounters.',
    parameters: [
      {
        name: 'N',
        meaning: 'Number of equal-mass bodies; direct force evaluation scales as O(N²).',
      },
      { name: 'Q', meaning: 'Initial virial ratio T/|W|. Q = 0.5 is approximate equilibrium.' },
      { name: 'ε', meaning: 'Plummer softening length that regularizes close encounters.' },
      { name: 'Δt', meaning: 'Shared Velocity Verlet timestep.' },
    ],
    method:
      'With G = 1 and total mass one, bodies begin in a deterministic spherical distribution with center-of-mass motion removed. Velocities are rescaled to Q, then pairwise forces are integrated symplectically in x, y and z.',
    limitation:
      'Equal masses, softening and a global fixed timestep limit realistic collisional dynamics. The initial sphere is pedagogical rather than an exact equilibrium distribution function.',
    reference: {
      label: 'Aarseth — Direct gravitational N-body modelling',
      url: 'https://doi.org/10.1017/CBO9780511535246',
    },
  },
  magnetic3d: {
    overview:
      'An ensemble of charged particles moves in uniform axial fields E = Ezẑ and B = Bzẑ. Perpendicular velocity produces gyromotion while parallel velocity creates helices along the magnetic field.',
    parameters: [
      { name: 'N', meaning: 'Number of independent test particles.' },
      {
        name: 'Bz',
        meaning:
          'Signed axial magnetic field; with q/m = 1 its magnitude sets gyrofrequency and its sign reverses gyromotion.',
      },
      { name: 'Ez', meaning: 'Signed axial electric field, collinear with the magnetic field.' },
      {
        name: 'α',
        meaning: 'Initial pitch angle between velocity and B; when Bz = 0 it is measured from +z.',
      },
      { name: 'ν', meaning: 'Mean elastic collision frequency; ν = 0 disables collisions.' },
      { name: 'Δt', meaning: 'Boris-pusher timestep.' },
    ],
    method:
      'The Boris algorithm uses an electric half-kick, a three-dimensional magnetic rotation and a second half-kick. Optional equal-mass pairs scatter isotropically in their center-of-mass frame, exactly preserving pair momentum and kinetic energy.',
    limitation:
      'Fields are uniform and prescribed. The optional collisions provide homogeneous elastic relaxation rather than a calibrated Coulomb cross-section. Radiation, relativistic momentum and self-consistent fields are omitted; positions wrap through the display volume.',
    reference: {
      label: 'Takizuka & Abe — Binary Monte Carlo plasma collisions',
      url: 'https://doi.org/10.1016/0021-9991(77)90099-7',
    },
  },
  springChain: {
    overview:
      'A finite one-dimensional crystal analogue: identical masses are coupled by identical Hooke springs between two fixed endpoints. The selected standing-wave mode reveals normal-mode structure and lattice dispersion.',
    parameters: [
      { name: 'N', meaning: 'Number of moving masses between the two fixed endpoints.' },
      { name: 'k', meaning: 'Nearest-neighbor spring constant.' },
      { name: 'm', meaning: 'Mass assigned to every moving oscillator.' },
      { name: 'p', meaning: 'Normal-mode index, from the lowest collective mode upward.' },
      { name: 'A', meaning: 'Initial modal displacement amplitude.' },
      { name: 'Δt', meaning: 'Velocity Verlet timestep.' },
    ],
    method:
      'Fixed boundaries impose x₀ = xₙ₊₁ = 0. The initial shape is xᵢ = A sin[pπi/(N+1)], with exact angular frequency ωₚ = 2√(k/m) sin[pπ/(2(N+1))]. Nearest-neighbor forces are advanced symplectically.',
    limitation:
      'Springs are massless, perfectly linear and restricted to small transverse displacements. There is no damping, disorder, nonlinear elasticity or continuum bending stiffness.',
    reference: {
      label: 'MIT — Coupled oscillators and normal modes',
      url: 'https://ocw.mit.edu/courses/res-8-009-introduction-to-oscillations-and-waves-summer-2017/',
    },
  },
  duffing: {
    overview:
      'A unit mass attached to a nonlinear spring with linear damping and harmonic forcing. Positive cubic stiffness hardens the response; negative linear stiffness with positive cubic stiffness creates a double-well potential.',
    parameters: [
      { name: 'α', meaning: 'Linear stiffness; α < 0 produces a symmetric double well.' },
      { name: 'β', meaning: 'Positive cubic stiffness that bounds the potential at large |x|.' },
      { name: 'δ', meaning: 'Linear viscous damping coefficient.' },
      { name: 'F', meaning: 'Amplitude of the harmonic driving force.' },
      { name: 'Ω', meaning: 'Angular frequency of the driving force.' },
      { name: 'Δt', meaning: 'Fourth-order Runge–Kutta timestep.' },
    ],
    method:
      'The solver integrates ẍ + δẋ + αx + βx³ = F cos(Ωt). The physical view and phase portrait update together; mechanical energy is E = ½ẋ² + ½αx² + ¼βx⁴.',
    limitation:
      'This is a lumped, dimensionless single-mode model. Apparent chaos should be checked through timestep convergence and a Poincaré or Lyapunov analysis; the phase trace alone is not proof of chaos.',
    reference: {
      label: 'APS — Driven Duffing oscillator dynamics',
      url: 'https://doi.org/10.1103/PhysRevLett.116.044101',
    },
  },
};

@Component({
  selector: 'app-simulation-page',
  imports: [RouterLink],
  templateUrl: './simulation-page.html',
  styleUrl: './simulation-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationPage implements AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('simCanvas');
  protected readonly selectedScenario = signal<Scenario>(DEFAULT_SCENARIO.id);
  protected readonly running = signal(true);
  protected readonly speed = signal(1);
  protected readonly speedOptions = [0.1, 0.25, 0.5, 1, 2, 4] as const;
  protected readonly fps = signal(60);
  protected readonly metric = signal('t = 0.000');
  protected readonly isThreeDimensional = computed(() =>
    ['lorenz3d', 'gravity3d', 'magnetic3d'].includes(this.selectedScenario()),
  );
  protected readonly controls = signal<Record<ControlKey, number>>({
    orbitalEccentricity: 0.35,
    orbitalMassRatio: 0.08,
    orbitalStep: 0.003,
    particleCount: 140,
    magneticField: 1.2,
    electricField: 0,
    chargeMassRatio: 1,
    thermalSpeed: 0.7,
    fieldCollisionRate: 0,
    fieldStep: 0.006,
    pendulums: 11,
    spread: 0.55,
    pendulumGravity: 1,
    revivalTime: 30,
    baseCycles: 24,
    pendulumStep: 0.004,
    powerExponent: 2,
    powerStrength: 1,
    initialVelocity: 0.82,
    powerStep: 0.004,
    thirdMass: 1,
    softening: 0.002,
    integrationStep: 0.003,
    epidemicBeta: 0.48,
    epidemicGamma: 0.14,
    epidemicExponent: 1,
    initialInfected: 0.01,
    epidemicDensity: 0.72,
    epidemicRadius: 6,
    epidemicStep: 0.15,
    reactionFeed: 0.0367,
    reactionKill: 0.0649,
    reactionDiffU: 0.16,
    reactionDiffV: 0.08,
    reactionStep: 1,
    doubleMassRatio: 1,
    doubleLengthRatio: 1,
    doubleGravity: 1,
    doubleInitialAngle: 1.35,
    doubleStep: 0.002,
    waveCfl: 0.58,
    waveFrequency: 1.2,
    waveDamping: 0.006,
    waveSeparation: 24,
    nBodyCount: 48,
    nBodyScale: 1,
    nBodyVirialRatio: 0.5,
    nBodySoftening: 0.035,
    nBodyStep: 0.002,
    quantumMomentum: 3.4,
    quantumPacketWidth: 0.65,
    quantumBarrierHeight: 7,
    quantumBarrierWidth: 0.7,
    quantumStep: 0.002,
    lorenzSigma: 10,
    lorenzRho: 28,
    lorenzBeta: 2.667,
    lorenzStep: 0.005,
    gravity3dCount: 72,
    gravity3dVirial: 0.5,
    gravity3dSoftening: 0.045,
    gravity3dStep: 0.002,
    magnetic3dCount: 36,
    magnetic3dField: 1.4,
    magnetic3dElectric: 0,
    magnetic3dPitch: 42,
    magnetic3dCollisionRate: 0,
    magnetic3dStep: 0.008,
    springCount: 18,
    springConstant: 1,
    springMass: 1,
    springMode: 3,
    springAmplitude: 0.7,
    springStep: 0.006,
    duffingLinear: -1,
    duffingCubic: 1,
    duffingDamping: 0.2,
    duffingDrive: 0.3,
    duffingFrequency: 1.2,
    duffingStep: 0.005,
  });
  protected readonly scenarios = SCENARIOS;
  protected readonly scenario = computed(() =>
    this.scenarios.find((item) => item.id === this.selectedScenario())!,
  );
  protected readonly guide = computed(() => MODEL_GUIDES[this.selectedScenario()]);
  protected readonly activeControls = computed<Control[]>(() => {
    if (this.selectedScenario() === 'orbit')
      return [
        {
          key: 'orbitalEccentricity',
          label: 'Eccentricity e',
          min: 0,
          max: 0.85,
          step: 0.01,
          unit: '',
        },
        {
          key: 'orbitalMassRatio',
          label: 'Mass ratio m₂/m₁',
          min: 0.001,
          max: 0.5,
          step: 0.001,
          unit: '',
        },
        {
          key: 'orbitalStep',
          label: 'Integrator Δt',
          min: 0.001,
          max: 0.01,
          step: 0.001,
          unit: '',
        },
      ];
    if (this.selectedScenario() === 'field')
      return [
        { key: 'particleCount', label: 'Ensemble N', min: 20, max: 260, step: 10, unit: '' },
        { key: 'magneticField', label: 'Magnetic Bz', min: -2.5, max: 2.5, step: 0.1, unit: '' },
        { key: 'electricField', label: 'Electric Ex', min: -0.6, max: 0.6, step: 0.05, unit: '' },
        { key: 'chargeMassRatio', label: 'Charge / mass', min: -2, max: 2, step: 0.1, unit: 'q/m' },
        { key: 'thermalSpeed', label: 'Initial speed σ', min: 0.1, max: 1.4, step: 0.05, unit: '' },
        {
          key: 'fieldCollisionRate',
          label: 'Collision rate ν',
          min: 0,
          max: 2,
          step: 0.05,
          unit: 't⁻¹',
        },
        { key: 'fieldStep', label: 'Boris Δt', min: 0.002, max: 0.02, step: 0.001, unit: '' },
      ];
    if (this.selectedScenario() === 'pendulum')
      return [
        { key: 'pendulums', label: 'Pendulums', min: 5, max: 18, step: 1, unit: '' },
        { key: 'spread', label: 'Amplitude', min: 0.2, max: 0.9, step: 0.05, unit: 'rad' },
        { key: 'pendulumGravity', label: 'Gravity g', min: 0.2, max: 2, step: 0.05, unit: '' },
        { key: 'revivalTime', label: 'Design revival', min: 15, max: 60, step: 1, unit: 't' },
        { key: 'baseCycles', label: 'Base cycles', min: 12, max: 40, step: 1, unit: '' },
        {
          key: 'pendulumStep',
          label: 'Integrator Δt',
          min: 0.001,
          max: 0.012,
          step: 0.001,
          unit: '',
        },
      ];
    if (this.selectedScenario() === 'powerLaw')
      return [
        { key: 'powerExponent', label: 'Exponent n', min: 0.5, max: 4, step: 0.1, unit: '' },
        { key: 'powerStrength', label: 'Coupling k', min: 0.2, max: 2, step: 0.05, unit: '' },
        { key: 'initialVelocity', label: 'Initial vₜ', min: 0.2, max: 1.5, step: 0.02, unit: '' },
        { key: 'powerStep', label: 'Integrator Δt', min: 0.001, max: 0.012, step: 0.001, unit: '' },
      ];
    if (this.selectedScenario() === 'threeBody')
      return [
        { key: 'thirdMass', label: 'Third mass m₃', min: 0.25, max: 2.5, step: 0.05, unit: 'M' },
        { key: 'softening', label: 'Softening ε', min: 0, max: 0.02, step: 0.001, unit: '' },
        {
          key: 'integrationStep',
          label: 'Integrator Δt',
          min: 0.001,
          max: 0.01,
          step: 0.001,
          unit: '',
        },
      ];
    if (this.selectedScenario() === 'epidemic')
      return [
        { key: 'epidemicBeta', label: 'Transmission β', min: 0.2, max: 3, step: 0.01, unit: '' },
        { key: 'epidemicGamma', label: 'Recovery γ', min: 0.03, max: 0.8, step: 0.01, unit: '' },
        {
          key: 'epidemicExponent',
          label: 'Distance exponent p',
          min: 0,
          max: 4,
          step: 0.1,
          unit: '',
        },
        {
          key: 'initialInfected',
          label: 'Initial infected',
          min: 0.001,
          max: 0.12,
          step: 0.001,
          unit: '',
        },
        {
          key: 'epidemicDensity',
          label: 'Population density ρ',
          min: 0.2,
          max: 0.95,
          step: 0.01,
          unit: '',
        },
        {
          key: 'epidemicRadius',
          label: 'Interaction radius R',
          min: 2,
          max: 12,
          step: 1,
          unit: 'cells',
        },
        { key: 'epidemicStep', label: 'Stochastic Δt', min: 0.05, max: 0.5, step: 0.05, unit: '' },
      ];
    if (this.selectedScenario() === 'reaction')
      return [
        { key: 'reactionFeed', label: 'Feed F', min: 0.01, max: 0.08, step: 0.0001, unit: '' },
        { key: 'reactionKill', label: 'Kill k', min: 0.035, max: 0.075, step: 0.0001, unit: '' },
        { key: 'reactionDiffU', label: 'Diffusion Dᵤ', min: 0.08, max: 0.24, step: 0.01, unit: '' },
        { key: 'reactionDiffV', label: 'Diffusion Dᵥ', min: 0.03, max: 0.14, step: 0.01, unit: '' },
        { key: 'reactionStep', label: 'Euler Δt', min: 0.2, max: 1, step: 0.1, unit: '' },
      ];
    if (this.selectedScenario() === 'doublePendulum')
      return [
        {
          key: 'doubleMassRatio',
          label: 'Mass ratio m₂/m₁',
          min: 0.2,
          max: 3,
          step: 0.05,
          unit: '',
        },
        {
          key: 'doubleLengthRatio',
          label: 'Length ratio L₂/L₁',
          min: 0.3,
          max: 1.8,
          step: 0.05,
          unit: '',
        },
        { key: 'doubleGravity', label: 'Gravity g', min: 0.2, max: 2, step: 0.05, unit: '' },
        {
          key: 'doubleInitialAngle',
          label: 'Initial θ₁',
          min: 0.2,
          max: 2.8,
          step: 0.05,
          unit: 'rad',
        },
        { key: 'doubleStep', label: 'RK4 Δt', min: 0.0005, max: 0.008, step: 0.0005, unit: '' },
      ];
    if (this.selectedScenario() === 'wave')
      return [
        { key: 'waveCfl', label: 'Courant number', min: 0.1, max: 0.7, step: 0.02, unit: '' },
        {
          key: 'waveFrequency',
          label: 'Source frequency',
          min: 0.3,
          max: 2.5,
          step: 0.1,
          unit: '',
        },
        { key: 'waveDamping', label: 'Damping', min: 0, max: 0.03, step: 0.001, unit: '' },
        {
          key: 'waveSeparation',
          label: 'Source separation',
          min: 8,
          max: 50,
          step: 2,
          unit: 'cells',
        },
      ];
    if (this.selectedScenario() === 'nBody')
      return [
        { key: 'nBodyCount', label: 'Body count N', min: 4, max: 160, step: 4, unit: '' },
        { key: 'nBodyScale', label: 'Cluster scale a', min: 0.5, max: 1.8, step: 0.05, unit: '' },
        {
          key: 'nBodyVirialRatio',
          label: 'Virial ratio Q',
          min: 0.05,
          max: 1,
          step: 0.05,
          unit: '',
        },
        {
          key: 'nBodySoftening',
          label: 'Softening ε',
          min: 0.005,
          max: 0.1,
          step: 0.005,
          unit: '',
        },
        {
          key: 'nBodyStep',
          label: 'Integrator Δt',
          min: 0.0005,
          max: 0.006,
          step: 0.0005,
          unit: '',
        },
      ];
    if (this.selectedScenario() === 'lorenz3d')
      return [
        { key: 'lorenzSigma', label: 'Sigma σ', min: 1, max: 20, step: 0.5, unit: '' },
        { key: 'lorenzRho', label: 'Rho ρ', min: 0, max: 50, step: 0.5, unit: '' },
        { key: 'lorenzBeta', label: 'Beta β', min: 0.5, max: 5, step: 0.001, unit: '' },
        { key: 'lorenzStep', label: 'RK4 Δt', min: 0.001, max: 0.015, step: 0.001, unit: '' },
      ];
    if (this.selectedScenario() === 'gravity3d')
      return [
        { key: 'gravity3dCount', label: 'Body count N', min: 12, max: 140, step: 4, unit: '' },
        {
          key: 'gravity3dVirial',
          label: 'Virial ratio Q',
          min: 0.05,
          max: 1,
          step: 0.05,
          unit: '',
        },
        {
          key: 'gravity3dSoftening',
          label: 'Softening ε',
          min: 0.005,
          max: 0.12,
          step: 0.005,
          unit: '',
        },
        {
          key: 'gravity3dStep',
          label: 'Verlet Δt',
          min: 0.0005,
          max: 0.006,
          step: 0.0005,
          unit: '',
        },
      ];
    if (this.selectedScenario() === 'magnetic3d')
      return [
        { key: 'magnetic3dCount', label: 'Particle count N', min: 4, max: 80, step: 4, unit: '' },
        {
          key: 'magnetic3dField',
          label: 'Magnetic field Bz',
          min: -3,
          max: 3,
          step: 0.1,
          unit: '',
        },
        {
          key: 'magnetic3dElectric',
          label: 'Electric field Ez',
          min: -0.3,
          max: 0.3,
          step: 0.01,
          unit: '',
        },
        { key: 'magnetic3dPitch', label: 'Pitch angle α', min: 0, max: 90, step: 1, unit: '°' },
        {
          key: 'magnetic3dCollisionRate',
          label: 'Collision rate ν',
          min: 0,
          max: 2,
          step: 0.05,
          unit: 't⁻¹',
        },
        { key: 'magnetic3dStep', label: 'Boris Δt', min: 0.002, max: 0.02, step: 0.001, unit: '' },
      ];
    if (this.selectedScenario() === 'springChain')
      return [
        { key: 'springCount', label: 'Mass count N', min: 6, max: 40, step: 1, unit: '' },
        {
          key: 'springConstant',
          label: 'Spring constant k',
          min: 0.2,
          max: 3,
          step: 0.05,
          unit: '',
        },
        { key: 'springMass', label: 'Mass m', min: 0.2, max: 3, step: 0.05, unit: '' },
        {
          key: 'springMode',
          label: 'Mode index p',
          min: 1,
          max: Math.min(12, Math.round(this.controls().springCount)),
          step: 1,
          unit: '',
        },
        { key: 'springAmplitude', label: 'Amplitude A', min: 0.1, max: 1, step: 0.05, unit: '' },
        { key: 'springStep', label: 'Verlet Δt', min: 0.001, max: 0.02, step: 0.001, unit: '' },
      ];
    if (this.selectedScenario() === 'duffing')
      return [
        {
          key: 'duffingLinear',
          label: 'Linear stiffness α',
          min: -1.5,
          max: 1.5,
          step: 0.05,
          unit: '',
        },
        { key: 'duffingCubic', label: 'Cubic stiffness β', min: 0.2, max: 2, step: 0.05, unit: '' },
        { key: 'duffingDamping', label: 'Damping δ', min: 0, max: 0.6, step: 0.01, unit: '' },
        { key: 'duffingDrive', label: 'Drive amplitude F', min: 0, max: 1, step: 0.02, unit: '' },
        {
          key: 'duffingFrequency',
          label: 'Drive frequency Ω',
          min: 0.2,
          max: 2.5,
          step: 0.05,
          unit: '',
        },
        { key: 'duffingStep', label: 'RK4 Δt', min: 0.001, max: 0.015, step: 0.001, unit: '' },
      ];
    return [
      { key: 'quantumMomentum', label: 'Mean wave number k₀', min: 1, max: 7, step: 0.1, unit: '' },
      {
        key: 'quantumPacketWidth',
        label: 'Packet width σ',
        min: 0.3,
        max: 1.2,
        step: 0.05,
        unit: '',
      },
      {
        key: 'quantumBarrierHeight',
        label: 'Barrier height V₀',
        min: 0,
        max: 18,
        step: 0.5,
        unit: '',
      },
      {
        key: 'quantumBarrierWidth',
        label: 'Barrier width w',
        min: 0.15,
        max: 1.8,
        step: 0.05,
        unit: '',
      },
      {
        key: 'quantumStep',
        label: 'Crank–Nicolson Δt',
        min: 0.0005,
        max: 0.006,
        step: 0.0005,
        unit: '',
      },
    ];
  });
  protected readonly solverNote = computed(() => {
    if (this.selectedScenario() === 'orbit')
      return {
        equation: 'aᵢ = G mⱼ(rⱼ−rᵢ)/|rⱼ−rᵢ|³',
        detail: 'Barycentric Kepler initial data · G = a = 1',
      };
    if (this.selectedScenario() === 'field')
      return {
        equation: 'dv/dt = (q/m)(E + v × B)',
        detail: 'Boris pusher · optional conservative binary collisions · dimensionless units',
      };
    if (this.selectedScenario() === 'pendulum')
      return {
        equation: 'θ̈ = −(g/L) sin θ',
        detail: 'Nonlinear Velocity Verlet · lengths tuned by small-angle periods',
      };
    if (this.selectedScenario() === 'powerLaw')
      return { equation: 'F(r) = −k r⁻ⁿ r̂', detail: 'Velocity Verlet · dimensionless units' };
    if (this.selectedScenario() === 'threeBody')
      return {
        equation: 'aᵢ = G Σⱼ mⱼ(rⱼ−rᵢ)/|rⱼ−rᵢ|³',
        detail: 'G = 1 · softened Velocity Verlet',
      };
    if (this.selectedScenario() === 'nBody')
      return {
        equation: 'aᵢ = G Σⱼ≠ᵢ mⱼrᵢⱼ/(rᵢⱼ²+ε²)³ᐟ²',
        detail: 'Direct O(N²) summation · equal masses · Velocity Verlet',
      };
    if (this.selectedScenario() === 'epidemic')
      return {
        equation: 'P(S→I) = 1 − exp[−βΔt Σⱼ Iⱼ rᵢⱼ⁻ᵖ/Z]',
        detail: 'Spatial stochastic SIR · power-law distance kernel · fixed boundary',
      };
    if (this.selectedScenario() === 'reaction')
      return {
        equation: '∂ᵗu = Dᵤ∇²u − uv² + F(1−u)',
        detail: 'Gray–Scott PDE · five-point Laplacian · periodic boundary',
      };
    if (this.selectedScenario() === 'doublePendulum')
      return {
        equation: 'M(θ)θ̈ + C(θ,θ̇) + G(θ) = 0',
        detail: 'Coupled nonlinear equations · fourth-order Runge–Kutta',
      };
    if (this.selectedScenario() === 'wave')
      return {
        equation: 'uⁿ⁺¹ = (2−d)uⁿ − (1−d)uⁿ⁻¹ + C²∇²uⁿ',
        detail: 'Damped 2D wave equation · Δx = 1 · Δt = 0.05 · coherent sources',
      };
    if (this.selectedScenario() === 'lorenz3d')
      return {
        equation: 'ẋ = σ(y−x), ẏ = x(ρ−z)−y, ż = xy−βz',
        detail: 'Three-dimensional phase space · RK4 · drag to orbit',
      };
    if (this.selectedScenario() === 'gravity3d')
      return {
        equation: 'aᵢ = G Σⱼ≠ᵢ mⱼrᵢⱼ/(rᵢⱼ²+ε²)³ᐟ²',
        detail: 'Direct 3D O(N²) gravity · Velocity Verlet · drag to orbit',
      };
    if (this.selectedScenario() === 'magnetic3d')
      return {
        equation: 'dv/dt = (q/m)(E + v × B)',
        detail: '3D Boris rotation · optional conservative binary collisions · drag to orbit',
      };
    if (this.selectedScenario() === 'springChain')
      return {
        equation: 'mẍᵢ = k(xᵢ₋₁ − 2xᵢ + xᵢ₊₁)',
        detail: 'Fixed-end Hooke chain · exact normal-mode initialization · Velocity Verlet',
      };
    if (this.selectedScenario() === 'duffing')
      return {
        equation: 'ẍ + δẋ + αx + βx³ = F cos(Ωt)',
        detail: 'Driven nonlinear spring · fourth-order Runge–Kutta · phase portrait',
      };
    return {
      equation: 'i ∂ψ/∂t = [−½∂ₓ² + V(x)]ψ',
      detail: 'ħ = m = 1 · Crank–Nicolson · 256-point spatial grid',
    };
  });

  private context: CanvasRenderingContext2D | null = null;
  private elapsed = 0;
  private lastFrame = 0;
  private animationFrame = 0;
  private lastFpsUpdate = 0;
  private frames = 0;
  private width = 0;
  private height = 0;
  private orbitBodies: ScientificBody[] = [];
  private particles: Particle[] = [];
  private fieldCollisionTick = 0;
  private pendulumStates: VisualPendulum[] = [];
  private powerBody: ScientificBody = this.createPowerBody();
  private threeBodies: ScientificBody[] = [];
  private nBodies: ScientificBody[] = [];
  private lorenzState: LorenzState = { x: 0.1, y: 0, z: 0 };
  private lorenzTrail: Point3D[] = [];
  private gravityBodies3D: VisualBody3D[] = [];
  private magneticParticles3D: VisualBody3D[] = [];
  private magneticCollisionTick = 0;
  private springDisplacements = new Float64Array(0);
  private springVelocities = new Float64Array(0);
  private springHistory: ScalarHistoryPoint[] = [];
  private duffingState: DuffingState = { position: 1, velocity: 0 };
  private duffingHistory: DuffingPoint[] = [];
  private epidemicGrid = new Uint8Array(96 * 64);
  private epidemicNext = new Uint8Array(96 * 64);
  private epidemicKernel: { dx: number; dy: number; weight: number }[] = [];
  private epidemicKernelNormalization = 1;
  private epidemicTick = 0;
  private epidemicAccumulator = 0;
  private epidemicNewInfections = 0;
  private epidemicHistory: EpidemicPoint[] = [];
  private doublePendulum: DoublePendulumState = {
    angle1: 1.35,
    angle2: 0.7,
    angularVelocity1: 0,
    angularVelocity2: 0,
  };
  private doubleTrail: { x: number; y: number }[] = [];
  private readonly fieldWidth = 96;
  private readonly fieldHeight = 64;
  private readonly waveTimeStep = 0.05;
  private reactionU = new Float32Array(this.fieldWidth * this.fieldHeight);
  private reactionV = new Float32Array(this.fieldWidth * this.fieldHeight);
  private reactionNextU = new Float32Array(this.fieldWidth * this.fieldHeight);
  private reactionNextV = new Float32Array(this.fieldWidth * this.fieldHeight);
  private waveCurrent = new Float32Array(this.fieldWidth * this.fieldHeight);
  private wavePrevious = new Float32Array(this.fieldWidth * this.fieldHeight);
  private waveNext = new Float32Array(this.fieldWidth * this.fieldHeight);
  private readonly quantumPoints = 256;
  private readonly quantumMinimum = -10;
  private readonly quantumMaximum = 10;
  private readonly quantumSpatialStep =
    (this.quantumMaximum - this.quantumMinimum) / (this.quantumPoints - 1);
  private quantumReal = new Float64Array(this.quantumPoints);
  private quantumImaginary = new Float64Array(this.quantumPoints);
  private quantumPotential = new Float64Array(this.quantumPoints);
  private quantumInitialNorm = 1;
  private rasterCanvas: HTMLCanvasElement | null = null;
  private rasterContext: CanvasRenderingContext2D | null = null;
  private initialInvariant = 0;
  private simulationTime = 0;
  private cameraYaw = 0.68;
  private cameraPitch = 0.38;
  private cameraZoom = 1;
  private cameraPointer: number | null = null;
  private cameraLastX = 0;
  private cameraLastY = 0;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((parameters) => {
      const routeSlug =
        parameters.get('slug') ?? (this.route.snapshot.data['scenarioSlug'] as string | undefined);
      const scenario = getScenarioBySlug(routeSlug ?? null);
      const changed = this.selectedScenario() !== scenario.id;

      this.selectedScenario.set(scenario.id);
      this.updateSeo(scenario);
      if (changed) this.resetSimulation();
    });
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.context = this.canvas().nativeElement.getContext('2d');
    this.rasterCanvas = document.createElement('canvas');
    this.rasterCanvas.width = this.fieldWidth;
    this.rasterCanvas.height = this.fieldHeight;
    this.rasterContext = this.rasterCanvas.getContext('2d');
    this.resizeCanvas();
    window.addEventListener('resize', this.resizeCanvas);
    this.animationFrame = requestAnimationFrame((time) => this.animate(time));
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;
    window.removeEventListener('resize', this.resizeCanvas);
    cancelAnimationFrame(this.animationFrame);
  }

  protected toggleRunning(): void {
    this.running.update((running) => !running);
  }
  protected setSpeed(speed: number): void {
    this.speed.set(speed);
  }
  private updateSeo(scenario: ScenarioDefinition): void {
    const pageTitle = `${scenario.name} Simulator | Kinetica Physics Lab`;
    const canonicalUrl = `https://banegasn.github.io/physics-lab/simulations/${scenario.slug}/`;
    const socialImageUrl = 'https://banegasn.github.io/physics-lab/og.png';

    this.title.setTitle(pageTitle);
    this.meta.updateTag({ name: 'description', content: scenario.seoDescription });
    this.meta.updateTag({ name: 'robots', content: 'index, follow' });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: 'Kinetica Physics Lab' });
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: scenario.seoDescription });
    this.meta.updateTag({ property: 'og:url', content: canonicalUrl });
    this.meta.updateTag({ property: 'og:image', content: socialImageUrl });
    this.meta.updateTag({ property: 'og:image:width', content: '1200' });
    this.meta.updateTag({ property: 'og:image:height', content: '630' });
    this.meta.updateTag({ property: 'og:image:alt', content: 'Kinetica Interactive Physics Lab' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: pageTitle });
    this.meta.updateTag({ name: 'twitter:description', content: scenario.seoDescription });
    this.meta.updateTag({ name: 'twitter:image', content: socialImageUrl });
    this.meta.updateTag({ name: 'twitter:image:alt', content: 'Kinetica Interactive Physics Lab' });

    let canonical = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = this.document.createElement('link');
      canonical.rel = 'canonical';
      this.document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    let structuredData = this.document.head.querySelector<HTMLScriptElement>(
      '#simulation-structured-data',
    );
    if (!structuredData) {
      structuredData = this.document.createElement('script');
      structuredData.id = 'simulation-structured-data';
      structuredData.type = 'application/ld+json';
      this.document.head.appendChild(structuredData);
    }
    structuredData.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': ['SoftwareApplication', 'LearningResource'],
      name: `${scenario.name} Simulator`,
      description: scenario.seoDescription,
      url: canonicalUrl,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Any',
      isAccessibleForFree: true,
      learningResourceType: 'Interactive simulation',
      educationalUse: scenario.uses,
    });
  }
  protected startCameraDrag(event: PointerEvent): void {
    if (!this.isThreeDimensional()) return;
    this.cameraPointer = event.pointerId;
    this.cameraLastX = event.clientX;
    this.cameraLastY = event.clientY;
    (event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId);
  }
  protected moveCamera(event: PointerEvent): void {
    if (this.cameraPointer !== event.pointerId) return;
    this.cameraYaw += (event.clientX - this.cameraLastX) * 0.008;
    this.cameraPitch = Math.max(
      -1.35,
      Math.min(1.35, this.cameraPitch + (event.clientY - this.cameraLastY) * 0.008),
    );
    this.cameraLastX = event.clientX;
    this.cameraLastY = event.clientY;
  }
  protected endCameraDrag(event: PointerEvent): void {
    if (this.cameraPointer === event.pointerId) this.cameraPointer = null;
  }
  protected zoomCamera(event: WheelEvent): void {
    if (!this.isThreeDimensional()) return;
    event.preventDefault();
    this.cameraZoom = Math.max(
      0.55,
      Math.min(2.2, this.cameraZoom * Math.exp(-event.deltaY * 0.001)),
    );
  }
  protected updateControl(key: ControlKey, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.controls.update((controls) => ({
      ...controls,
      [key]: value,
      ...(key === 'springCount'
        ? { springMode: Math.min(controls.springMode, Math.round(value)) }
        : {}),
    }));
    if (
      [
        'orbitalEccentricity',
        'orbitalMassRatio',
        'particleCount',
        'magneticField',
        'electricField',
        'chargeMassRatio',
        'thermalSpeed',
        'pendulums',
        'spread',
        'pendulumGravity',
        'revivalTime',
        'baseCycles',
        'powerExponent',
        'powerStrength',
        'initialVelocity',
        'thirdMass',
        'softening',
        'epidemicBeta',
        'epidemicGamma',
        'epidemicExponent',
        'initialInfected',
        'epidemicDensity',
        'epidemicRadius',
        'reactionFeed',
        'reactionKill',
        'reactionDiffU',
        'reactionDiffV',
        'doubleMassRatio',
        'doubleLengthRatio',
        'doubleGravity',
        'doubleInitialAngle',
        'waveCfl',
        'waveFrequency',
        'waveDamping',
        'waveSeparation',
        'nBodyCount',
        'nBodyScale',
        'nBodyVirialRatio',
        'nBodySoftening',
        'quantumMomentum',
        'quantumPacketWidth',
        'quantumBarrierHeight',
        'quantumBarrierWidth',
        'lorenzSigma',
        'lorenzRho',
        'lorenzBeta',
        'gravity3dCount',
        'gravity3dVirial',
        'gravity3dSoftening',
        'magnetic3dCount',
        'magnetic3dField',
        'magnetic3dElectric',
        'magnetic3dPitch',
        'springCount',
        'springConstant',
        'springMass',
        'springMode',
        'springAmplitude',
        'duffingLinear',
        'duffingCubic',
        'duffingDamping',
        'duffingDrive',
        'duffingFrequency',
      ].includes(key)
    )
      this.resetSimulation();
  }
  protected controlValue(key: ControlKey): number {
    return this.controls()[key];
  }
  protected formattedControl(control: Control): string {
    const value = this.controlValue(control.key);
    const decimalPlaces = Math.min(4, Math.max(0, Math.ceil(-Math.log10(control.step))));
    const cleanValue = value.toFixed(decimalPlaces);
    return `${cleanValue}${control.unit ? ` ${control.unit}` : ''}`;
  }
  protected resetSimulation(): void {
    this.elapsed = 0;
    this.simulationTime = 0;
    this.orbitBodies = this.createOrbitBodies();
    this.particles = this.createParticles(Math.round(this.controls().particleCount));
    this.fieldCollisionTick = 0;
    this.pendulumStates = this.createPendulums();
    this.powerBody = this.createPowerBody();
    this.threeBodies = this.createThreeBodies();
    this.nBodies = this.createNBodyCluster();
    this.lorenzState = { x: 0.1, y: 0, z: 0 };
    this.lorenzTrail = [];
    this.gravityBodies3D = this.createGravityCluster3D();
    this.magneticParticles3D = this.createMagneticParticles3D();
    this.magneticCollisionTick = 0;
    this.initializeSpringChain();
    this.duffingState = { position: 1, velocity: 0 };
    this.duffingHistory = [{ ...this.duffingState }];
    this.initializeEpidemic();
    this.doublePendulum = this.createDoublePendulum();
    this.doubleTrail = [];
    this.initializeReactionDiffusion();
    this.waveCurrent.fill(0);
    this.wavePrevious.fill(0);
    this.waveNext.fill(0);
    this.initializeQuantumState();
    if (this.selectedScenario() === 'orbit')
      this.initialInvariant = nBodyEnergy(this.orbitBodies, 1, 0);
    else if (this.selectedScenario() === 'field') this.initialInvariant = this.meanKineticEnergy();
    else if (this.selectedScenario() === 'pendulum')
      this.initialInvariant = this.totalPendulumEnergy();
    else if (this.selectedScenario() === 'powerLaw')
      this.initialInvariant = powerLawEnergy(
        this.powerBody,
        this.controls().powerStrength,
        this.controls().powerExponent,
      );
    else if (this.selectedScenario() === 'threeBody')
      this.initialInvariant = nBodyEnergy(this.threeBodies, 1, this.controls().softening);
    else if (this.selectedScenario() === 'nBody')
      this.initialInvariant = nBodyEnergy(this.nBodies, 1, this.controls().nBodySoftening);
    else if (this.selectedScenario() === 'gravity3d')
      this.initialInvariant = nBodyEnergy3D(
        this.gravityBodies3D,
        1,
        this.controls().gravity3dSoftening,
      );
    else if (this.selectedScenario() === 'magnetic3d')
      this.initialInvariant = this.meanKineticEnergy3D(this.magneticParticles3D);
    else if (this.selectedScenario() === 'springChain')
      this.initialInvariant = springChainEnergy(
        this.springDisplacements,
        this.springVelocities,
        this.controls().springConstant,
        this.controls().springMass,
      );
    else if (this.selectedScenario() === 'duffing')
      this.initialInvariant = duffingEnergy(
        this.duffingState,
        this.controls().duffingLinear,
        this.controls().duffingCubic,
      );
    else if (this.selectedScenario() === 'doublePendulum')
      this.initialInvariant = doublePendulumEnergy(
        this.doublePendulum,
        this.controls().doubleMassRatio,
        this.controls().doubleLengthRatio,
        this.controls().doubleGravity,
      );
    else this.initialInvariant = 0;
    this.metric.set('t = 0.000');
  }
  private readonly resizeCanvas = (): void => {
    const canvas = this.canvas().nativeElement;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    this.context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.resetSimulation();
  };
  private createOrbitBodies(): ScientificBody[] {
    const massRatio = this.controls().orbitalMassRatio;
    const totalMass = 1 + massRatio;
    const periapsis = 1 - this.controls().orbitalEccentricity;
    const relativeVelocity = Math.sqrt(
      (totalMass * (1 + this.controls().orbitalEccentricity)) / periapsis,
    );
    return [
      {
        x: (-massRatio / totalMass) * periapsis,
        y: 0,
        vx: 0,
        vy: (-massRatio / totalMass) * relativeVelocity,
        mass: 1,
        radius: 11,
        color: '#f5bf6f',
        trail: [],
      },
      {
        x: (1 / totalMass) * periapsis,
        y: 0,
        vx: 0,
        vy: (1 / totalMass) * relativeVelocity,
        mass: massRatio,
        radius: 7,
        color: '#7ae1c5',
        trail: [],
      },
    ];
  }
  private createParticles(count: number): Particle[] {
    const thermalSpeed = this.controls().thermalSpeed;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    return Array.from({ length: count }, (_, index) => {
      const quantile = (index + 0.5) / count;
      const speed = thermalSpeed * Math.sqrt(-2 * Math.log(1 - quantile * 0.94));
      const angle = index * goldenAngle;
      return {
        x: -1.55 + (index % 9) * 0.012,
        y: -1.25 + 2.5 * quantile,
        vx: speed * Math.cos(angle),
        vy: speed * Math.sin(angle),
        mass: 1,
        hue: 170 + quantile * 120,
        trail: [],
      };
    });
  }
  private createPendulums(): VisualPendulum[] {
    const { pendulums, spread, pendulumGravity, revivalTime, baseCycles } = this.controls();
    return Array.from({ length: Math.round(pendulums) }, (_, index) => {
      const cycles = baseCycles + index;
      return {
        angle: spread,
        angularVelocity: 0,
        length: pendulumGravity * (revivalTime / (2 * Math.PI * cycles)) ** 2,
        hue: 178 + index * 9,
      };
    });
  }
  private createPowerBody(): ScientificBody {
    return {
      x: 1,
      y: 0,
      vx: 0,
      vy: this.controls().initialVelocity,
      mass: 1,
      color: '#7ae1c5',
      radius: 7,
      trail: [],
    };
  }
  private createThreeBodies(): ScientificBody[] {
    const bodies: ScientificBody[] = [
      {
        x: -0.97000436,
        y: 0.24308753,
        vx: 0.466203685,
        vy: 0.43236573,
        mass: 1,
        color: '#70e7c4',
        radius: 7,
        trail: [],
      },
      {
        x: 0.97000436,
        y: -0.24308753,
        vx: 0.466203685,
        vy: 0.43236573,
        mass: 1,
        color: '#a899ff',
        radius: 7,
        trail: [],
      },
      {
        x: 0,
        y: 0,
        vx: -0.93240737,
        vy: -0.86473146,
        mass: this.controls().thirdMass,
        color: '#f5bf6f',
        radius: 7,
        trail: [],
      },
    ];
    const totalMass = bodies.reduce((sum, body) => sum + body.mass, 0);
    const centerX = bodies.reduce((sum, body) => sum + body.mass * body.x, 0) / totalMass;
    const centerY = bodies.reduce((sum, body) => sum + body.mass * body.y, 0) / totalMass;
    const centerVx = bodies.reduce((sum, body) => sum + body.mass * body.vx, 0) / totalMass;
    const centerVy = bodies.reduce((sum, body) => sum + body.mass * body.vy, 0) / totalMass;
    bodies.forEach((body) => {
      body.x -= centerX;
      body.y -= centerY;
      body.vx -= centerVx;
      body.vy -= centerVy;
    });
    return bodies;
  }
  private createNBodyCluster(): ScientificBody[] {
    const { nBodyCount, nBodyScale, nBodyVirialRatio, nBodySoftening } = this.controls();
    const count = Math.round(nBodyCount);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const bodies: ScientificBody[] = Array.from({ length: count }, (_, index) => {
      const quantile = (0.92 * (index + 0.5)) / count;
      const radius = nBodyScale * Math.sqrt(quantile / (1 - quantile));
      const angle = index * goldenAngle;
      const velocityAngle = angle + Math.PI / 2 + 0.48 * Math.sin(index * 1.73);
      const rawSpeed = 0.35 + 0.65 * (((index + 1) * 0.61803398875) % 1);
      return {
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
        vx: rawSpeed * Math.cos(velocityAngle),
        vy: rawSpeed * Math.sin(velocityAngle),
        mass: 1 / count,
        color: `hsl(${172 + (index / count) * 105}, 82%, 72%)`,
        radius: 3.2,
        trail: [],
      };
    });
    const centerX = bodies.reduce((sum, body) => sum + body.mass * body.x, 0);
    const centerY = bodies.reduce((sum, body) => sum + body.mass * body.y, 0);
    const centerVx = bodies.reduce((sum, body) => sum + body.mass * body.vx, 0);
    const centerVy = bodies.reduce((sum, body) => sum + body.mass * body.vy, 0);
    bodies.forEach((body) => {
      body.x -= centerX;
      body.y -= centerY;
      body.vx -= centerVx;
      body.vy -= centerVy;
    });
    const rawKinetic = bodies.reduce((sum, body) => sum + kineticEnergy(body), 0);
    const potential = nBodyEnergy(bodies, 1, nBodySoftening) - rawKinetic;
    const velocityScale = Math.sqrt((nBodyVirialRatio * Math.abs(potential)) / rawKinetic);
    bodies.forEach((body) => {
      body.vx *= velocityScale;
      body.vy *= velocityScale;
    });
    return bodies;
  }
  private createGravityCluster3D(): VisualBody3D[] {
    const { gravity3dCount, gravity3dVirial, gravity3dSoftening } = this.controls();
    const count = Math.round(gravity3dCount);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const bodies: VisualBody3D[] = Array.from({ length: count }, (_, index) => {
      const quantile = (index + 0.5) / count;
      const cosine = 1 - 2 * quantile;
      const sine = Math.sqrt(1 - cosine ** 2);
      const azimuth = index * goldenAngle;
      const radius = 1.35 * quantile ** (1 / 3);
      const x = radius * sine * Math.cos(azimuth);
      const y = radius * cosine;
      const z = radius * sine * Math.sin(azimuth);
      return {
        x,
        y,
        z,
        vx: -0.55 * z + 0.12 * Math.sin(index * 2.17),
        vy: 0.12 * Math.cos(index * 1.31),
        vz: 0.55 * x + 0.12 * Math.sin(index * 0.93),
        mass: 1 / count,
        color: `hsl(${175 + (index / count) * 105}, 82%, 72%)`,
        radius: 3.1,
        trail: [],
      };
    });
    const mean = bodies.reduce(
      (sum, body) => ({
        x: sum.x + body.mass * body.x,
        y: sum.y + body.mass * body.y,
        z: sum.z + body.mass * body.z,
        vx: sum.vx + body.mass * body.vx,
        vy: sum.vy + body.mass * body.vy,
        vz: sum.vz + body.mass * body.vz,
      }),
      { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
    );
    bodies.forEach((body) => {
      body.x -= mean.x;
      body.y -= mean.y;
      body.z -= mean.z;
      body.vx -= mean.vx;
      body.vy -= mean.vy;
      body.vz -= mean.vz;
    });
    const kinetic = bodies.reduce(
      (sum, body) => sum + 0.5 * body.mass * (body.vx ** 2 + body.vy ** 2 + body.vz ** 2),
      0,
    );
    const potential = nBodyEnergy3D(bodies, 1, gravity3dSoftening) - kinetic;
    const velocityScale = Math.sqrt((gravity3dVirial * Math.abs(potential)) / kinetic);
    bodies.forEach((body) => {
      body.vx *= velocityScale;
      body.vy *= velocityScale;
      body.vz *= velocityScale;
    });
    return bodies;
  }

  private createMagneticParticles3D(): VisualBody3D[] {
    const { magnetic3dCount, magnetic3dPitch, magnetic3dField } = this.controls();
    const count = Math.round(magnetic3dCount);
    const pitch = (magnetic3dPitch * Math.PI) / 180;
    const perpendicularSpeed = Math.sin(pitch);
    const fieldDirection = magnetic3dField < 0 ? -1 : 1;
    const parallelSpeed = fieldDirection * Math.cos(pitch);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    return Array.from({ length: count }, (_, index) => {
      const phase = index * goldenAngle;
      return {
        x: 0.06 * Math.cos(phase),
        y: 0.06 * Math.sin(phase),
        z: -1.7 + (3.4 * index) / Math.max(1, count - 1),
        vx: perpendicularSpeed * Math.cos(phase),
        vy: perpendicularSpeed * Math.sin(phase),
        vz: parallelSpeed * (0.72 + 0.28 * (((index + 1) * 0.61803398875) % 1)),
        mass: 1,
        color: `hsl(${165 + (index / count) * 150}, 88%, 70%)`,
        radius: 3,
        trail: [],
      };
    });
  }

  private initializeSpringChain(): void {
    const { springCount, springMode, springAmplitude } = this.controls();
    const count = Math.round(springCount);
    const mode = Math.max(1, Math.min(count, Math.round(springMode)));
    this.springDisplacements = new Float64Array(count);
    this.springVelocities = new Float64Array(count);
    for (let index = 0; index < count; index++)
      this.springDisplacements[index] =
        springAmplitude * Math.sin((mode * Math.PI * (index + 1)) / (count + 1));
    this.springHistory = [
      { time: 0, value: this.springDisplacements[Math.floor((count - 1) / 2)] },
    ];
  }
  private initializeEpidemic(): void {
    const { epidemicDensity, initialInfected, epidemicExponent, epidemicRadius } = this.controls();
    this.epidemicGrid.fill(0);
    this.epidemicNext.fill(0);
    this.epidemicTick = 0;
    this.epidemicAccumulator = 0;
    this.epidemicNewInfections = 0;
    this.epidemicKernel = [];
    this.epidemicKernelNormalization = 0;

    const radius = Math.round(epidemicRadius);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const distance = Math.hypot(dx, dy);
        if (distance === 0 || distance > radius) continue;
        const weight = epidemicExponent === 0 ? 1 : distance ** -epidemicExponent;
        this.epidemicKernel.push({ dx, dy, weight });
        this.epidemicKernelNormalization += weight;
      }
    }

    const centerX = Math.floor(this.fieldWidth / 2);
    const centerY = Math.floor(this.fieldHeight / 2);
    const sites = Array.from({ length: this.epidemicGrid.length }, (_, index) => index);
    sites.sort(
      (first, second) =>
        this.deterministicRandom(first, 0, 1) - this.deterministicRandom(second, 0, 1),
    );
    const occupiedCount = Math.max(1, Math.round(epidemicDensity * sites.length));
    const occupied = sites.slice(0, occupiedCount);
    occupied.forEach((index) => (this.epidemicGrid[index] = 1));
    occupied.sort((first, second) => {
      const firstX = first % this.fieldWidth;
      const firstY = Math.floor(first / this.fieldWidth);
      const secondX = second % this.fieldWidth;
      const secondY = Math.floor(second / this.fieldWidth);
      const firstDistance = (firstX - centerX) ** 2 + (firstY - centerY) ** 2;
      const secondDistance = (secondX - centerX) ** 2 + (secondY - centerY) ** 2;
      return (
        firstDistance -
        secondDistance +
        0.1 * (this.deterministicRandom(first, 0, 2) - this.deterministicRandom(second, 0, 2))
      );
    });
    const infectedCount = Math.min(
      occupiedCount,
      Math.max(1, Math.round(initialInfected * occupiedCount)),
    );
    occupied.slice(0, infectedCount).forEach((index) => (this.epidemicGrid[index] = 2));
    this.epidemicHistory = [this.epidemicSnapshot(0)];
  }

  private deterministicRandom(index: number, tick: number, channel: number): number {
    const value =
      Math.sin((index + 1) * 12.9898 + (tick + 1) * 78.233 + channel * 37.719) * 43758.5453;
    return value - Math.floor(value);
  }

  private collisionPermutation(count: number, tick: number, channel: number): number[] {
    const indices = Array.from({ length: count }, (_, index) => index);
    for (let index = count - 1; index > 0; index--) {
      const swapIndex = Math.floor(this.deterministicRandom(index, tick, channel) * (index + 1));
      [indices[index], indices[swapIndex]] = [indices[swapIndex], indices[index]];
    }
    return indices;
  }

  private applyFieldCollisions(timeStep: number): void {
    const collisionRate = this.controls().fieldCollisionRate;
    const tick = this.fieldCollisionTick++;
    if (collisionRate <= 0 || this.particles.length < 2) return;
    const collisionProbability = 1 - Math.exp(-collisionRate * timeStep);
    const pairing = this.collisionPermutation(this.particles.length, tick, 11);
    for (let pair = 0; pair + 1 < pairing.length; pair += 2) {
      if (this.deterministicRandom(pair, tick, 12) >= collisionProbability) continue;
      const angle = 2 * Math.PI * this.deterministicRandom(pair, tick, 13);
      scatterEqualMassPair2D(
        this.particles[pairing[pair]],
        this.particles[pairing[pair + 1]],
        angle,
      );
    }
  }

  private applyMagneticCollisions(timeStep: number): void {
    const collisionRate = this.controls().magnetic3dCollisionRate;
    const tick = this.magneticCollisionTick++;
    if (collisionRate <= 0 || this.magneticParticles3D.length < 2) return;
    const collisionProbability = 1 - Math.exp(-collisionRate * timeStep);
    const pairing = this.collisionPermutation(this.magneticParticles3D.length, tick, 21);
    for (let pair = 0; pair + 1 < pairing.length; pair += 2) {
      if (this.deterministicRandom(pair, tick, 22) >= collisionProbability) continue;
      const cosine = 2 * this.deterministicRandom(pair, tick, 23) - 1;
      const azimuth = 2 * Math.PI * this.deterministicRandom(pair, tick, 24);
      const sine = Math.sqrt(Math.max(0, 1 - cosine ** 2));
      scatterEqualMassPair3D(
        this.magneticParticles3D[pairing[pair]],
        this.magneticParticles3D[pairing[pair + 1]],
        [sine * Math.cos(azimuth), sine * Math.sin(azimuth), cosine],
      );
    }
  }

  private epidemicSnapshot(incidence: number): EpidemicPoint {
    let susceptible = 0;
    let infected = 0;
    let recovered = 0;
    for (const state of this.epidemicGrid) {
      if (state === 1) susceptible++;
      else if (state === 2) infected++;
      else if (state === 3) recovered++;
    }
    const occupied = Math.max(1, susceptible + infected + recovered);
    return {
      time: this.simulationTime,
      susceptible: susceptible / occupied,
      infected: infected / occupied,
      recovered: recovered / occupied,
      incidence: incidence / occupied,
    };
  }

  private stepSpatialEpidemic(): void {
    const { epidemicBeta, epidemicGamma, epidemicStep } = this.controls();
    const recoveryProbability = 1 - Math.exp(-epidemicGamma * epidemicStep);
    this.epidemicNext.set(this.epidemicGrid);
    let newInfections = 0;

    for (let y = 0; y < this.fieldHeight; y++) {
      for (let x = 0; x < this.fieldWidth; x++) {
        const index = y * this.fieldWidth + x;
        const state = this.epidemicGrid[index];
        if (state === 2) {
          if (this.deterministicRandom(index, this.epidemicTick, 3) < recoveryProbability)
            this.epidemicNext[index] = 3;
          continue;
        }
        if (state !== 1) continue;

        let infectiousPressure = 0;
        for (const neighbor of this.epidemicKernel) {
          const neighborX = x + neighbor.dx;
          const neighborY = y + neighbor.dy;
          if (
            neighborX < 0 ||
            neighborX >= this.fieldWidth ||
            neighborY < 0 ||
            neighborY >= this.fieldHeight
          )
            continue;
          if (this.epidemicGrid[neighborY * this.fieldWidth + neighborX] === 2)
            infectiousPressure += neighbor.weight;
        }
        const normalizedPressure = infectiousPressure / this.epidemicKernelNormalization;
        const infectionProbability =
          1 - Math.exp(-epidemicBeta * epidemicStep * normalizedPressure);
        if (this.deterministicRandom(index, this.epidemicTick, 4) < infectionProbability) {
          this.epidemicNext[index] = 2;
          newInfections++;
        }
      }
    }

    [this.epidemicGrid, this.epidemicNext] = [this.epidemicNext, this.epidemicGrid];
    this.epidemicTick++;
    this.epidemicNewInfections = newInfections;
    this.simulationTime += epidemicStep;
    this.epidemicHistory.push(this.epidemicSnapshot(newInfections));
    if (this.epidemicHistory.length > 360) this.epidemicHistory.shift();
  }
  private createDoublePendulum(): DoublePendulumState {
    return {
      angle1: this.controls().doubleInitialAngle,
      angle2: this.controls().doubleInitialAngle * 0.53,
      angularVelocity1: 0,
      angularVelocity2: 0,
    };
  }
  private initializeReactionDiffusion(): void {
    this.reactionU.fill(1);
    this.reactionV.fill(0);
    for (let y = 0; y < this.fieldHeight; y++) {
      for (let x = 0; x < this.fieldWidth; x++) {
        const firstSpot = Math.hypot(x - this.fieldWidth * 0.43, y - this.fieldHeight * 0.5) < 7;
        const secondSpot = Math.hypot(x - this.fieldWidth * 0.61, y - this.fieldHeight * 0.42) < 5;
        if (firstSpot || secondSpot) {
          const index = y * this.fieldWidth + x;
          const perturbation = 0.025 * Math.sin(x * 12.9898 + y * 78.233);
          this.reactionU[index] = 0.5 + perturbation;
          this.reactionV[index] = 0.25 - perturbation;
        }
      }
    }
  }
  private initializeQuantumState(): void {
    const { quantumMomentum, quantumPacketWidth, quantumBarrierHeight, quantumBarrierWidth } =
      this.controls();
    const center = -5;
    for (let index = 0; index < this.quantumPoints; index++) {
      const x = this.quantumMinimum + index * this.quantumSpatialStep;
      const envelope = Math.exp(-((x - center) ** 2) / (4 * quantumPacketWidth ** 2));
      this.quantumReal[index] = envelope * Math.cos(quantumMomentum * x);
      this.quantumImaginary[index] = envelope * Math.sin(quantumMomentum * x);
      this.quantumPotential[index] =
        Math.abs(x) <= quantumBarrierWidth / 2 ? quantumBarrierHeight : 0;
    }
    this.quantumReal[0] = 0;
    this.quantumImaginary[0] = 0;
    this.quantumReal[this.quantumPoints - 1] = 0;
    this.quantumImaginary[this.quantumPoints - 1] = 0;
    const normalization = 1 / Math.sqrt(this.quantumNorm());
    for (let index = 0; index < this.quantumPoints; index++) {
      this.quantumReal[index] *= normalization;
      this.quantumImaginary[index] *= normalization;
    }
    this.quantumInitialNorm = this.quantumNorm();
  }
  private animate(time: number): void {
    const delta = Math.min((time - this.lastFrame) / 16.667, 2);
    this.lastFrame = time;
    this.frames++;
    if (time - this.lastFpsUpdate > 600) {
      this.fps.set(Math.round((this.frames * 1000) / (time - this.lastFpsUpdate || 1)));
      this.frames = 0;
      this.lastFpsUpdate = time;
    }
    if (this.running()) this.elapsed += delta * this.speed();
    this.draw(delta * this.speed());
    this.animationFrame = requestAnimationFrame((next) => this.animate(next));
  }
  private draw(delta: number): void {
    const context = this.context;
    if (!context) return;
    context.clearRect(0, 0, this.width, this.height);
    this.drawAtmosphere(context);
    if (this.selectedScenario() === 'orbit') this.drawOrbit(context, delta);
    if (this.selectedScenario() === 'field') this.drawField(context, delta);
    if (this.selectedScenario() === 'pendulum') this.drawPendulums(context, delta);
    if (this.selectedScenario() === 'powerLaw') this.drawPowerLaw(context, delta);
    if (this.selectedScenario() === 'threeBody') this.drawThreeBody(context, delta);
    if (this.selectedScenario() === 'nBody') this.drawNBody(context, delta);
    if (this.selectedScenario() === 'epidemic') this.drawEpidemic(context, delta);
    if (this.selectedScenario() === 'reaction') this.drawReactionDiffusion(context, delta);
    if (this.selectedScenario() === 'doublePendulum') this.drawDoublePendulum(context, delta);
    if (this.selectedScenario() === 'wave') this.drawWave(context, delta);
    if (this.selectedScenario() === 'quantum') this.drawQuantum(context, delta);
    if (this.selectedScenario() === 'lorenz3d') this.drawLorenz3D(context, delta);
    if (this.selectedScenario() === 'gravity3d') this.drawGravity3D(context, delta);
    if (this.selectedScenario() === 'magnetic3d') this.drawMagnetic3D(context, delta);
    if (this.selectedScenario() === 'springChain') this.drawSpringChain(context, delta);
    if (this.selectedScenario() === 'duffing') this.drawDuffing(context, delta);
  }
  private drawAtmosphere(context: CanvasRenderingContext2D): void {
    const gradient = context.createRadialGradient(
      this.width * 0.52,
      this.height * 0.46,
      20,
      this.width * 0.52,
      this.height * 0.46,
      Math.max(this.width, this.height) * 0.75,
    );
    gradient.addColorStop(0, 'rgba(78, 84, 165, .15)');
    gradient.addColorStop(1, 'rgba(7, 10, 24, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, this.width, this.height);
    context.strokeStyle = 'rgba(255,255,255,.035)';
    for (let x = 24; x < this.width; x += 48) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, this.height);
      context.stroke();
    }
    for (let y = 24; y < this.height; y += 48) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(this.width, y);
      context.stroke();
    }
  }
  private drawOrbit(context: CanvasRenderingContext2D, delta: number): void {
    const { orbitalStep } = this.controls();
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const scale = Math.min(this.width, this.height) * 0.3;
    if (this.running()) {
      const substeps = Math.max(1, Math.round(delta * 5));
      for (let step = 0; step < substeps; step++) {
        stepNBody(this.orbitBodies, orbitalStep, 1, 0);
        this.simulationTime += orbitalStep;
      }
      this.orbitBodies.forEach((body) => {
        body.trail.push({ x: body.x, y: body.y });
        if (body.trail.length > 520) body.trail.shift();
      });
    }
    context.strokeStyle = 'rgba(232, 239, 255, .22)';
    context.beginPath();
    context.moveTo(centerX - 6, centerY);
    context.lineTo(centerX + 6, centerY);
    context.moveTo(centerX, centerY - 6);
    context.lineTo(centerX, centerY + 6);
    context.stroke();
    for (const body of this.orbitBodies) {
      context.beginPath();
      body.trail.forEach((point, index) => {
        const x = centerX + point.x * scale;
        const y = centerY - point.y * scale;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.strokeStyle = `${body.color}66`;
      context.lineWidth = 1.1;
      context.stroke();
      const x = centerX + body.x * scale;
      const y = centerY - body.y * scale;
      context.fillStyle = body.color;
      context.shadowBlur = 18;
      context.shadowColor = body.color;
      context.beginPath();
      context.arc(x, y, body.radius * Math.cbrt(body.mass), 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
    }
    this.updateInvariantMetric(nBodyEnergy(this.orbitBodies, 1, 0));
  }
  private drawField(context: CanvasRenderingContext2D, delta: number): void {
    const { magneticField, electricField, chargeMassRatio, fieldCollisionRate, fieldStep } =
      this.controls();
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const scale = Math.min(this.width, this.height) * 0.22;
    if (this.running()) {
      const substeps = Math.max(1, Math.round(delta * 4));
      for (let step = 0; step < substeps; step++) {
        this.particles.forEach((particle) => {
          stepBoris(particle, fieldStep, chargeMassRatio, electricField, 0, magneticField);
          if (particle.x < -2) {
            particle.x += 4;
            particle.trail = [];
          } else if (particle.x > 2) {
            particle.x -= 4;
            particle.trail = [];
          }
          if (particle.y < -1.45) {
            particle.y += 2.9;
            particle.trail = [];
          } else if (particle.y > 1.45) {
            particle.y -= 2.9;
            particle.trail = [];
          }
        });
        this.applyFieldCollisions(fieldStep);
        this.simulationTime += fieldStep;
      }
      this.particles.forEach((particle) => {
        particle.trail.push({ x: particle.x, y: particle.y });
        if (particle.trail.length > 28) particle.trail.shift();
      });
    }
    this.particles.forEach((particle) => {
      context.beginPath();
      particle.trail.forEach((point, index) => {
        const x = centerX + point.x * scale;
        const y = centerY - point.y * scale;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.strokeStyle = `hsla(${particle.hue}, 82%, 70%, .2)`;
      context.stroke();
      context.fillStyle = `hsla(${particle.hue}, 85%, 74%, .84)`;
      context.beginPath();
      context.arc(centerX + particle.x * scale, centerY - particle.y * scale, 1.6, 0, Math.PI * 2);
      context.fill();
    });
    const meanKinetic = this.meanKineticEnergy();
    const cyclotronFrequency = Math.abs(chargeMassRatio * magneticField);
    const drift =
      Math.abs(electricField) < Number.EPSILON
        ? ` · |ΔK/K₀| = ${Math.abs((meanKinetic - this.initialInvariant) / this.initialInvariant).toExponential(2)}`
        : '';
    this.metric.set(
      `t = ${this.simulationTime.toFixed(3)} · ⟨K⟩ = ${meanKinetic.toFixed(3)} · ωc = ${cyclotronFrequency.toFixed(2)} · ν = ${fieldCollisionRate.toFixed(2)}${drift}`,
    );
  }
  private drawPendulums(context: CanvasRenderingContext2D, delta: number): void {
    const { pendulumGravity, pendulumStep } = this.controls();
    const count = this.pendulumStates.length;
    const spacing = Math.min(52, (this.width - 80) / Math.max(count - 1, 1));
    const startX = this.width / 2 - ((count - 1) * spacing) / 2;
    const anchorY = Math.max(70, this.height * 0.16);
    const maximumLength = Math.max(...this.pendulumStates.map((pendulum) => pendulum.length));
    if (this.running()) {
      const substeps = Math.max(1, Math.round(delta * 5));
      for (let step = 0; step < substeps; step++) {
        this.pendulumStates.forEach((pendulum) =>
          stepPendulum(pendulum, pendulumStep, pendulumGravity),
        );
        this.simulationTime += pendulumStep;
      }
    }
    context.strokeStyle = 'rgba(232, 239, 255, .34)';
    context.beginPath();
    context.moveTo(startX - 28, anchorY);
    context.lineTo(startX + (count - 1) * spacing + 28, anchorY);
    context.stroke();
    this.pendulumStates.forEach((pendulum, index) => {
      const pixelLength = (pendulum.length / maximumLength) * this.height * 0.59;
      const x = startX + index * spacing;
      const bobX = x + Math.sin(pendulum.angle) * pixelLength;
      const bobY = anchorY + Math.cos(pendulum.angle) * pixelLength;
      context.strokeStyle = `hsla(${pendulum.hue}, 85%, 76%, .43)`;
      context.beginPath();
      context.moveTo(x, anchorY);
      context.lineTo(bobX, bobY);
      context.stroke();
      context.fillStyle = `hsl(${pendulum.hue}, 88%, 74%)`;
      context.shadowBlur = 14;
      context.shadowColor = `hsl(${pendulum.hue}, 88%, 74%)`;
      context.beginPath();
      context.arc(bobX, bobY, 7, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
    });
    this.updateInvariantMetric(this.totalPendulumEnergy());
  }
  private drawPowerLaw(context: CanvasRenderingContext2D, delta: number): void {
    const { powerStrength, powerExponent, powerStep } = this.controls();
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const scale = Math.min(this.width, this.height) * 0.25;

    if (this.running()) {
      const substeps = Math.max(1, Math.round(delta * 4));
      for (let step = 0; step < substeps; step++) {
        stepPowerLaw(this.powerBody, powerStep, powerStrength, powerExponent);
        this.simulationTime += powerStep;
      }
      this.powerBody.trail.push({ x: this.powerBody.x, y: this.powerBody.y });
      if (this.powerBody.trail.length > 600) this.powerBody.trail.shift();
    }

    context.strokeStyle = 'rgba(168, 153, 255, .13)';
    context.lineWidth = 1;
    for (const radius of [0.5, 1, 1.5]) {
      context.beginPath();
      context.arc(centerX, centerY, radius * scale, 0, Math.PI * 2);
      context.stroke();
    }
    const glow = context.createRadialGradient(centerX, centerY, 1, centerX, centerY, 38);
    glow.addColorStop(0, '#f4ddff');
    glow.addColorStop(0.18, '#a899ff');
    glow.addColorStop(1, 'rgba(168,153,255,0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(centerX, centerY, 38, 0, Math.PI * 2);
    context.fill();

    context.beginPath();
    this.powerBody.trail.forEach((point, index) => {
      const x = centerX + point.x * scale;
      const y = centerY - point.y * scale;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.strokeStyle = 'rgba(111, 231, 195, .62)';
    context.lineWidth = 1.3;
    context.stroke();

    const bodyX = centerX + this.powerBody.x * scale;
    const bodyY = centerY - this.powerBody.y * scale;
    context.fillStyle = this.powerBody.color;
    context.shadowBlur = 18;
    context.shadowColor = this.powerBody.color;
    context.beginPath();
    context.arc(bodyX, bodyY, this.powerBody.radius, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;

    const energy = powerLawEnergy(this.powerBody, powerStrength, powerExponent);
    this.updateInvariantMetric(energy);
  }

  private drawThreeBody(context: CanvasRenderingContext2D, delta: number): void {
    const { integrationStep, softening } = this.controls();
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const scale = Math.min(this.width, this.height) * 0.27;

    if (this.running()) {
      const substeps = Math.max(1, Math.round(delta * 5));
      for (let step = 0; step < substeps; step++) {
        stepNBody(this.threeBodies, integrationStep, 1, softening);
        this.simulationTime += integrationStep;
      }
      this.threeBodies.forEach((body) => {
        body.trail.push({ x: body.x, y: body.y });
        if (body.trail.length > 500) body.trail.shift();
      });
    }

    this.threeBodies.forEach((body) => {
      context.beginPath();
      body.trail.forEach((point, index) => {
        const x = centerX + point.x * scale;
        const y = centerY - point.y * scale;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.strokeStyle = `${body.color}72`;
      context.lineWidth = 1.25;
      context.stroke();

      const x = centerX + body.x * scale;
      const y = centerY - body.y * scale;
      const radius = body.radius * Math.cbrt(body.mass);
      context.fillStyle = body.color;
      context.shadowBlur = 18;
      context.shadowColor = body.color;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
    });
    this.updateInvariantMetric(nBodyEnergy(this.threeBodies, 1, softening));
  }

  private drawNBody(context: CanvasRenderingContext2D, delta: number): void {
    const { nBodyStep, nBodySoftening, nBodyScale } = this.controls();
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const scale = (Math.min(this.width, this.height) * 0.13) / nBodyScale;
    if (this.running()) {
      const substeps = Math.max(1, Math.round(delta * (this.nBodies.length > 100 ? 2 : 4)));
      for (let step = 0; step < substeps; step++) {
        stepNBody(this.nBodies, nBodyStep, 1, nBodySoftening);
        this.simulationTime += nBodyStep;
      }
      this.nBodies.forEach((body) => {
        body.trail.push({ x: body.x, y: body.y });
        if (body.trail.length > 80) body.trail.shift();
      });
    }
    context.strokeStyle = 'rgba(232,239,255,.2)';
    context.beginPath();
    context.moveTo(centerX - 6, centerY);
    context.lineTo(centerX + 6, centerY);
    context.moveTo(centerX, centerY - 6);
    context.lineTo(centerX, centerY + 6);
    context.stroke();
    this.nBodies.forEach((body) => {
      context.beginPath();
      body.trail.forEach((point, index) => {
        const x = centerX + point.x * scale;
        const y = centerY - point.y * scale;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.strokeStyle = body.color;
      context.globalAlpha = 0.2;
      context.lineWidth = 0.8;
      context.stroke();
      context.globalAlpha = 1;
      context.fillStyle = body.color;
      context.beginPath();
      context.arc(centerX + body.x * scale, centerY - body.y * scale, body.radius, 0, Math.PI * 2);
      context.fill();
    });
    const kinetic = this.nBodies.reduce((sum, body) => sum + kineticEnergy(body), 0);
    const energy = nBodyEnergy(this.nBodies, 1, nBodySoftening);
    const potential = energy - kinetic;
    const virialRatio = kinetic / Math.max(Math.abs(potential), Number.EPSILON);
    const drift = Math.abs(
      (energy - this.initialInvariant) / Math.max(Math.abs(this.initialInvariant), Number.EPSILON),
    );
    this.metric.set(
      `t = ${this.simulationTime.toFixed(3)} · N = ${this.nBodies.length} · Q = ${virialRatio.toFixed(3)} · |ΔE/E₀| = ${drift.toExponential(2)}`,
    );
  }

  private drawEpidemic(context: CanvasRenderingContext2D, delta: number): void {
    if (this.running()) {
      this.epidemicAccumulator += delta / 4;
      let steps = 0;
      while (this.epidemicAccumulator >= 1 && steps < 3) {
        this.stepSpatialEpidemic();
        this.epidemicAccumulator--;
        steps++;
      }
    }

    const outerPadding = 24;
    const headingHeight = 42;
    const footerHeight = 30;
    const contentHeight = this.height - headingHeight - footerHeight;
    const availableWidth = this.width - outerPadding * 2;
    const mapWidth = Math.min(availableWidth * 0.62, contentHeight * 1.5);
    const mapHeight = Math.min(contentHeight, mapWidth / 1.5);
    const mapX = outerPadding;
    const mapY = headingHeight + (contentHeight - mapHeight) / 2;
    const chartX = mapX + mapWidth + 30;
    const chartWidth = Math.max(120, this.width - chartX - outerPadding);
    const chartTop = mapY + 22;
    const chartBottom = mapY + mapHeight - 28;

    this.drawEpidemicMap(context, mapX, mapY, mapWidth, mapHeight);

    context.fillStyle = '#dbe6ef';
    context.font = '600 11px DM Mono, monospace';
    context.fillText('SPATIAL POPULATION', mapX, 25);
    context.fillText('PREVALENCE', chartX, 25);

    const legend = [
      { label: 'susceptible', color: '#58c9a5' },
      { label: 'infectious', color: '#ff795f' },
      { label: 'recovered', color: '#9c8cff' },
    ];
    let legendX = mapX;
    context.font = '10px DM Mono, monospace';
    for (const item of legend) {
      context.fillStyle = item.color;
      context.fillRect(legendX, mapY + mapHeight + 13, 7, 7);
      context.fillStyle = '#8e9bac';
      context.fillText(item.label, legendX + 12, mapY + mapHeight + 20);
      legendX += context.measureText(item.label).width + 32;
    }

    context.strokeStyle = 'rgba(230,238,255,.11)';
    context.lineWidth = 1;
    for (let division = 0; division <= 4; division++) {
      const y = chartTop + ((chartBottom - chartTop) * division) / 4;
      context.beginPath();
      context.moveTo(chartX, y);
      context.lineTo(chartX + chartWidth, y);
      context.stroke();
      context.fillStyle = '#667386';
      context.font = '9px DM Mono, monospace';
      context.fillText(`${(1 - division / 4).toFixed(2)}`, chartX, y - 4);
    }

    const curves: { key: 'susceptible' | 'infected' | 'recovered'; color: string }[] = [
      { key: 'susceptible', color: '#58c9a5' },
      { key: 'infected', color: '#ff795f' },
      { key: 'recovered', color: '#9c8cff' },
    ];
    const firstTime = this.epidemicHistory[0]?.time ?? 0;
    const finalTime = this.epidemicHistory.at(-1)?.time ?? 1;
    const timeSpan = Math.max(finalTime - firstTime, 1);
    curves.forEach((curve) => {
      context.beginPath();
      this.epidemicHistory.forEach((point, index) => {
        const x = chartX + ((point.time - firstTime) / timeSpan) * chartWidth;
        const y = chartBottom - point[curve.key] * (chartBottom - chartTop);
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.strokeStyle = curve.color;
      context.lineWidth = 1.8;
      context.stroke();
    });

    context.fillStyle = '#8290a3';
    context.font = '9px DM Mono, monospace';
    context.fillText(`t ${firstTime.toFixed(1)}`, chartX, chartBottom + 18);
    const endLabel = `t ${finalTime.toFixed(1)}`;
    context.fillText(
      endLabel,
      chartX + chartWidth - context.measureText(endLabel).width,
      chartBottom + 18,
    );

    const current = this.epidemicHistory.at(-1) ?? this.epidemicSnapshot(0);
    const occupied = this.epidemicGrid.reduce((count, state) => count + Number(state !== 0), 0);
    this.metric.set(
      `t = ${this.simulationTime.toFixed(2)} · N = ${occupied} · S = ${(100 * current.susceptible).toFixed(1)}% · I = ${(100 * current.infected).toFixed(1)}% · new = ${this.epidemicNewInfections}`,
    );
  }

  private drawEpidemicMap(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    if (!this.rasterCanvas || !this.rasterContext) return;
    const image = this.rasterContext.createImageData(this.fieldWidth, this.fieldHeight);
    const colors = [
      [8, 13, 25],
      [88, 201, 165],
      [255, 121, 95],
      [156, 140, 255],
    ];
    for (let index = 0; index < this.epidemicGrid.length; index++) {
      const color = colors[this.epidemicGrid[index]];
      const pixel = index * 4;
      image.data[pixel] = color[0];
      image.data[pixel + 1] = color[1];
      image.data[pixel + 2] = color[2];
      image.data[pixel + 3] = this.epidemicGrid[index] === 0 ? 105 : 245;
    }
    this.rasterContext.putImageData(image, 0, 0);
    context.save();
    context.imageSmoothingEnabled = false;
    context.shadowColor = 'rgba(0,0,0,.4)';
    context.shadowBlur = 18;
    context.drawImage(this.rasterCanvas, x, y, width, height);
    context.restore();
    context.strokeStyle = 'rgba(225,237,255,.16)';
    context.strokeRect(x - 0.5, y - 0.5, width + 1, height + 1);
  }

  private drawReactionDiffusion(context: CanvasRenderingContext2D, delta: number): void {
    const { reactionFeed, reactionKill, reactionDiffU, reactionDiffV, reactionStep } =
      this.controls();
    if (this.running()) {
      const substeps = Math.max(1, Math.round(delta * 3));
      for (let step = 0; step < substeps; step++) {
        for (let y = 0; y < this.fieldHeight; y++) {
          const up = (y + this.fieldHeight - 1) % this.fieldHeight;
          const down = (y + 1) % this.fieldHeight;
          for (let x = 0; x < this.fieldWidth; x++) {
            const left = (x + this.fieldWidth - 1) % this.fieldWidth;
            const right = (x + 1) % this.fieldWidth;
            const index = y * this.fieldWidth + x;
            const u = this.reactionU[index];
            const v = this.reactionV[index];
            const lapU =
              this.reactionU[y * this.fieldWidth + left] +
              this.reactionU[y * this.fieldWidth + right] +
              this.reactionU[up * this.fieldWidth + x] +
              this.reactionU[down * this.fieldWidth + x] -
              4 * u;
            const lapV =
              this.reactionV[y * this.fieldWidth + left] +
              this.reactionV[y * this.fieldWidth + right] +
              this.reactionV[up * this.fieldWidth + x] +
              this.reactionV[down * this.fieldWidth + x] -
              4 * v;
            const reaction = u * v * v;
            this.reactionNextU[index] = Math.max(
              0,
              Math.min(
                1,
                u + (reactionDiffU * lapU - reaction + reactionFeed * (1 - u)) * reactionStep,
              ),
            );
            this.reactionNextV[index] = Math.max(
              0,
              Math.min(
                1,
                v +
                  (reactionDiffV * lapV + reaction - (reactionFeed + reactionKill) * v) *
                    reactionStep,
              ),
            );
          }
        }
        [this.reactionU, this.reactionNextU] = [this.reactionNextU, this.reactionU];
        [this.reactionV, this.reactionNextV] = [this.reactionNextV, this.reactionV];
        this.simulationTime += reactionStep;
      }
    }
    this.renderRaster(context, 'reaction');
    let mean = 0;
    let squared = 0;
    this.reactionV.forEach((value) => {
      mean += value;
      squared += value * value;
    });
    mean /= this.reactionV.length;
    const variance = squared / this.reactionV.length - mean ** 2;
    const diffusionNumber = 4 * Math.max(reactionDiffU, reactionDiffV) * reactionStep;
    this.metric.set(
      `t = ${this.simulationTime.toFixed(0)} · ⟨v⟩ = ${mean.toFixed(4)} · Var(v) = ${variance.toExponential(2)} · λ = ${diffusionNumber.toFixed(2)} ≤ 1`,
    );
  }

  private drawDoublePendulum(context: CanvasRenderingContext2D, delta: number): void {
    const { doubleMassRatio, doubleLengthRatio, doubleGravity, doubleStep } = this.controls();
    if (this.running()) {
      const substeps = Math.max(1, Math.round(delta * 5));
      for (let step = 0; step < substeps; step++) {
        stepDoublePendulum(
          this.doublePendulum,
          doubleStep,
          doubleMassRatio,
          doubleLengthRatio,
          doubleGravity,
        );
        this.simulationTime += doubleStep;
      }
    }
    const anchorX = this.width / 2;
    const anchorY = this.height * 0.2;
    const scale = (this.height * 0.3) / Math.max(1, doubleLengthRatio);
    const firstX = anchorX + Math.sin(this.doublePendulum.angle1) * scale;
    const firstY = anchorY + Math.cos(this.doublePendulum.angle1) * scale;
    const secondX = firstX + Math.sin(this.doublePendulum.angle2) * scale * doubleLengthRatio;
    const secondY = firstY + Math.cos(this.doublePendulum.angle2) * scale * doubleLengthRatio;
    if (this.running()) {
      this.doubleTrail.push({ x: secondX, y: secondY });
      if (this.doubleTrail.length > 700) this.doubleTrail.shift();
    }
    context.beginPath();
    this.doubleTrail.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.strokeStyle = 'rgba(112,231,196,.52)';
    context.lineWidth = 1.2;
    context.stroke();
    context.strokeStyle = 'rgba(232,239,255,.48)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(anchorX, anchorY);
    context.lineTo(firstX, firstY);
    context.lineTo(secondX, secondY);
    context.stroke();
    [
      { x: firstX, y: firstY, radius: 8, color: '#a899ff' },
      { x: secondX, y: secondY, radius: 10 * Math.cbrt(doubleMassRatio), color: '#70e7c4' },
    ].forEach((bob) => {
      context.fillStyle = bob.color;
      context.shadowBlur = 18;
      context.shadowColor = bob.color;
      context.beginPath();
      context.arc(bob.x, bob.y, bob.radius, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
    });
    this.updateInvariantMetric(
      doublePendulumEnergy(this.doublePendulum, doubleMassRatio, doubleLengthRatio, doubleGravity),
    );
  }

  private drawWave(context: CanvasRenderingContext2D, delta: number): void {
    const { waveCfl, waveFrequency, waveDamping, waveSeparation } = this.controls();
    if (this.running()) {
      const substeps = Math.max(1, Math.round(delta * 3));
      for (let step = 0; step < substeps; step++) {
        this.waveNext.fill(0);
        for (let y = 1; y < this.fieldHeight - 1; y++) {
          for (let x = 1; x < this.fieldWidth - 1; x++) {
            const index = y * this.fieldWidth + x;
            const laplacian =
              this.waveCurrent[index - 1] +
              this.waveCurrent[index + 1] +
              this.waveCurrent[index - this.fieldWidth] +
              this.waveCurrent[index + this.fieldWidth] -
              4 * this.waveCurrent[index];
            this.waveNext[index] =
              (2 - waveDamping) * this.waveCurrent[index] -
              (1 - waveDamping) * this.wavePrevious[index] +
              waveCfl ** 2 * laplacian;
          }
        }
        this.simulationTime += this.waveTimeStep;
        const source = Math.sin(2 * Math.PI * waveFrequency * this.simulationTime);
        const center = Math.floor(this.fieldWidth / 2);
        const sourceY = Math.floor(this.fieldHeight / 2);
        const halfSeparation = Math.round(waveSeparation / 2);
        this.waveNext[sourceY * this.fieldWidth + center - halfSeparation] = source;
        this.waveNext[sourceY * this.fieldWidth + center + halfSeparation] = source;
        [this.wavePrevious, this.waveCurrent, this.waveNext] = [
          this.waveCurrent,
          this.waveNext,
          this.wavePrevious,
        ];
      }
    }
    this.renderRaster(context, 'wave');
    const rms = Math.sqrt(
      this.waveCurrent.reduce((sum, value) => sum + value * value, 0) / this.waveCurrent.length,
    );
    this.metric.set(
      `t = ${this.simulationTime.toFixed(2)} · CFL = ${waveCfl.toFixed(2)} ≤ 0.707 · RMS = ${rms.toFixed(3)}`,
    );
  }

  private drawQuantum(context: CanvasRenderingContext2D, delta: number): void {
    const { quantumMomentum, quantumBarrierHeight, quantumBarrierWidth, quantumStep } =
      this.controls();
    if (this.running()) {
      const substeps = Math.max(1, Math.round(delta * 3));
      for (let step = 0; step < substeps; step++) {
        stepSchrodingerCrankNicolson(
          this.quantumReal,
          this.quantumImaginary,
          this.quantumPotential,
          this.quantumSpatialStep,
          quantumStep,
        );
        this.simulationTime += quantumStep;
      }
    }

    const left = 34;
    const right = this.width - 24;
    const top = 38;
    const bottom = this.height - 65;
    const plotWidth = right - left;
    const mapX = (x: number): number =>
      left + ((x - this.quantumMinimum) / (this.quantumMaximum - this.quantumMinimum)) * plotWidth;
    let maximumDensity = 0;
    for (let index = 0; index < this.quantumPoints; index++) {
      maximumDensity = Math.max(
        maximumDensity,
        this.quantumReal[index] ** 2 + this.quantumImaginary[index] ** 2,
      );
    }

    const barrierLeft = mapX(-quantumBarrierWidth / 2);
    const barrierRight = mapX(quantumBarrierWidth / 2);
    const energyScale = Math.max(quantumBarrierHeight, quantumMomentum ** 2 / 2, 1);
    const barrierHeight = (quantumBarrierHeight / energyScale) * (bottom - top) * 0.45;
    context.fillStyle = 'rgba(168,153,255,.15)';
    context.fillRect(
      barrierLeft,
      bottom - barrierHeight,
      barrierRight - barrierLeft,
      barrierHeight,
    );
    context.strokeStyle = 'rgba(168,153,255,.65)';
    context.strokeRect(
      barrierLeft,
      bottom - barrierHeight,
      barrierRight - barrierLeft,
      barrierHeight,
    );
    context.fillStyle = '#a899ff';
    context.font = '10px DM Mono, monospace';
    context.fillText(
      `V₀ = ${quantumBarrierHeight.toFixed(1)}`,
      barrierLeft + 6,
      bottom - barrierHeight - 8,
    );

    const densityGradient = context.createLinearGradient(0, top, 0, bottom);
    densityGradient.addColorStop(0, 'rgba(111,231,195,.44)');
    densityGradient.addColorStop(1, 'rgba(111,231,195,.03)');
    context.beginPath();
    context.moveTo(left, bottom);
    for (let index = 0; index < this.quantumPoints; index++) {
      const x = this.quantumMinimum + index * this.quantumSpatialStep;
      const density = this.quantumReal[index] ** 2 + this.quantumImaginary[index] ** 2;
      const y = bottom - (density / Math.max(maximumDensity, 1e-12)) * (bottom - top) * 0.72;
      context.lineTo(mapX(x), y);
    }
    context.lineTo(right, bottom);
    context.closePath();
    context.fillStyle = densityGradient;
    context.fill();
    context.beginPath();
    for (let index = 0; index < this.quantumPoints; index++) {
      const x = this.quantumMinimum + index * this.quantumSpatialStep;
      const density = this.quantumReal[index] ** 2 + this.quantumImaginary[index] ** 2;
      const y = bottom - (density / Math.max(maximumDensity, 1e-12)) * (bottom - top) * 0.72;
      if (index === 0) context.moveTo(mapX(x), y);
      else context.lineTo(mapX(x), y);
    }
    context.strokeStyle = '#70e7c4';
    context.lineWidth = 2;
    context.stroke();

    const phaseAxis = bottom + 24;
    const phaseScale = 18 / Math.sqrt(Math.max(maximumDensity, 1e-12));
    const drawPhase = (values: Float64Array, color: string): void => {
      context.beginPath();
      values.forEach((value, index) => {
        const x = this.quantumMinimum + index * this.quantumSpatialStep;
        const y = phaseAxis - value * phaseScale;
        if (index === 0) context.moveTo(mapX(x), y);
        else context.lineTo(mapX(x), y);
      });
      context.strokeStyle = color;
      context.lineWidth = 1;
      context.stroke();
    };
    drawPhase(this.quantumReal, 'rgba(168,153,255,.76)');
    drawPhase(this.quantumImaginary, 'rgba(245,191,111,.72)');

    let probabilityLeft = 0;
    let probabilityRight = 0;
    let expectedPosition = 0;
    for (let index = 0; index < this.quantumPoints; index++) {
      const x = this.quantumMinimum + index * this.quantumSpatialStep;
      const probability =
        (this.quantumReal[index] ** 2 + this.quantumImaginary[index] ** 2) *
        this.quantumSpatialStep;
      if (x < -quantumBarrierWidth / 2) probabilityLeft += probability;
      if (x > quantumBarrierWidth / 2) probabilityRight += probability;
      expectedPosition += x * probability;
    }
    const norm = this.quantumNorm();
    this.metric.set(
      `t = ${this.simulationTime.toFixed(3)} · Pₗ = ${probabilityLeft.toFixed(3)} · Pᵣ = ${probabilityRight.toFixed(3)} · |ΔP| = ${Math.abs(norm - this.quantumInitialNorm).toExponential(1)} · ⟨x⟩ = ${expectedPosition.toFixed(2)}`,
    );
  }

  private drawLorenz3D(context: CanvasRenderingContext2D, delta: number): void {
    const { lorenzSigma, lorenzRho, lorenzBeta, lorenzStep } = this.controls();
    if (this.running()) {
      const substeps = Math.max(1, Math.round(delta * 10));
      for (let step = 0; step < substeps; step++) {
        stepLorenz(this.lorenzState, lorenzStep, lorenzSigma, lorenzRho, lorenzBeta);
        this.simulationTime += lorenzStep;
        this.lorenzTrail.push({
          x: this.lorenzState.x / 18,
          y: (this.lorenzState.z - 25) / 18,
          z: this.lorenzState.y / 18,
        });
      }
      if (this.lorenzTrail.length > 2800)
        this.lorenzTrail.splice(0, this.lorenzTrail.length - 2800);
    }
    this.draw3DReference(context, 1.75);
    context.beginPath();
    this.lorenzTrail.forEach((point, index) => {
      const projected = this.project3D(point);
      if (index === 0) context.moveTo(projected.x, projected.y);
      else context.lineTo(projected.x, projected.y);
    });
    const gradient = context.createLinearGradient(0, this.height * 0.2, 0, this.height * 0.8);
    gradient.addColorStop(0, '#a899ff');
    gradient.addColorStop(0.55, '#70e7c4');
    gradient.addColorStop(1, '#f5bf6f');
    context.strokeStyle = gradient;
    context.lineWidth = 1.45;
    context.stroke();
    const current = this.lorenzTrail.at(-1);
    if (current) this.drawProjectedParticle(context, current, '#f5bf6f', 5);
    const divergence = -(lorenzSigma + 1 + lorenzBeta);
    this.metric.set(
      `t = ${this.simulationTime.toFixed(2)} · x = ${this.lorenzState.x.toFixed(2)} · y = ${this.lorenzState.y.toFixed(2)} · z = ${this.lorenzState.z.toFixed(2)} · ∇·f = ${divergence.toFixed(2)}`,
    );
  }

  private drawGravity3D(context: CanvasRenderingContext2D, delta: number): void {
    const { gravity3dSoftening, gravity3dStep } = this.controls();
    if (this.running()) {
      const substeps = Math.max(1, Math.round(delta * 4));
      for (let step = 0; step < substeps; step++) {
        stepNBody3D(this.gravityBodies3D, gravity3dStep, 1, gravity3dSoftening);
        this.simulationTime += gravity3dStep;
      }
      this.gravityBodies3D.forEach((body) => {
        body.trail.push({ x: body.x, y: body.y, z: body.z });
        if (body.trail.length > 90) body.trail.shift();
      });
    }
    this.draw3DReference(context, 1.9);
    this.draw3DBodies(context, this.gravityBodies3D, 0.9);
    const energy = nBodyEnergy3D(this.gravityBodies3D, 1, gravity3dSoftening);
    const kinetic = this.gravityBodies3D.reduce(
      (sum, body) => sum + 0.5 * body.mass * (body.vx ** 2 + body.vy ** 2 + body.vz ** 2),
      0,
    );
    const potential = energy - kinetic;
    const virial = kinetic / Math.max(Math.abs(potential), Number.EPSILON);
    const drift = Math.abs(
      (energy - this.initialInvariant) / Math.max(Math.abs(this.initialInvariant), Number.EPSILON),
    );
    this.metric.set(
      `t = ${this.simulationTime.toFixed(3)} · N = ${this.gravityBodies3D.length} · Q = ${virial.toFixed(3)} · |ΔE/E₀| = ${drift.toExponential(2)}`,
    );
  }

  private drawMagnetic3D(context: CanvasRenderingContext2D, delta: number): void {
    const {
      magnetic3dField,
      magnetic3dElectric,
      magnetic3dCollisionRate,
      magnetic3dStep,
      magnetic3dPitch,
    } = this.controls();
    if (this.running()) {
      const substeps = Math.max(1, Math.round(delta * 5));
      for (let step = 0; step < substeps; step++) {
        this.magneticParticles3D.forEach((particle) => {
          stepBoris3D(
            particle,
            magnetic3dStep,
            1,
            [0, 0, magnetic3dElectric],
            [0, 0, magnetic3dField],
          );
          const extent = 2.3;
          let wrapped = false;
          if (particle.x < -extent) {
            particle.x += 2 * extent;
            wrapped = true;
          } else if (particle.x > extent) {
            particle.x -= 2 * extent;
            wrapped = true;
          }
          if (particle.y < -extent) {
            particle.y += 2 * extent;
            wrapped = true;
          } else if (particle.y > extent) {
            particle.y -= 2 * extent;
            wrapped = true;
          }
          if (particle.z < -extent) {
            particle.z += 2 * extent;
            wrapped = true;
          } else if (particle.z > extent) {
            particle.z -= 2 * extent;
            wrapped = true;
          }
          if (wrapped) particle.trail = [];
          particle.trail.push({ x: particle.x, y: particle.y, z: particle.z });
          if (particle.trail.length > 180) particle.trail.shift();
        });
        this.applyMagneticCollisions(magnetic3dStep);
        this.simulationTime += magnetic3dStep;
      }
    }
    this.draw3DReference(context, 2.3);
    this.drawVector3D(context, { x: 0, y: 0, z: -2.1 }, { x: 0, y: 0, z: 2.1 }, '#a899ff');
    this.draw3DBodies(context, this.magneticParticles3D, 0.75);
    const meanSpeed =
      this.magneticParticles3D.reduce(
        (sum, particle) => sum + Math.hypot(particle.vx, particle.vy, particle.vz),
        0,
      ) / Math.max(1, this.magneticParticles3D.length);
    const meanKinetic = this.meanKineticEnergy3D(this.magneticParticles3D);
    const perpendicularSpeed = Math.sin((magnetic3dPitch * Math.PI) / 180);
    const gyroRadius =
      Math.abs(magnetic3dField) < 1e-12
        ? '∞ (Bz = 0)'
        : (perpendicularSpeed / Math.abs(magnetic3dField)).toFixed(3);
    const energyDiagnostic =
      Math.abs(magnetic3dElectric) < Number.EPSILON
        ? ` · |ΔK/K₀| = ${Math.abs((meanKinetic - this.initialInvariant) / this.initialInvariant).toExponential(2)}`
        : '';
    this.metric.set(
      `t = ${this.simulationTime.toFixed(3)} · ⟨|v|⟩ = ${meanSpeed.toFixed(3)} · ωc = ${Math.abs(magnetic3dField).toFixed(2)} · ν = ${magnetic3dCollisionRate.toFixed(2)} · rL = ${gyroRadius}${energyDiagnostic}`,
    );
  }

  private drawSpringChain(context: CanvasRenderingContext2D, delta: number): void {
    const { springConstant, springMass, springMode, springAmplitude, springStep } = this.controls();
    if (this.running()) {
      const substeps = Math.max(1, Math.round(delta * 6));
      for (let step = 0; step < substeps; step++) {
        stepSpringChain(
          this.springDisplacements,
          this.springVelocities,
          springStep,
          springConstant,
          springMass,
        );
        this.simulationTime += springStep;
      }
      const probe = this.springDisplacements[Math.floor((this.springDisplacements.length - 1) / 2)];
      this.springHistory.push({ time: this.simulationTime, value: probe });
      if (this.springHistory.length > 620) this.springHistory.shift();
    }

    const left = 34;
    const right = this.width - 34;
    const equilibriumY = this.height * 0.34;
    const displacementScale = (this.height * 0.17) / Math.max(springAmplitude, 0.1);
    const spacing = (right - left) / (this.springDisplacements.length + 1);
    context.strokeStyle = 'rgba(226,236,255,.18)';
    context.setLineDash([4, 7]);
    context.beginPath();
    context.moveTo(left, equilibriumY);
    context.lineTo(right, equilibriumY);
    context.stroke();
    context.setLineDash([]);

    const points = [
      { x: left, y: equilibriumY },
      ...Array.from(this.springDisplacements, (value, index) => ({
        x: left + (index + 1) * spacing,
        y: equilibriumY - value * displacementScale,
      })),
      { x: right, y: equilibriumY },
    ];
    for (let index = 0; index < points.length - 1; index++)
      this.drawCoil(context, points[index], points[index + 1], 5, 'rgba(168,153,255,.58)');

    context.fillStyle = '#4c5870';
    context.fillRect(left - 4, equilibriumY - 22, 4, 44);
    context.fillRect(right, equilibriumY - 22, 4, 44);
    points.slice(1, -1).forEach((point, index) => {
      const normalized = this.springDisplacements[index] / Math.max(springAmplitude, 0.1);
      context.fillStyle = normalized >= 0 ? '#70e7c4' : '#f5bf6f';
      context.shadowColor = context.fillStyle;
      context.shadowBlur = 10;
      context.beginPath();
      context.arc(point.x, point.y, 5.5, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
    });

    const plotLeft = 42;
    const plotRight = this.width - 28;
    const plotTop = this.height * 0.66;
    const plotBottom = this.height - 42;
    context.strokeStyle = 'rgba(226,236,255,.12)';
    context.beginPath();
    context.moveTo(plotLeft, (plotTop + plotBottom) / 2);
    context.lineTo(plotRight, (plotTop + plotBottom) / 2);
    context.stroke();
    const firstTime = this.springHistory[0]?.time ?? 0;
    const finalTime = this.springHistory.at(-1)?.time ?? 1;
    const timeSpan = Math.max(finalTime - firstTime, springStep);
    context.beginPath();
    this.springHistory.forEach((point, index) => {
      const x = plotLeft + ((point.time - firstTime) / timeSpan) * (plotRight - plotLeft);
      const y =
        (plotTop + plotBottom) / 2 -
        (point.value / Math.max(springAmplitude, 0.1)) * ((plotBottom - plotTop) * 0.45);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.strokeStyle = '#70e7c4';
    context.lineWidth = 1.5;
    context.stroke();
    context.fillStyle = '#8290a3';
    context.font = '10px DM Mono, monospace';
    context.fillText('center-mass displacement', plotLeft, plotTop - 12);

    const count = this.springDisplacements.length;
    const mode = Math.max(1, Math.min(count, Math.round(springMode)));
    const angularFrequency =
      2 * Math.sqrt(springConstant / springMass) * Math.sin((mode * Math.PI) / (2 * (count + 1)));
    const energy = springChainEnergy(
      this.springDisplacements,
      this.springVelocities,
      springConstant,
      springMass,
    );
    const drift = Math.abs(
      (energy - this.initialInvariant) / Math.max(Math.abs(this.initialInvariant), Number.EPSILON),
    );
    this.metric.set(
      `t = ${this.simulationTime.toFixed(3)} · p = ${mode} · ωₚ = ${angularFrequency.toFixed(4)} · E = ${energy.toFixed(4)} · |ΔE/E₀| = ${drift.toExponential(2)}`,
    );
  }

  private drawDuffing(context: CanvasRenderingContext2D, delta: number): void {
    const {
      duffingLinear,
      duffingCubic,
      duffingDamping,
      duffingDrive,
      duffingFrequency,
      duffingStep,
    } = this.controls();
    if (this.running()) {
      const substeps = Math.max(1, Math.round(delta * 7));
      for (let step = 0; step < substeps; step++) {
        stepDuffing(
          this.duffingState,
          this.simulationTime,
          duffingStep,
          duffingLinear,
          duffingCubic,
          duffingDamping,
          duffingDrive,
          duffingFrequency,
        );
        this.simulationTime += duffingStep;
      }
      this.duffingHistory.push({ ...this.duffingState });
      if (this.duffingHistory.length > 1800) this.duffingHistory.shift();
    }

    const physicalRight = this.width * 0.49;
    const centerY = this.height * 0.49;
    const anchorX = 36;
    const equilibriumX = physicalRight * 0.53;
    const positionScale = Math.min(this.width * 0.065, this.height * 0.085);
    const massX = equilibriumX + this.duffingState.position * positionScale;
    context.strokeStyle = 'rgba(226,236,255,.16)';
    context.setLineDash([4, 7]);
    context.beginPath();
    context.moveTo(equilibriumX, centerY - 72);
    context.lineTo(equilibriumX, centerY + 72);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = '#4c5870';
    context.fillRect(anchorX - 5, centerY - 50, 5, 100);
    this.drawCoil(
      context,
      { x: anchorX, y: centerY },
      { x: massX - 13, y: centerY },
      12,
      'rgba(168,153,255,.72)',
    );
    context.fillStyle = '#70e7c4';
    context.shadowColor = '#70e7c4';
    context.shadowBlur = 18;
    context.fillRect(massX - 13, centerY - 23, 26, 46);
    context.shadowBlur = 0;
    context.fillStyle = '#8290a3';
    context.font = '10px DM Mono, monospace';
    context.fillText(`x = ${this.duffingState.position.toFixed(3)}`, anchorX, centerY + 84);

    const phaseLeft = this.width * 0.56;
    const phaseRight = this.width - 28;
    const phaseTop = 38;
    const phaseBottom = this.height - 46;
    let positionMaximum = 1.5;
    let velocityMaximum = 1.5;
    for (const point of this.duffingHistory) {
      positionMaximum = Math.max(positionMaximum, Math.abs(point.position) * 1.08);
      velocityMaximum = Math.max(velocityMaximum, Math.abs(point.velocity) * 1.08);
    }
    const phaseX = (position: number): number =>
      phaseLeft + ((position / positionMaximum + 1) / 2) * (phaseRight - phaseLeft);
    const phaseY = (velocity: number): number =>
      phaseBottom - ((velocity / velocityMaximum + 1) / 2) * (phaseBottom - phaseTop);
    context.strokeStyle = 'rgba(226,236,255,.13)';
    context.beginPath();
    context.moveTo(phaseX(0), phaseTop);
    context.lineTo(phaseX(0), phaseBottom);
    context.moveTo(phaseLeft, phaseY(0));
    context.lineTo(phaseRight, phaseY(0));
    context.stroke();
    context.beginPath();
    this.duffingHistory.forEach((point, index) => {
      if (index === 0) context.moveTo(phaseX(point.position), phaseY(point.velocity));
      else context.lineTo(phaseX(point.position), phaseY(point.velocity));
    });
    context.strokeStyle = 'rgba(245,191,111,.72)';
    context.lineWidth = 1.15;
    context.stroke();
    context.fillStyle = '#f5bf6f';
    context.beginPath();
    context.arc(
      phaseX(this.duffingState.position),
      phaseY(this.duffingState.velocity),
      4,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.fillStyle = '#8290a3';
    context.fillText('phase portrait · ẋ vs x', phaseLeft, phaseTop - 12);

    const energy = duffingEnergy(this.duffingState, duffingLinear, duffingCubic);
    const drivePower =
      duffingDrive * this.duffingState.velocity * Math.cos(duffingFrequency * this.simulationTime);
    const dissipatedPower = duffingDamping * this.duffingState.velocity ** 2;
    const conservativeDiagnostic =
      duffingDrive === 0 && duffingDamping === 0
        ? ` · |ΔE/E₀| = ${Math.abs((energy - this.initialInvariant) / Math.max(Math.abs(this.initialInvariant), Number.EPSILON)).toExponential(2)}`
        : ` · Pᵢₙ = ${drivePower.toFixed(3)} · Pδ = ${dissipatedPower.toFixed(3)}`;
    this.metric.set(
      `t = ${this.simulationTime.toFixed(3)} · x = ${this.duffingState.position.toFixed(3)} · ẋ = ${this.duffingState.velocity.toFixed(3)} · E = ${energy.toFixed(3)}${conservativeDiagnostic}`,
    );
  }

  private drawCoil(
    context: CanvasRenderingContext2D,
    start: { x: number; y: number },
    end: { x: number; y: number },
    turns: number,
    color: string,
  ): void {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.max(Math.hypot(dx, dy), 1);
    const normalX = -dy / length;
    const normalY = dx / length;
    const amplitude = Math.min(5, length / Math.max(4, turns * 2));
    context.beginPath();
    context.moveTo(start.x, start.y);
    for (let segment = 1; segment < turns * 2; segment++) {
      const fraction = segment / (turns * 2);
      const offset = (segment % 2 === 0 ? -1 : 1) * amplitude;
      context.lineTo(
        start.x + dx * fraction + normalX * offset,
        start.y + dy * fraction + normalY * offset,
      );
    }
    context.lineTo(end.x, end.y);
    context.strokeStyle = color;
    context.lineWidth = 1.1;
    context.stroke();
  }

  private project3D(point: Point3D): ProjectedPoint {
    const yawCosine = Math.cos(this.cameraYaw);
    const yawSine = Math.sin(this.cameraYaw);
    const pitchCosine = Math.cos(this.cameraPitch);
    const pitchSine = Math.sin(this.cameraPitch);
    const rotatedX = yawCosine * point.x + yawSine * point.z;
    const yawDepth = -yawSine * point.x + yawCosine * point.z;
    const rotatedY = pitchCosine * point.y - pitchSine * yawDepth;
    const depth = pitchSine * point.y + pitchCosine * yawDepth;
    const perspective = 6 / Math.max(2.5, 6 + depth);
    const pixelScale = Math.min(this.width, this.height) * 0.205 * this.cameraZoom * perspective;
    return {
      x: this.width / 2 + rotatedX * pixelScale,
      y: this.height / 2 - rotatedY * pixelScale,
      depth,
      scale: perspective,
    };
  }

  private draw3DReference(context: CanvasRenderingContext2D, extent: number): void {
    context.lineWidth = 1;
    for (let division = -4; division <= 4; division++) {
      const offset = (division / 4) * extent;
      this.drawVector3D(
        context,
        { x: -extent, y: -extent * 0.72, z: offset },
        { x: extent, y: -extent * 0.72, z: offset },
        'rgba(225,235,255,.065)',
      );
      this.drawVector3D(
        context,
        { x: offset, y: -extent * 0.72, z: -extent },
        { x: offset, y: -extent * 0.72, z: extent },
        'rgba(225,235,255,.065)',
      );
    }
    this.drawVector3D(context, { x: 0, y: 0, z: 0 }, { x: extent, y: 0, z: 0 }, '#ff795f');
    this.drawVector3D(context, { x: 0, y: 0, z: 0 }, { x: 0, y: extent, z: 0 }, '#70e7c4');
    this.drawVector3D(context, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: extent }, '#a899ff');
  }

  private drawVector3D(
    context: CanvasRenderingContext2D,
    start: Point3D,
    end: Point3D,
    color: string,
  ): void {
    const projectedStart = this.project3D(start);
    const projectedEnd = this.project3D(end);
    context.beginPath();
    context.moveTo(projectedStart.x, projectedStart.y);
    context.lineTo(projectedEnd.x, projectedEnd.y);
    context.strokeStyle = color;
    context.stroke();
  }

  private draw3DBodies(
    context: CanvasRenderingContext2D,
    bodies: VisualBody3D[],
    trailOpacity: number,
  ): void {
    bodies.forEach((body) => {
      context.beginPath();
      body.trail.forEach((point, index) => {
        const projected = this.project3D(point);
        if (index === 0) context.moveTo(projected.x, projected.y);
        else context.lineTo(projected.x, projected.y);
      });
      context.globalAlpha = trailOpacity * 0.28;
      context.strokeStyle = body.color;
      context.lineWidth = 0.8;
      context.stroke();
    });
    context.globalAlpha = 1;
    bodies
      .map((body) => ({ body, projected: this.project3D(body) }))
      .sort((first, second) => first.projected.depth - second.projected.depth)
      .forEach(({ body, projected }) => {
        context.globalAlpha = Math.max(0.42, Math.min(1, 0.82 - projected.depth * 0.08));
        context.fillStyle = body.color;
        context.beginPath();
        context.arc(
          projected.x,
          projected.y,
          Math.max(1.5, body.radius * projected.scale),
          0,
          Math.PI * 2,
        );
        context.fill();
      });
    context.globalAlpha = 1;
  }

  private drawProjectedParticle(
    context: CanvasRenderingContext2D,
    point: Point3D,
    color: string,
    radius: number,
  ): void {
    const projected = this.project3D(point);
    context.fillStyle = color;
    context.shadowColor = color;
    context.shadowBlur = 14;
    context.beginPath();
    context.arc(projected.x, projected.y, radius * projected.scale, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
  }

  private renderRaster(context: CanvasRenderingContext2D, mode: 'reaction' | 'wave'): void {
    if (!this.rasterCanvas || !this.rasterContext) return;
    const image = this.rasterContext.createImageData(this.fieldWidth, this.fieldHeight);
    for (let index = 0; index < this.fieldWidth * this.fieldHeight; index++) {
      const pixel = index * 4;
      if (mode === 'reaction') {
        const u = this.reactionU[index];
        const v = this.reactionV[index];
        image.data[pixel] = 18 + v * 620;
        image.data[pixel + 1] = 24 + (1 - u) * 250 + v * 190;
        image.data[pixel + 2] = 52 + u * 90 + v * 260;
      } else {
        const value = Math.max(-1, Math.min(1, this.waveCurrent[index]));
        image.data[pixel] = 24 + Math.max(0, value) * 210;
        image.data[pixel + 1] = 28 + (1 - Math.abs(value)) * 50;
        image.data[pixel + 2] = 54 + Math.max(0, -value) * 210;
      }
      image.data[pixel + 3] = 238;
    }
    this.rasterContext.putImageData(image, 0, 0);
    context.imageSmoothingEnabled = false;
    context.drawImage(this.rasterCanvas, 0, 0, this.width, this.height);
    context.imageSmoothingEnabled = true;
  }

  private meanKineticEnergy(): number {
    if (this.particles.length === 0) return 0;
    return (
      this.particles.reduce((sum, particle) => sum + kineticEnergy(particle), 0) /
      this.particles.length
    );
  }

  private meanKineticEnergy3D(bodies: readonly PhaseBody3D[]): number {
    if (bodies.length === 0) return 0;
    return (
      bodies.reduce(
        (sum, body) => sum + 0.5 * body.mass * (body.vx ** 2 + body.vy ** 2 + body.vz ** 2),
        0,
      ) / bodies.length
    );
  }

  private quantumNorm(): number {
    let norm = 0;
    for (let index = 0; index < this.quantumPoints; index++) {
      norm +=
        (this.quantumReal[index] ** 2 + this.quantumImaginary[index] ** 2) *
        this.quantumSpatialStep;
    }
    return norm;
  }

  private totalPendulumEnergy(): number {
    return this.pendulumStates.reduce(
      (sum, pendulum) => sum + pendulumEnergy(pendulum, this.controls().pendulumGravity),
      0,
    );
  }

  private updateInvariantMetric(currentInvariant: number): void {
    const denominator = Math.max(Math.abs(this.initialInvariant), Number.EPSILON);
    const drift = Math.abs((currentInvariant - this.initialInvariant) / denominator);
    this.metric.set(`t = ${this.simulationTime.toFixed(3)} · |ΔE/E₀| = ${drift.toExponential(2)}`);
  }
}
