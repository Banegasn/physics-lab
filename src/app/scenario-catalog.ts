export const SCENARIO_IDS = [
  'orbit',
  'field',
  'pendulum',
  'powerLaw',
  'threeBody',
  'epidemic',
  'reaction',
  'doublePendulum',
  'wave',
  'nBody',
  'quantum',
  'lorenz3d',
  'gravity3d',
  'magnetic3d',
  'springChain',
  'duffing',
] as const;

export type Scenario = (typeof SCENARIO_IDS)[number];

export interface ScenarioDefinition {
  id: Scenario;
  slug: string;
  number: string;
  name: string;
  description: string;
  seoDescription: string;
  uses: readonly string[];
}

export const SCENARIOS: readonly ScenarioDefinition[] = [
  {
    id: 'orbit',
    slug: 'kepler-two-body',
    number: '01',
    name: 'Kepler two-body',
    description: 'A barycentric Kepler system with finite masses.',
    seoDescription:
      'Explore a barycentric Kepler two-body orbit with adjustable eccentricity, mass ratio and integration timestep.',
    uses: [
      'Connect orbital eccentricity with trajectory geometry and periapsis speed.',
      'Compare the motion of both finite masses around their shared barycenter.',
      'Test numerical energy and angular-momentum conservation as the timestep changes.',
    ],
  },
  {
    id: 'field',
    slug: 'lorentz-force-field',
    number: '02',
    name: 'Lorentz field',
    description: 'Charged particles under uniform E and B fields.',
    seoDescription:
      'Simulate charged particles in uniform electric and magnetic fields with a Boris integrator and optional elastic collisions.',
    uses: [
      'Study cyclotron motion and the dependence of gyro-radius on field strength.',
      'Observe electric-field drift and combined Lorentz-force trajectories.',
      'Compare collisionless dynamics with conservative equal-mass scattering.',
    ],
  },
  {
    id: 'pendulum',
    slug: 'pendulum-wave',
    number: '03',
    name: 'Pendulum wave',
    description: 'Nonlinear pendula tuned to a common revival.',
    seoDescription:
      'Explore a pendulum-wave array whose nonlinear periods are tuned to produce phase patterns and a common revival.',
    uses: [
      'Visualize phase mixing and the formation of apparent traveling-wave patterns.',
      'Relate pendulum length, gravity and amplitude to nonlinear oscillation period.',
      'Investigate how numerical timestep and tuning affect the predicted revival.',
    ],
  },
  {
    id: 'powerLaw',
    slug: 'power-law-central-force',
    number: '04',
    name: 'Power-law potential',
    description: 'Central-force trajectories under F ∝ r⁻ⁿ.',
    seoDescription:
      'Explore central-force trajectories under an adjustable inverse power law and compare bounded, precessing and escaping orbits.',
    uses: [
      'Compare closed Keplerian ellipses with precessing non-Keplerian trajectories.',
      'Explore how force exponent and coupling strength change orbital stability.',
      'Check energy conservation and timestep convergence for singular forces.',
    ],
  },
  {
    id: 'threeBody',
    slug: 'three-body-problem',
    number: '05',
    name: 'Three-body problem',
    description: 'Chaotic gravity from figure-eight initial data.',
    seoDescription:
      'Run the gravitational three-body problem from figure-eight initial data and perturb mass, softening and timestep.',
    uses: [
      'Reproduce the equal-mass figure-eight choreography in dimensionless units.',
      'Observe sensitivity to a mass perturbation and the onset of chaotic motion.',
      'Assess how softening and integration timestep affect energy conservation.',
    ],
  },
  {
    id: 'epidemic',
    slug: 'power-law-epidemic',
    number: '06',
    name: 'Power-law epidemic',
    description: 'Spatial contagion with a power-law distance kernel.',
    seoDescription:
      'Explore a spatial stochastic SIR epidemic with adjustable transmission, recovery and power-law interaction distance.',
    uses: [
      'Explore the introduction of a novel pathogen into a mostly susceptible population.',
      'Compare localized and long-range transmission by changing the kernel exponent.',
      'Study stochastic incidence curves while varying density, recovery and interaction radius.',
    ],
  },
  {
    id: 'reaction',
    slug: 'gray-scott-reaction-diffusion',
    number: '07',
    name: 'Reaction–diffusion',
    description: 'Gray–Scott pattern formation on a periodic domain.',
    seoDescription:
      'Generate Gray–Scott reaction–diffusion patterns by changing feed, kill, diffusion and numerical timestep parameters.',
    uses: [
      'Explore self-organized spots, stripes and labyrinthine concentration fields.',
      'Map qualitative pattern regimes across the feed and kill parameters.',
      'Check explicit-solver stability as diffusion coefficients and timestep change.',
    ],
  },
  {
    id: 'doublePendulum',
    slug: 'double-pendulum',
    number: '08',
    name: 'Double pendulum',
    description: 'Coupled nonlinear motion and deterministic chaos.',
    seoDescription:
      'Simulate a nonlinear double pendulum with adjustable masses, lengths, gravity, initial angle and RK4 timestep.',
    uses: [
      'Observe the transition from regular oscillations to chaotic rotations.',
      'Relate mass and length ratios to coupled nonlinear motion.',
      'Use the live energy diagnostic to evaluate integration accuracy.',
    ],
  },
  {
    id: 'wave',
    slug: 'wave-interference',
    number: '09',
    name: 'Wave interference',
    description: 'Two coherent sources in a finite-difference field.',
    seoDescription:
      'Visualize two-source wave interference with adjustable frequency, damping, source separation and Courant number.',
    uses: [
      'Identify constructive and destructive interference from coherent sources.',
      'Relate source separation and frequency to fringe spacing.',
      'Explore damping and the finite-difference Courant stability condition.',
    ],
  },
  {
    id: 'nBody',
    slug: 'n-body-gravity',
    number: '10',
    name: 'N-body cluster',
    description: 'Direct self-gravity for a configurable particle system.',
    seoDescription:
      'Simulate a configurable self-gravitating N-body cluster with direct summation, softening and velocity-Verlet integration.',
    uses: [
      'Compare collapsing, virialized and expanding particle clusters.',
      'Study finite-N structure and the computational cost of direct gravity.',
      'Measure energy drift while varying particle count, softening and timestep.',
    ],
  },
  {
    id: 'quantum',
    slug: 'quantum-tunneling',
    number: '11',
    name: 'Quantum tunneling',
    description: 'A wave packet scattering from a potential barrier.',
    seoDescription:
      'Simulate one-dimensional quantum tunneling of a Gaussian wave packet through an adjustable rectangular potential barrier.',
    uses: [
      'Visualize simultaneous reflection and transmission of a matter-wave packet.',
      'Compare mean kinetic energy with barrier height and width.',
      'Monitor probability normalization under Crank–Nicolson time evolution.',
    ],
  },
  {
    id: 'lorenz3d',
    slug: 'lorenz-attractor-3d',
    number: '12 · 3D',
    name: 'Lorenz attractor',
    description: 'Chaotic flow through a three-dimensional phase space.',
    seoDescription:
      'Explore the three-dimensional Lorenz system with adjustable sigma, rho, beta and RK4 timestep.',
    uses: [
      'Visualize the strange attractor in three-dimensional phase space.',
      'Explore how control parameters change equilibria and chaotic behavior.',
      'Observe sensitive dependence without interpreting a single trace as proof of chaos.',
    ],
  },
  {
    id: 'gravity3d',
    slug: 'gravitational-cluster-3d',
    number: '13 · 3D',
    name: 'Gravitational cluster',
    description: 'Direct Newtonian N-body dynamics in three dimensions.',
    seoDescription:
      'Explore a three-dimensional Newtonian N-body cluster with adjustable count, virial ratio, softening and timestep.',
    uses: [
      'Inspect gravitational collapse and virialized structure from an orbitable camera.',
      'Compare kinetic and potential energy through the virial ratio.',
      'Evaluate force softening and timestep effects on total-energy conservation.',
    ],
  },
  {
    id: 'magnetic3d',
    slug: 'magnetic-helices-3d',
    number: '14 · 3D',
    name: 'Magnetic helices',
    description: 'Charged-particle gyromotion in three-dimensional fields.',
    seoDescription:
      'Simulate three-dimensional charged-particle helices in uniform electromagnetic fields with optional elastic collisions.',
    uses: [
      'Relate pitch angle to parallel and perpendicular velocity components.',
      'Explore gyro-frequency, Larmor radius and electric acceleration.',
      'Compare Boris-integrated trajectories with and without conservative collisions.',
    ],
  },
  {
    id: 'springChain',
    slug: 'spring-normal-modes',
    number: '15',
    name: 'Spring normal modes',
    description: 'Standing waves in a finite coupled-mass lattice.',
    seoDescription:
      'Explore normal modes in a finite fixed-end chain of identical masses and Hooke springs.',
    uses: [
      'Visualize nodes and antinodes of discrete standing-wave modes.',
      'Relate mode number, spring constant and mass to lattice frequency.',
      'Compare continuum intuition with dispersion in a finite discrete chain.',
    ],
  },
  {
    id: 'duffing',
    slug: 'duffing-oscillator',
    number: '16',
    name: 'Duffing spring',
    description: 'Driven nonlinear elasticity and phase-space dynamics.',
    seoDescription:
      'Explore a driven damped Duffing oscillator with adjustable linear and cubic stiffness, forcing and frequency.',
    uses: [
      'Compare hardening, softening and double-well nonlinear spring responses.',
      'Inspect transients and steady behavior in displacement and phase space.',
      'Explore bifurcation-like changes while checking timestep convergence.',
    ],
  },
];

export const DEFAULT_SCENARIO = SCENARIOS[0];

export function getScenarioBySlug(slug: string | null): ScenarioDefinition {
  return SCENARIOS.find((scenario) => scenario.slug === slug) ?? DEFAULT_SCENARIO;
}
