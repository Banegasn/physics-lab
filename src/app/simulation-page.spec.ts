import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SimulationPage } from './simulation-page';

describe('SimulationPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SimulationPage],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the simulation page', () => {
    const fixture = TestBed.createComponent(SimulationPage);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the default simulation title', async () => {
    const fixture = TestBed.createComponent(SimulationPage);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Kepler two-body');
  });

  it('should offer a broad range of simulation speeds', async () => {
    const fixture = TestBed.createComponent(SimulationPage);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const labels = [...compiled.querySelectorAll('.speed-options button')].map((button) =>
      button.textContent?.trim(),
    );

    expect(labels).toEqual(['0.1×', '0.25×', '0.5×', '1×', '2×', '4×']);
  });

  it('should render explanation, uses, and parameter documentation', async () => {
    const fixture = TestBed.createComponent(SimulationPage);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.guide-overview')?.textContent).toContain(
      'What this simulator is useful for',
    );
    expect(compiled.querySelectorAll('.guide-uses li')).toHaveLength(3);
    expect(compiled.querySelector('.guide-parameters')?.textContent).toContain(
      'Orbital eccentricity',
    );
  });
});
