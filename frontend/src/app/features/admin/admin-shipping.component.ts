import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface ShippingRate {
  id: number;
  province: string;
  postalCodePrefix: string | null;
  carrierName: string;
  deliveryDaysMin: number;
  deliveryDaysMax: number;
  priceAmount: number;
  freeShippingThreshold: number | null;
  active: boolean;
}

interface ShippingRateForm {
  province: string;
  postalCodePrefix: string;
  carrierName: string;
  deliveryDaysMin: number;
  deliveryDaysMax: number;
  priceAmount: number;
  freeShippingThreshold: number | null;
}

interface CarrierConfig {
  id: number;
  carrierCode: string;
  carrierName: string;
  mode: 'MANUAL' | 'AUTO';
  enabled: boolean;
  apiConfigured: boolean;
  hasUsername: boolean;
  hasPassword: boolean;
  hasClientNumber: boolean;
}

interface CarrierCredentialForm {
  apiUsername: string;
  apiPassword: string;
  apiClientNumber: string;
}

const emptyRateForm = (): ShippingRateForm => ({
  province: '',
  postalCodePrefix: '',
  carrierName: '',
  deliveryDaysMin: 1,
  deliveryDaysMax: 3,
  priceAmount: 0,
  freeShippingThreshold: null,
});

const emptyCredForm = (): CarrierCredentialForm => ({
  apiUsername: '',
  apiPassword: '',
  apiClientNumber: '',
});

