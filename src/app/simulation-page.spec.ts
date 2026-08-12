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

  it('uses segmented buttons for categorical parameters', () => {
    const fixture = TestBed.createComponent(SimulationPage);
    const component = fixture.componentInstance as unknown as {
      selectedScenario: { set: (scenario: string) => void };
    };
    component.selectedScenario.set('fluid');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('.control-list .control-options')).toHaveLength(1);
    expect(compiled.querySelectorAll('.control-list .control-options button')).toHaveLength(2);
    expect(compiled.querySelector('.visualization-controls')?.textContent).toContain('Field view');
  });

  it('offers visualization controls on every simulation', () => {
    const fixture = TestBed.createComponent(SimulationPage);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.visualization-controls')?.textContent).toContain('Brightness');
    expect(compiled.querySelector('.visualization-controls')?.textContent).toContain('Contrast');
    expect(compiled.querySelector('.visualization-controls')?.textContent).toContain(
      'Reference guides',
    );
    expect(compiled.querySelector('.visualization-controls')?.textContent).toContain(
      'solver state is unchanged',
    );
  });

  it('uses steppers instead of range sliders for discrete counts', () => {
    const fixture = TestBed.createComponent(SimulationPage);
    const component = fixture.componentInstance as unknown as {
      selectedScenario: { set: (scenario: string) => void };
    };
    component.selectedScenario.set('springChain');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('.numeric-stepper')).toHaveLength(2);
    expect(compiled.querySelector('[aria-label="Mass count N"]')?.tagName).not.toBe('INPUT');
    expect(compiled.querySelector('[aria-label="Mode index p"]')?.tagName).not.toBe('INPUT');
  });

  it('reveals a continuous collision-rate slider only when collisions are enabled', () => {
    const fixture = TestBed.createComponent(SimulationPage);
    const component = fixture.componentInstance as unknown as {
      selectedScenario: { set: (scenario: string) => void };
    };
    component.selectedScenario.set('field');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).not.toContain('Collision rate ν');
    const collisionButtons = [
      ...compiled.querySelectorAll<HTMLButtonElement>('.control-options button'),
    ];
    collisionButtons.find((button) => button.textContent?.trim() === 'On')?.click();
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Collision rate ν');
  });
});
