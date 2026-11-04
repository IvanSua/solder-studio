import { Component, signal, OnInit, inject, PLATFORM_ID, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { SeoService } from '@core/services/seo.service';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';

interface GiftCard {
  id: number;
  code: string;
  initialAmount: number;
  remainingAmount: number;
  currencyCode: string;
  expiresAt: string;
  active: boolean;
  expired: boolean;
  usable: boolean;
  createdAt: string;
  redeemedAt: string | null;
  /** Present only right after purchase, while payment is still pending. */
  checkoutUrl?: string | null;
}

interface PurchaseRequest {
  /** One UUID per purchase attempt — same idempotency pattern as checkout. */
  idempotencyKey: string;
  amount: number;
}

const GIFT_CARD_AMOUNTS = [500, 1000, 2000, 5000, 10000, 20000];

@Component({
  selector: 'app-gift-cards',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gift-cards-page">
      <!-- Hero Section -->
      <section class="hero">
        <div class="hero-content">
          <h1>🎁 Gift Cards</h1>
          <p>Regalá la posibilidad de elegir. Tarjetas de regalo válidas por 1 año para usar en toda la tienda.</p>
          @if (isAuthenticated()) {
            <div class="balance-card">
              <span class="balance-label">Tu saldo disponible</span>
              <span class="balance-amount">{{ formatCurrency(totalBalance()) }}</span>
            </div>
          }
        </div>
      </section>

      <!-- Purchase Section -->
      @if (isAuthenticated()) {
        <section class="purchase-section">
          <h2>Comprar Gift Card</h2>
          <div class="amount-options">
            @for (amount of amounts; track amount) {
              <button 
                class="amount-btn" 
                [class.selected]="selectedAmount() === amount"
                (click)="selectAmount(amount)">
                {{ formatCurrency(amount) }}
              </button>
            }
          </div>
          
          <div class="custom-amount">
            <label for="customAmount">O ingresá otro monto:</label>
            <input 
              type="number" 
              id="customAmount"
              [value]="customAmount()"
              (input)="onCustomAmountChange($event)"
              min="100" 
              max="50000" 
              placeholder="100 - 50.000" />
          </div>

          <button 
            class="purchase-btn" 
            [disabled]="!canPurchase() || purchasing()"
            (click)="purchaseGiftCard()">
            @if (purchasing()) {
              Procesando...
            } @else {
              Comprar Gift Card de {{ formatCurrency(getFinalAmount()) }}
            }
          </button>
        </section>
      } @else {
        <section class="login-prompt">
          <div class="login-content">
            <h2>Iniciá sesión para comprar Gift Cards</h2>
            <p>Registrate o iniciá sesión para comprar y gestionar tus tarjetas de regalo.</p>
            <a href="/auth" class="btn-primary">Iniciar Sesión</a>
          </div>
        </section>
      }

      <!-- My Cards Section -->
      @if (isAuthenticated()) {
        <section class="my-cards-section">
          <h2>Mis Gift Cards</h2>
          
          @if (loading()) {
            <div class="loading">
              <div class="spinner"></div>
            </div>
          } @else if (myCards().length === 0) {
            <div class="empty-state">
              <p>Todavía no tenés Gift Cards. ¡Comprá una arriba!</p>
            </div>
          } @else {
            <div class="cards-grid">
              @for (card of myCards(); track card.id) {
                <div class="gift-card" [class.expired]="card.expired" [class.used]="!card.usable">
                  <div class="card-header">
                    <span class="card-amount">{{ formatCurrency(card.initialAmount) }}</span>
                    <span class="card-status" [class]="getStatusClass(card)">
                      {{ getStatusText(card) }}
                    </span>
                  </div>
                  
                  <div class="card-code">
                    <span class="code-label">Código</span>
                    <span class="code-value">{{ card.code }}</span>
                    <button class="copy-btn" (click)="copyCode(card.code)" title="Copiar código">
                      📋
                    </button>
                  </div>
                  
                  <div class="card-balance">
                    @if (card.usable && !card.expired) {
                      <span class="remaining">Saldo: {{ formatCurrency(card.remainingAmount) }}</span>
                    }
                  </div>
                  
                  <div class="card-footer">
                    <span class="expiry">
                      Vence: {{ formatDate(card.expiresAt) }}
                    </span>
                  </div>
                </div>
              }
            </div>
          }
        </section>
      }

      <!-- Info Section -->
      <section class="info-section">
        <h2>¿Cómo funciona?</h2>
        <div class="info-grid">
          <div class="info-card">
            <div class="info-icon">1</div>
            <h3>Elegí el monto</h3>
            <p>Comprá una Gift Card del valor que prefieras entre $500 y $50.000 ARS.</p>
          </div>
          <div class="info-card">
            <div class="info-icon">2</div>
            <h3>Recibí el código</h3>
            <p>Una vez completada la compra, vas a ver el código de la Gift Card.</p>
          </div>
          <div class="info-card">
            <div class="info-icon">3</div>
            <h3>Usalo en el checkout</h3>
            <p>Ingresá el código al momento de pagar y el saldo se descontará automáticamente.</p>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .gift-cards-page {
      min-height: 100vh;
      background: var(--bg);
    }

    /* Hero */
    .hero {
      background: linear-gradient(135deg, var(--info) 0%, var(--primary) 100%);
      color: white;
      padding: 4rem 2rem;
      text-align: center;
    }
    .hero-content {
      max-width: 600px;
      margin: 0 auto;
    }
    .hero h1 {
      font-size: 3rem;
      font-weight: 800;
      margin: 0 0 1rem;
    }
    .hero p {
      font-size: 1.2rem;
      opacity: 0.9;
      margin: 0 0 2rem;
      line-height: 1.6;
    }
    .balance-card {
      display: inline-block;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 1.25rem 2rem;
      margin-top: 1rem;
    }
    .balance-label {
      display: block;
      font-size: 0.85rem;
      opacity: 0.8;
      margin-bottom: 0.5rem;
    }
    .balance-amount {
      font-size: 2rem;
      font-weight: 700;
    }

    /* Sections */
    section {
      max-width: 1000px;
      margin: 0 auto;
      padding: 3rem 1.5rem;
    }
    h2 {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text);
      margin: 0 0 1.5rem;
      text-align: center;
    }

    /* Purchase Section */
    .purchase-section {
      background: var(--bg-card);
      border-radius: 20px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      margin-top: -2rem;
      position: relative;
      z-index: 10;
      border: 1px solid var(--border);
    }
    .amount-options {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      justify-content: center;
      margin-bottom: 1.5rem;
    }
    .amount-btn {
      padding: 1rem 1.5rem;
      background: var(--bg-secondary);
      border: 2px solid transparent;
      border-radius: 12px;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text);
      cursor: pointer;
      transition: all 0.15s;
    }
    .amount-btn:hover {
      border-color: var(--info);
      color: var(--info);
    }
    .amount-btn.selected {
      background: var(--info);
      color: white;
      border-color: var(--info);
    }

    .custom-amount {
      text-align: center;
      margin-bottom: 1.5rem;
    }
    .custom-amount label {
      display: block;
      font-size: 0.9rem;
      color: var(--text-secondary);
      margin-bottom: 0.5rem;
    }
    .custom-amount input {
      padding: 0.75rem 1rem;
      border: 2px solid var(--border);
      border-radius: 10px;
      font-size: 1rem;
      width: 200px;
      text-align: center;
      background: var(--bg-secondary);
      color: var(--text);
    }
    .custom-amount input:focus {
      outline: none;
      border-color: var(--info);
      background: var(--bg);
    }

    .purchase-btn {
      display: block;
      width: 100%;
      max-width: 400px;
      margin: 0 auto;
      padding: 1rem;
      background: var(--info);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 1.1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .purchase-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(var(--info-rgb, 37,99,235), 0.4);
    }
    .purchase-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Login Prompt */
    .login-prompt {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 20px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      margin-top: -2rem;
      position: relative;
      z-index: 10;
      text-align: center;
    }
    .login-content h2 {
      margin-bottom: 0.75rem;
    }
    .login-content p {
      color: var(--text-secondary);
      margin-bottom: 1.5rem;
    }
    .btn-primary {
      display: inline-block;
      padding: 0.875rem 2rem;
      background: var(--info);
      color: white;
      text-decoration: none;
      border-radius: 10px;
      font-weight: 600;
      transition: background 0.15s;
    }
    .btn-primary:hover {
      filter: brightness(0.9);
    }

    /* My Cards */
    .my-cards-section {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 20px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      margin-top: 2rem;
    }
    .loading {
      text-align: center;
      padding: 3rem;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--border);
      border-top-color: var(--info);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      margin: 0 auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .empty-state {
      text-align: center;
      padding: 2rem;
      color: var(--text-secondary);
    }

    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
    }

    .gift-card {
      background: linear-gradient(135deg, var(--info), var(--primary));
      border-radius: 16px;
      padding: 1.5rem;
      color: white;
      position: relative;
      overflow: hidden;
    }
    .gift-card::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -50%;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
    }
    .gift-card.expired {
      background: linear-gradient(135deg, #9ca3af, #6b7280);
    }
    .gift-card.used {
      background: linear-gradient(135deg, #6b7280, #4b5563);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }
    .card-amount {
      font-size: 1.75rem;
      font-weight: 800;
    }
    .card-status {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.2);
    }
    .card-status.expired {
      background: #ef4444;
    }
    .card-status.used {
      background: #f59e0b;
    }
    .card-status.pending {
      background: #6b7280;
    }
    .card-status.active {
      background: #22c55e;
    }

    .card-code {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
    }
    .code-label {
      font-size: 0.75rem;
      opacity: 0.8;
    }
    .code-value {
      flex: 1;
      font-family: monospace;
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: 1px;
    }
    .copy-btn {
      background: none;
      border: none;
      font-size: 1.25rem;
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.15s;
    }
    .copy-btn:hover {
      opacity: 1;
    }

    .card-balance {
      margin-bottom: 1rem;
    }
    .remaining {
      font-size: 0.9rem;
      opacity: 0.9;
    }

    .card-footer {
      font-size: 0.8rem;
      opacity: 0.7;
    }

    /* Info Section */
    .info-section {
      background: var(--bg-secondary);
      border-radius: 20px;
      margin-top: 2rem;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 2rem;
    }
    .info-card {
      text-align: center;
      padding: 1.5rem;
    }
    .info-icon {
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, var(--info), var(--primary));
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      font-weight: 700;
      color: white;
      margin: 0 auto 1rem;
    }
    .info-card h3 {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text);
      margin: 0 0 0.5rem;
    }
    .info-card p {
      font-size: 0.9rem;
      color: var(--text-secondary);
      margin: 0;
      line-height: 1.5;
    }

    @media (max-width: 640px) {
      .hero h1 {
        font-size: 2rem;
      }
      .amount-btn {
        padding: 0.75rem 1rem;
        font-size: 1rem;
      }
    }
  `],
})
export class GiftCardsComponent implements OnInit {
  private http = inject(HttpClient);
  private seo = inject(SeoService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private readonly apiUrl = environment.apiUrl;

  readonly amounts = GIFT_CARD_AMOUNTS;
  private readonly platformId = inject(PLATFORM_ID);
  readonly isAuthenticated = this.auth.isAuthenticated;

  myCards = signal<GiftCard[]>([]);
  loading = signal(true);
  purchasing = signal(false);
  selectedAmount = signal<number | null>(null);
  customAmount = signal<number | null>(null);
  totalBalance = signal(0);

  canPurchase = computed(() => {
    const amount = this.selectedAmount() || this.customAmount();
    return amount !== null && amount >= 100 && amount <= 50000;
  });

  ngOnInit(): void {
    this.seo.set({
      title: 'Gift Cards - Solder Studio',
      description: 'Comprá gift cards para regalar. Tarjetas de regalo válidas por 1 año para usar en toda la tienda.',
      canonicalPath: '/gift-cards',
    });

    if (this.isAuthenticated()) {
      this.loadMyCards();
      this.loadBalance();
    } else {
      this.loading.set(false);
    }
  }

  private loadMyCards(): void {
    this.loading.set(true);
    this.http.get<GiftCard[]>(`${this.apiUrl}/gift-cards/my-cards`).subscribe({
      next: (cards) => {
        this.myCards.set(cards);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private loadBalance(): void {
    this.http.get<number>(`${this.apiUrl}/gift-cards/my-balance`).subscribe({
      next: (balance) => this.totalBalance.set(balance),
      error: () => {},
    });
  }

  selectAmount(amount: number): void {
    this.selectedAmount.set(amount);
    this.customAmount.set(null);
  }

  onCustomAmountChange(event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    this.customAmount.set(isNaN(value) ? null : value);
    if (value) {
      this.selectedAmount.set(null);
    }
  }

  getFinalAmount(): number {
    return this.selectedAmount() || this.customAmount() || 0;
  }

  /**
   * Gift card purchases go through MercadoPago just like a regular checkout —
   * the card is created inactive ("awaiting payment") and only becomes
   * spendable once the payment webhook confirms it. Reusing the same
   * idempotency pattern as CheckoutComponent so a bad connection can't turn
   * one purchase into several pending (and possibly several paid) cards.
   */
  private getOrCreatePurchaseIdempotencyKey(): string {
    const STORAGE_KEY = 'giftcard_purchase_idempotency_key';
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const key = crypto.randomUUID();
    sessionStorage.setItem(STORAGE_KEY, key);
    return key;
  }

  private clearPurchaseIdempotencyKey(): void {
    sessionStorage.removeItem('giftcard_purchase_idempotency_key');
  }

  purchaseGiftCard(): void {
    const amount = this.getFinalAmount();
    if (!this.canPurchase() || this.purchasing()) return;

    this.purchasing.set(true);
    const request: PurchaseRequest = {
      idempotencyKey: this.getOrCreatePurchaseIdempotencyKey(),
      amount,
    };

    this.http.post<GiftCard>(`${this.apiUrl}/gift-cards/purchase`, request).subscribe({
      next: (card) => {
        this.clearPurchaseIdempotencyKey();
        if (card.checkoutUrl) {
          // Redirect to MercadoPago — the card only becomes usable once the
          // payment is confirmed there (see PaymentWebhookService).
          window.location.href = card.checkoutUrl;
          return;
        }
        // No checkoutUrl (e.g. MP not configured in this environment) — the
        // card still isn't active/spendable yet.
        this.purchasing.set(false);
        this.toast.success('Gift Card creada — pendiente de confirmación de pago.');
        this.selectedAmount.set(null);
        this.customAmount.set(null);
      },
      error: () => {
        this.purchasing.set(false);
        this.toast.error('Error al comprar la Gift Card');
        // Same reasoning as checkout: keep the idempotency key so a retry
        // after a network error doesn't create a second pending card.
      },
    });
  }

  getStatusClass(card: GiftCard): string {
    if (card.expired) return 'expired';
    // Pending payment confirmation (webhook hasn't activated it yet) is a
    // distinct state from "already redeemed" — don't lump them together.
    if (!card.active) return 'pending';
    if (!card.usable) return 'used';
    return 'active';
  }

  getStatusText(card: GiftCard): string {
    if (card.expired) return 'Expirada';
    if (!card.active) return 'Pendiente de pago';
    if (!card.usable) return 'Canjeada';
    return 'Activa';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  copyCode(code: string): void {
    navigator.clipboard.writeText(code).then(() => {
      this.toast.success('Código copiado al portapapeles');
    });
  }
}
