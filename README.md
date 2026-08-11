# Physics Lab

An interactive browser-based laboratory for exploring classical mechanics, nonlinear dynamics, field physics, spatial epidemics, waves, and quantum mechanics.

Physics Lab currently includes 16 parameterized simulations:

- Kepler two-body motion and power-law central forces
- Lorentz fields and three-dimensional magnetic helices
- Pendulum waves, a double pendulum, spring normal modes, and the Duffing oscillator
- Three-body and configurable N-body gravity, including a 3D cluster
- A spatial stochastic SIR epidemic with a power-law transmission kernel
- Gray–Scott reaction–diffusion and two-source wave interference
- Quantum tunneling via the time-dependent Schrödinger equation
- The three-dimensional Lorenz attractor

Each laboratory includes interactive controls, live measurements, and a model guide documenting its equations, parameters, numerical method, limitations, and scientific reference.

## Tech stack

- Angular 22 with standalone components, signals, and strict TypeScript
- Canvas 2D for real-time simulation rendering
- ESLint, Prettier, and Vitest

## Local development

Requirements: Node.js 22 or newer and npm.

```bash
npm install
npm start
```

Open <http://localhost:4200/>.

## Quality checks

```bash
npm run lint
npm test -- --watch=false
npm run build
```

## Scientific scope

The simulations are interactive numerical models intended for education and exploration. Their model guides state the assumptions and limitations of each implementation; they should not be treated as experimental measurements, clinical forecasts, or engineering certification tools.
