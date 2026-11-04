import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ToastContainerComponent } from './toast.component';
import { ToastService, Toast } from '@core/services/toast.service';
import { signal } from '@angular/core';

/**
 * Mock ToastService with real signals for testing.
 * ToastService uses signals internally, so we need real signals in tests.
 */
class MockToastService {
  private _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();
  private nextId = 0;

  show(message: string, type: Toast['type'] = 'info', duration = 3500): void {
    const id = ++this.nextId;
    this._toasts.update(list => [...list, { id, type, message, duration }]);
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }

  dismiss(id: number): void {
    this._toasts.update(list => list.filter(t => t.id !== id));
  }
}

describe('ToastContainerComponent', () => {
  let component: ToastContainerComponent;
  let fixture: ComponentFixture<ToastContainerComponent>;
  let mockToastService: MockToastService;

  beforeEach(async () => {
    mockToastService = new MockToastService();

    await TestBed.configureTestingModule({
      imports: [ToastContainerComponent],
      providers: [
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ToastContainerComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have aria-live="polite" for accessibility', () => {
    fixture.detectChanges();
    const container = fixture.debugElement.query(By.css('.toast-container'));
    expect(container.nativeElement.getAttribute('aria-live')).toBe('polite');
  });

  it('should render no toasts when list is empty', () => {
    fixture.detectChanges();
    const toasts = fixture.debugElement.queryAll(By.css('.toast'));
    expect(toasts.length).toBe(0);
  });

  it('should render a success toast', () => {
    mockToastService.show('Test success', 'success');
    fixture.detectChanges();
    fixture.detectChanges();

    const toasts = fixture.debugElement.queryAll(By.css('.toast'));
    expect(toasts.length).toBe(1);
    expect(toasts[0].nativeElement.textContent).toContain('Test success');
    expect(toasts[0].nativeElement.classList).toContain('toast-success');
  });

  it('should render an error toast', () => {
    mockToastService.show('Test error', 'error');
    fixture.detectChanges();
    fixture.detectChanges();

    const toasts = fixture.debugElement.queryAll(By.css('.toast'));
    expect(toasts.length).toBe(1);
    expect(toasts[0].nativeElement.classList).toContain('toast-error');
  });

  it('should render a warning toast', () => {
    mockToastService.show('Test warning', 'warning');
    fixture.detectChanges();
    fixture.detectChanges();

    const toasts = fixture.debugElement.queryAll(By.css('.toast'));
    expect(toasts[0].nativeElement.classList).toContain('toast-warning');
  });

  it('should render an info toast', () => {
    mockToastService.show('Test info', 'info');
    fixture.detectChanges();
    fixture.detectChanges();

    const toasts = fixture.debugElement.queryAll(By.css('.toast'));
    expect(toasts[0].nativeElement.classList).toContain('toast-info');
  });

  it('should render multiple toasts', () => {
    mockToastService.show('One', 'success');
    mockToastService.show('Two', 'error');
    mockToastService.show('Three', 'info');
    fixture.detectChanges();
    fixture.detectChanges();

    const toasts = fixture.debugElement.queryAll(By.css('.toast'));
    expect(toasts.length).toBe(3);
  });

  it('should call dismiss when close button is clicked', async () => {
    mockToastService.show('Dismiss me', 'success', 0); // duration=0 so it doesn't auto-dismiss
    fixture.detectChanges();
    fixture.detectChanges();

    const closeBtn = fixture.debugElement.query(By.css('.toast-close'));
    closeBtn.nativeElement.click();
    fixture.detectChanges();

    // Wait for 250ms animation to complete
    await new Promise(r => setTimeout(r, 300));
    fixture.detectChanges();

    const toasts = fixture.debugElement.queryAll(By.css('.toast'));
    expect(toasts.length).toBe(0);
  });

  it('should call dismiss when toast itself is clicked', async () => {
    mockToastService.show('Click me', 'info', 0);
    fixture.detectChanges();
    fixture.detectChanges();

    const toast = fixture.debugElement.query(By.css('.toast'));
    toast.nativeElement.click();
    fixture.detectChanges();

    // Wait for 250ms animation to complete
    await new Promise(r => setTimeout(r, 300));
    fixture.detectChanges();

    const toasts = fixture.debugElement.queryAll(By.css('.toast'));
    expect(toasts.length).toBe(0);
  });

  it('should have close button with aria-label for accessibility', () => {
    mockToastService.show('Test', 'success', 0);
    fixture.detectChanges();

    const closeBtn = fixture.debugElement.query(By.css('.toast-close'));
    expect(closeBtn.nativeElement.getAttribute('aria-label')).toBe('Cerrar notificación');
  });

  it('should show success icon SVG for success toast', () => {
    mockToastService.show('Great!', 'success');
    fixture.detectChanges();

    const toastIcon = fixture.debugElement.query(By.css('.toast-icon svg'));
    expect(toastIcon).toBeTruthy();
  });
});