@Component({
  selector: 'app-admin-shipping',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">

      <!-- ══ SECCIÓN 1: CONFIGURACIÓN DE CARRIERS ══ -->
      <div class="section">
        <h1>Configuración de Carriers</h1>
        <p class="section-subtitle">Elegí el modo de cálculo por carrier. Sin credenciales, el modo Automático cae al Manual.</p>

        @if (carriersLoading()) {
          <div class="loading-text">Cargando carriers...</div>
        } @else {
          <div class="carrier-grid">
            @for (carrier of carriers(); track carrier.carrierCode) {
              <div class="carrier-card" [class.disabled]="!carrier.enabled">
                <div class="carrier-header">
                  <div class="carrier-info">
                    <span class="carrier-name">{{ carrier.carrierName }}</span>
                    @if (carrier.apiConfigured) {
                      <span class="badge-configured">API configurada</span>
                    } @else {
                      <span class="badge-pending">Sin credenciales</span>
                    }
                  </div>
                  <label class="toggle-switch" title="{{ carrier.enabled ? 'Deshabilitar' : 'Habilitar' }}">
                    <input type="checkbox" [checked]="carrier.enabled" (change)="toggleCarrier(carrier)" />
                    <span class="toggle-track"></span>
                  </label>
                </div>

                <div class="mode-selector">
                  <button
                    class="mode-btn"
                    [class.active]="carrier.mode === 'MANUAL'"
                    (click)="setCarrierMode(carrier, 'MANUAL')">
                    Manual
                  </button>
                  <button
                    class="mode-btn"
                    [class.active]="carrier.mode === 'AUTO'"
                    (click)="setCarrierMode(carrier, 'AUTO')">
                    Automático
                  </button>
                </div>

                @if (carrier.mode === 'MANUAL') {
                  <p class="mode-note">Usa la tabla de tarifas de abajo para calcular precios.</p>
                } @else {
                  <p class="mode-note">
                    @if (carrier.apiConfigured) {
                      Consultando la API del carrier en tiempo real.
                    } @else {
                      Faltan credenciales — usando tabla manual como fallback.
                    }
                  </p>
                }

                <!-- Credential form (always visible in AUTO mode, collapsible in MANUAL) -->
                <details [open]="carrier.mode === 'AUTO'" class="cred-details">
                  <summary class="cred-summary">
                    {{ carrier.mode === 'AUTO' ? 'Credenciales API' : 'Credenciales API (opcional)' }}
                  </summary>
                  <div class="cred-form">
                    <div class="cred-field">
                      <label>Usuario / Email</label>
                      <input
                        type="text"
                        [placeholder]="carrier.hasUsername ? '••••••••' : 'Usuario'"
                        [(ngModel)]="credForms[carrier.carrierCode].apiUsername"
                        [name]="'user_' + carrier.carrierCode" />
                    </div>
                    <div class="cred-field">
                      <label>Contraseña</label>
                      <input
                        type="password"
                        [placeholder]="carrier.hasPassword ? '••••••••' : 'Contraseña'"
                        [(ngModel)]="credForms[carrier.carrierCode].apiPassword"
                        [name]="'pass_' + carrier.carrierCode" />
                    </div>
                    <div class="cred-field">
                      <label>Número de cliente</label>
                      <input
                        type="text"
                        [placeholder]="carrier.hasClientNumber ? '••••••••' : 'Nro. de cuenta / cliente'"
                        [(ngModel)]="credForms[carrier.carrierCode].apiClientNumber"
                        [name]="'client_' + carrier.carrierCode" />
                    </div>
                    <button
                      class="btn-save-creds"
                      [disabled]="savingCarrier() === carrier.carrierCode"
                      (click)="saveCredentials(carrier)">
                      {{ savingCarrier() === carrier.carrierCode ? 'Guardando...' : 'Guardar credenciales' }}
                    </button>
                  </div>
                </details>
              </div>
            }
          </div>
        }
      </div>

      <!-- ══ SECCIÓN 2: TABLA DE TARIFAS MANUALES ══ -->
      <div class="section">
        <div class="section-header">
          <div>
            <h2>Tarifas Manuales</h2>
            <p class="section-subtitle">Precios por provincia para carriers en modo Manual.</p>
          </div>
          <button class="btn-primary" (click)="toggleRateForm()">
            @if (showRateForm()) { Cancelar } @else { + Nueva tarifa }
          </button>
        </div>

        @if (showRateForm()) {
          <div class="form-panel">
            <h3>{{ editingId() ? 'Editar tarifa' : 'Nueva tarifa' }}</h3>
            <form (ngSubmit)="submitRateForm()">
              <div class="form-grid">
                <label>
                  Provincia *
                  <input [(ngModel)]="rateForm().province" name="province" required />
                </label>
                <label>
                  Prefijo CP
                  <input [(ngModel)]="rateForm().postalCodePrefix" name="postalCodePrefix" placeholder="ej: B17" />
                </label>
                <label>
                  Carrier *
                  <input [(ngModel)]="rateForm().carrierName" name="carrierName" required />
                </label>
                <label>
                  Días mín *
                  <input type="number" [(ngModel)]="rateForm().deliveryDaysMin" name="deliveryDaysMin" min="1" required />
                </label>
                <label>
                  Días máx *
                  <input type="number" [(ngModel)]="rateForm().deliveryDaysMax" name="deliveryDaysMax" min="1" required />
                </label>
                <label>
                  Precio (centavos) *
                  <input type="number" [(ngModel)]="rateForm().priceAmount" name="priceAmount" min="0" required />
                </label>
                <label>
                  Umbral envío gratis (centavos)
                  <input type="number" [(ngModel)]="rateForm().freeShippingThreshold" name="freeShippingThreshold" min="0" />
                </label>
              </div>
              <div class="form-actions">
                <button type="submit" class="btn-primary">
                  {{ editingId() ? 'Guardar cambios' : 'Crear tarifa' }}
                </button>
                <button type="button" class="btn-secondary" (click)="toggleRateForm()">Cancelar</button>
              </div>
            </form>
          </div>
        }

        @if (ratesError()) {
          <div class="error-banner">{{ ratesError() }}</div>
        }

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Provincia</th>
                <th>Prefijo CP</th>
                <th>Carrier</th>
                <th>Días</th>
                <th>Precio</th>
                <th>Umbral gratis</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (rate of rates(); track rate.id) {
                <tr [class.inactive]="!rate.active">
                  <td>{{ rate.province }}</td>
                  <td>{{ rate.postalCodePrefix ?? '—' }}</td>
                  <td>{{ rate.carrierName }}</td>
                  <td>{{ rate.deliveryDaysMin }}–{{ rate.deliveryDaysMax }} días</td>
                  <td>{{ formatPrice(rate.priceAmount) }}</td>
                  <td>{{ rate.freeShippingThreshold ? formatPrice(rate.freeShippingThreshold) : '—' }}</td>
                  <td>
                    <span [class]="rate.active ? 'badge-active' : 'badge-inactive'">
                      {{ rate.active ? 'Activo' : 'Inactivo' }}
                    </span>
                  </td>
                  <td class="actions">
                    <button class="btn-icon" (click)="editRate(rate)">Editar</button>
                    @if (rate.active) {
                      <button class="btn-icon btn-danger" (click)="deactivateRate(rate.id)">Desactivar</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" class="empty-row">No hay tarifas cargadas.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .page { padding: 1.5rem; display: flex; flex-direction: column; gap: 2rem; }

    .section { }
    .section h1 { font-size: 1.4rem; font-weight: 700; color: var(--text); margin: 0 0 0.25rem; }
    .section h2 { font-size: 1.15rem; font-weight: 700; color: var(--text); margin: 0 0 0.25rem; }
    .section-subtitle { font-size: 0.85rem; color: var(--text-secondary); margin: 0 0 1.25rem; }
    .section-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1rem; }

    /* CARRIER GRID */
    .carrier-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
    .carrier-card {
      border: 1px solid var(--border); border-radius: 10px; padding: 1.25rem;
      background: var(--bg-card); display: flex; flex-direction: column; gap: 0.85rem;
      transition: opacity 0.2s;
    }
    .carrier-card.disabled { opacity: 0.55; }
    .carrier-header { display: flex; align-items: center; justify-content: space-between; }
    .carrier-info { display: flex; flex-direction: column; gap: 4px; }
    .carrier-name { font-weight: 700; font-size: 0.95rem; color: var(--text); }

    .badge-configured { font-size: 0.7rem; font-weight: 600; padding: 2px 7px; border-radius: 8px; background: var(--success-bg); color: var(--success-text); width: fit-content; }
    .badge-pending    { font-size: 0.7rem; font-weight: 600; padding: 2px 7px; border-radius: 8px; background: var(--warning-bg); color: var(--warning-text); width: fit-content; }

    /* Toggle switch */
    .toggle-switch { position: relative; display: inline-flex; cursor: pointer; }
    .toggle-switch input { opacity: 0; width: 0; }
    .toggle-track {
      display: block; width: 38px; height: 22px; background: var(--border);
      border-radius: 11px; transition: background 0.2s;
    }
    .toggle-track::after {
      content: ''; position: absolute; top: 3px; left: 3px;
      width: 16px; height: 16px; border-radius: 50%; background: var(--bg-card);
      transition: transform 0.2s;
    }
    .toggle-switch input:checked + .toggle-track { background: var(--primary); }
    .toggle-switch input:checked + .toggle-track::after { transform: translateX(16px); }

    /* Mode selector */
    .mode-selector { display: flex; border: 1px solid var(--border); border-radius: 7px; overflow: hidden; }
    .mode-btn {
      flex: 1; padding: 0.4rem; font-size: 0.8rem; font-weight: 600;
      background: var(--bg-card); border: none; cursor: pointer; color: var(--text-secondary);
      transition: background 0.15s, color 0.15s;
    }
    .mode-btn.active { background: var(--primary); color: white; }
    .mode-note { font-size: 0.78rem; color: var(--text-secondary); margin: 0; }

    /* Credential form */
    .cred-details { border-top: 1px solid var(--border); padding-top: 0.75rem; }
    .cred-summary { font-size: 0.8rem; font-weight: 600; color: var(--text); cursor: pointer; list-style: none; }
    .cred-summary::-webkit-details-marker { display: none; }
    .cred-form { display: flex; flex-direction: column; gap: 0.6rem; margin-top: 0.75rem; }
    .cred-field { display: flex; flex-direction: column; gap: 3px; }
    .cred-field label { font-size: 0.73rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
    .cred-field input {
      border: 1px solid var(--border); border-radius: 6px; padding: 0.4rem 0.6rem;
      font-size: 0.85rem; outline: none;
    }
    .cred-field input:focus { border-color: var(--primary); }
    .btn-save-creds {
      align-self: flex-end; padding: 0.4rem 1rem; background: var(--primary); color: white;
      border: none; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer;
    }
    .btn-save-creds:disabled { opacity: 0.55; cursor: not-allowed; }

    /* RATE FORM */
    .form-panel { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; }
    .form-panel h3 { margin: 0 0 1rem; font-size: 1rem; }
    .form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
    .form-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 0.875rem; font-weight: 500; }
    .form-grid input { border: 1px solid var(--border); border-radius: 4px; padding: 0.4rem 0.6rem; font-size: 0.875rem; }
    .form-actions { margin-top: 1rem; display: flex; gap: 0.5rem; }

    /* BUTTONS */
    .btn-primary { background: var(--primary); color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.875rem; font-weight: 600; }
    .btn-primary:disabled { opacity: 0.55; }
    .btn-secondary { background: transparent; border: 1px solid var(--border); padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.875rem; }
    .btn-icon { background: transparent; border: 1px solid var(--border); padding: 0.25rem 0.6rem; border-radius: 4px; cursor: pointer; margin-right: 0.25rem; font-size: 0.82rem; }
    .btn-danger { border-color: var(--danger); color: var(--danger); }

    .error-banner { background: var(--danger-bg); color: var(--danger-text); padding: 0.75rem 1rem; border-radius: 6px; margin-bottom: 0.75rem; font-size: 0.875rem; }
    .loading-text { color: var(--text-secondary); font-size: 0.875rem; }

    /* TABLE */
    .table-wrapper { overflow-x: auto; border: 1px solid var(--border); border-radius: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    thead { background: var(--bg-secondary); }
    th { text-align: left; padding: 0.65rem 1rem; font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--border); white-space: nowrap; }
    td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover { background: var(--bg-secondary); }
    tr.inactive td { opacity: 0.55; }
    .badge-active   { background: var(--success-bg); color: var(--success-text); padding: 2px 8px; border-radius: 9999px; font-size: 0.72rem; font-weight: 700; }
    .badge-inactive { background: var(--bg-secondary); color: var(--text-secondary); padding: 2px 8px; border-radius: 9999px; font-size: 0.72rem; font-weight: 700; }
    .empty-row { text-align: center; color: var(--text-secondary); padding: 2rem; }
    .actions { white-space: nowrap; }
  `],
})
export class AdminShippingComponent implements OnInit {
  private http = inject(HttpClient);
  private readonly ratesUrl   = `${environment.apiUrl}/admin/shipping`;
  private readonly carriersUrl = `${environment.apiUrl}/admin/carriers`;

  // ── Carriers state ──────────────────────────────────────────────────────────
  carriers       = signal<CarrierConfig[]>([]);
  carriersLoading = signal(true);
  savingCarrier  = signal<string | null>(null);

  credForms: Record<string, CarrierCredentialForm> = {
    OCA:                emptyCredForm(),
    ANDREANI:           emptyCredForm(),
    CORREO_ARGENTINO:   emptyCredForm(),
  };

  // ── Rates state ─────────────────────────────────────────────────────────────
  rates      = signal<ShippingRate[]>([]);
  showRateForm = signal(false);
  editingId  = signal<number | null>(null);
  rateForm   = signal<ShippingRateForm>(emptyRateForm());
  ratesError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadCarriers();
    this.loadRates();
  }

  // ── Carriers ────────────────────────────────────────────────────────────────

  loadCarriers(): void {
    this.carriersLoading.set(true);
    this.http.get<CarrierConfig[]>(this.carriersUrl).subscribe({
      next: data => {
        this.carriers.set(data);
        this.carriersLoading.set(false);
      },
      error: () => this.carriersLoading.set(false),
    });
  }

  toggleCarrier(carrier: CarrierConfig): void {
    this.http.put<CarrierConfig>(`${this.carriersUrl}/${carrier.carrierCode}`, {
      enabled: !carrier.enabled,
    }).subscribe({ next: updated => this.updateCarrier(updated) });
  }

  setCarrierMode(carrier: CarrierConfig, mode: 'MANUAL' | 'AUTO'): void {
    if (carrier.mode === mode) return;
    this.http.put<CarrierConfig>(`${this.carriersUrl}/${carrier.carrierCode}`, { mode })
      .subscribe({ next: updated => this.updateCarrier(updated) });
  }

  saveCredentials(carrier: CarrierConfig): void {
    const creds = this.credForms[carrier.carrierCode];
    const payload: Record<string, string> = {};
    if (creds.apiUsername)     payload['apiUsername']     = creds.apiUsername;
    if (creds.apiPassword)     payload['apiPassword']     = creds.apiPassword;
    if (creds.apiClientNumber) payload['apiClientNumber'] = creds.apiClientNumber;

    if (!Object.keys(payload).length) return;

    this.savingCarrier.set(carrier.carrierCode);
    this.http.put<CarrierConfig>(`${this.carriersUrl}/${carrier.carrierCode}`, payload).subscribe({
      next: updated => {
        this.updateCarrier(updated);
        this.credForms[carrier.carrierCode] = emptyCredForm();
        this.savingCarrier.set(null);
      },
      error: () => this.savingCarrier.set(null),
    });
  }

  private updateCarrier(updated: CarrierConfig): void {
    this.carriers.update(list => list.map(c => c.carrierCode === updated.carrierCode ? updated : c));
  }

  // ── Rates ───────────────────────────────────────────────────────────────────

  loadRates(): void {
    this.http.get<ShippingRate[]>(this.ratesUrl).subscribe({
      next: data => this.rates.set(data),
      error: () => this.ratesError.set('Error al cargar las tarifas.'),
    });
  }

  toggleRateForm(): void {
    this.showRateForm.update(v => !v);
    if (!this.showRateForm()) {
      this.editingId.set(null);
      this.rateForm.set(emptyRateForm());
    }
  }

  editRate(rate: ShippingRate): void {
    this.editingId.set(rate.id);
    this.rateForm.set({
      province:             rate.province,
      postalCodePrefix:     rate.postalCodePrefix ?? '',
      carrierName:          rate.carrierName,
      deliveryDaysMin:      rate.deliveryDaysMin,
      deliveryDaysMax:      rate.deliveryDaysMax,
      priceAmount:          rate.priceAmount,
      freeShippingThreshold: rate.freeShippingThreshold,
    });
    this.showRateForm.set(true);
  }

  submitRateForm(): void {
    this.ratesError.set(null);
    const id = this.editingId();
    const req$ = id
      ? this.http.put<ShippingRate>(`${this.ratesUrl}/${id}`, this.rateForm())
      : this.http.post<ShippingRate>(this.ratesUrl, this.rateForm());

    req$.subscribe({
      next: () => { this.toggleRateForm(); this.loadRates(); },
      error: () => this.ratesError.set('Error al guardar la tarifa.'),
    });
  }

  deactivateRate(id: number): void {
    this.http.delete(`${this.ratesUrl}/${id}`).subscribe({
      next: () => this.loadRates(),
      error: () => this.ratesError.set('Error al desactivar la tarifa.'),
    });
  }

  formatPrice(centavos: number): string {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(centavos / 100);
  }
}
