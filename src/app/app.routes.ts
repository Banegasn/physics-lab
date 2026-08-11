import { Routes } from '@angular/router';
import { DEFAULT_SCENARIO } from './scenario-catalog';
import { SimulationPage } from './simulation-page';

export const routes: Routes = [
  {
    path: '',
    component: SimulationPage,
    data: { scenarioSlug: DEFAULT_SCENARIO.slug },
    title: `${DEFAULT_SCENARIO.name} Simulator | Kinetica`,
  },
  {
    path: 'simulations/:slug',
    component: SimulationPage,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
