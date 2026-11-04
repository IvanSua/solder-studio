import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';

interface SizeGuideResponse {
  id: number;
  categoryId: number;
  categoryName: string;
  name: string;
  sizes: string[];
  measurements: Partial<Record<string, Partial<Record<string, string>>>>;
  instructions: string | null;
}

@Component({
  selector: 'app-size-guide',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="size-guide" *ngIf="sizeGuides().length > 0">
      <button class="guide-toggle" (click)="toggle()">
        📏 Guía de talles
      </button>

      @if (isOpen()) {
        <div class="guide-modal">
          <div class="guide-content">
            <div class="guide-header">
              <h3>Guía de Talles</h3>
              <button class="close-btn" type="button" (click)="toggle()" aria-label="Cerrar guía de talles">×</button>
            </div>

            @for (guide of sizeGuides(); track guide.id) {
              <div class="guide-section">
                <h4>{{ guide.name }}</h4>
                
                @if (guide.instructions) {
                  <p class="instructions">{{ guide.instructions }}</p>
                }

                <div class="table-wrapper">
                  <table class="size-table">
                    <thead>
                      <tr>
                        <th>Talle</th>
                        @for (measurement of getMeasurementKeys(guide); track measurement) {
                          <th>{{ getMeasurementLabel(measurement) }}</th>
                        }
                      </tr>
                    </thead>
                    <tbody>
                      @for (size of guide.sizes; track size) {
                          <tr>
                            <td class="size-cell">{{ size }}</td>
                            @for (measurement of getMeasurementKeys(guide); track measurement) {
                              <td>{{ getMeasurementValue(guide, size, measurement) }}</td>
                            }
                          </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .size-guide {
      position: relative;
    }

    .guide-toggle {
      background: none;
      border: none;
      color: var(--primary);
      font-size: 0.875rem;
      cursor: pointer;
      text-decoration: underline;
      padding: 0;
    }

    .guide-toggle:hover {
      color: var(--primary-dark);
    }

    .guide-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }

    .guide-content {
      background: var(--bg-card);
      border-radius: 12px;
      max-width: 700px;
      max-height: 90vh;
      overflow-y: auto;
      width: 100%;
    }

    .guide-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      background: var(--bg-card);
      border-radius: 12px 12px 0 0;
    }

    .guide-header h3 {
      margin: 0;
      font-size: 1.25rem;
      color: var(--text);
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 1.75rem;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }

    .close-btn:hover {
      color: var(--text);
    }

    .guide-section {
      padding: 1.5rem;
      border-bottom: 1px solid var(--border);
    }

    .guide-section:last-child {
      border-bottom: none;
    }

    .guide-section h4 {
      margin: 0 0 0.75rem;
      font-size: 1rem;
      color: var(--text);
    }

    .instructions {
      color: var(--text-secondary);
      font-size: 0.875rem;
      margin: 0 0 1rem;
      line-height: 1.5;
    }

    .table-wrapper {
      overflow-x: auto;
    }

    .size-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    .size-table th,
    .size-table td {
      padding: 0.75rem;
      text-align: center;
      border: 1px solid var(--border);
    }

    .size-table th {
      background: var(--bg-secondary);
      font-weight: 600;
      color: var(--text);
    }

    .size-cell {
      font-weight: 600;
      background: var(--bg-secondary);
      color: var(--text);
    }

    .size-table td {
      color: var(--text-secondary);
    }
  `],
})
export class SizeGuideComponent implements OnInit {
  @Input() categoryId!: number;

  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  sizeGuides = signal<SizeGuideResponse[]>([]);
  isOpen = signal(false);

  ngOnInit(): void {
    if (this.categoryId) {
      this.loadSizeGuides();
    }
  }

  loadSizeGuides(): void {
    this.http.get<SizeGuideResponse[]>(`${this.apiUrl}/size-guides/category/${this.categoryId}`)
      .subscribe({
        next: (data) => this.sizeGuides.set(data),
        error: (err) => console.error('Error loading size guides:', err),
      });
  }

  toggle(): void {
    this.isOpen.set(!this.isOpen());
  }

  getMeasurementKeys(guide: SizeGuideResponse): string[] {
    if (!guide.measurements) return [];
    const firstSize = guide.sizes[0];
    if (!firstSize || !guide.measurements[firstSize]) return [];
    return Object.keys(guide.measurements[firstSize]);
  }

  getMeasurementLabel(key: string): string {
    const labels: Record<string, string> = {
      'chest': 'Contorno pecho (cm)',
      'waist': 'Contorno cintura (cm)',
      'hips': 'Contorno cadera (cm)',
      'length': 'Largo total (cm)',
      'width': 'Ancho (cm)',
      'height': 'Alto (cm)',
      'inseam': 'Entrepierna (cm)',
      'sleeve': 'Largo manga (cm)',
      'shoulder': 'Ancho hombro (cm)',
    };
    return labels[key] || key;
  }

  getMeasurementValue(guide: SizeGuideResponse, size: string, measurement: string): string {
    return guide.measurements[size]?.[measurement] ?? '-';
  }
}
