import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProfileService, LoyaltyProfile, PointTransaction } from '@core/services/profile.service';

interface LevelInfo {
  key: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  label: string;
  icon: string;
  minPoints: number;
  discountPercent: number;
  benefits: string[];
}

const LEVELS: LevelInfo[] = [
  {
    key: 'BRONZE',
    label: 'Bronce',
    icon: '🥉',
    minPoints: 0,
    discountPercent: 0,
    benefits: ['Acumulás 1 pt por cada $100 ARS', 'Código de referido', 'Talles guardados'],
  },
  {
    key: 'SILVER',
    label: 'Plata',
    icon: '🥈',
    minPoints: 500,
    discountPercent: 0,
    benefits: ['Todo lo de Bronce', 'Acceso anticipado a lanzamientos', 'Newsletter exclusiva'],
  },
  {
    key: 'GOLD',
    label: 'Oro',
    icon: '🥇',
    minPoints: 2000,
    discountPercent: 5,
    benefits: ['Todo lo de Plata', '5% de descuento automático en cada compra', 'Soporte prioritario'],
  },
  {
    key: 'PLATINUM',
    label: 'Platino',
    icon: '💎',
    minPoints: 5000,
    discountPercent: 10,
    benefits: ['Todo lo de Oro', '10% de descuento automático en cada compra', 'Invitaciones a eventos exclusivos', 'Envío gratis en pedidos > $20.000'],
  },
];

const REASON_LABELS: Record<string, string> = {
  ORDER_DELIVERED: 'Compra completada',
  ORDER_REDEMPTION: 'Canje en checkout',
  REFERRAL_SIGNUP: 'Referido registrado',
  REFERRAL_FIRST_PURCHASE: 'Compra de referido',
  WELCOME_BONUS: 'Bono de bienvenida',
  ADMIN_ADJUSTMENT: 'Ajuste manual',
};

@Component({
  selector: 'app-loyalty',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="loyalty-page">

      @if (loading()) {
        <div class="loading-state">
          <div class="spinner-lg"></div>
          <span>Cargando tu perfil...</span>
        </div>
      } @else {
        @if (profile(); as loy) {

        <!-- ── HERO ────────────────────────────────────────────────────────── -->
        <section class="hero" [attr.data-level]="loy.level">
          <div class="hero-inner">
            <div class="hero-left">
              <div class="hero-level-badge">
                <span class="level-icon">{{ levelIcon(loy.level) }}</span>
                <div>
                  <p class="level-label-small">Tu nivel actual</p>
                  <h1 class="level-name">{{ loy.levelLabel }}</h1>
                </div>
              </div>

              <div class="hero-points">
                <span class="points-number">{{ loy.points | number }}</span>
                <span class="points-label">puntos acumulados</span>
              </div>
            </div>

            <!-- Progress to next level -->
            @if (loy.level !== 'PLATINUM') {
              <div class="hero-right">
                <div class="next-level-info">
                  <span class="next-label">Siguiente nivel</span>
                  <span class="next-name">{{ nextLevelInfo(loy.level)?.label }}</span>
                  <span class="next-icon">{{ nextLevelInfo(loy.level)?.icon }}</span>
                </div>
                <div class="progress-wrap">
                  <div class="progress-track">
                    <div class="progress-fill" [style.width.%]="loy.levelProgress * 100"></div>
                  </div>
                  <div class="progress-meta">
                    <span>{{ loy.points | number }} pts</span>
                    <span class="pts-to-next">Faltan {{ loy.pointsToNextLevel | number }} pts</span>
                    <span>{{ loy.nextLevelPoints | number }} pts</span>
                  </div>
                </div>
                @if (discountForNextLevel(loy.level) > 0) {
                  <p class="unlock-msg">
                    🎯 Desbloqueás {{ discountForNextLevel(loy.level) }}% de descuento automático en todas tus compras
                  </p>
                }
              </div>
            } @else {
              <div class="hero-right platinum-achieved">
                <span class="platinum-star">💎</span>
                <p>¡Sos miembro Platino! El nivel más alto. Disfrutá de todos tus beneficios.</p>
              </div>
            }
          </div>
        </section>

        <!-- ── CURRENT BENEFITS ─────────────────────────────────────────── -->
        <section class="section">
          <h2 class="section-title">Tus beneficios actuales</h2>
          <div class="benefits-grid">
            @for (b of currentBenefits(loy.level); track b) {
              <div class="benefit-card">
                <span class="benefit-check">✓</span>
                <span>{{ b }}</span>
              </div>
            }
          </div>
        </section>

        <!-- ── HOW TO EARN ───────────────────────────────────────────────── -->
        <section class="section">
          <h2 class="section-title">¿Cómo ganás puntos?</h2>
          <div class="earn-grid">
            <div class="earn-card">
              <span class="earn-icon">🛍️</span>
              <strong>Comprá</strong>
              <span>1 pt por cada $100 ARS en pedidos entregados</span>
            </div>
            <div class="earn-card">
              <span class="earn-icon">🔗</span>
              <strong>Referí amigos</strong>
              <span>200 pts cuando tu referido se registra</span>
            </div>
            <div class="earn-card">
              <span class="earn-icon">🎁</span>
              <strong>Primera compra referido</strong>
              <span>Puntos extra cuando tu referido hace su primera compra</span>
            </div>
            <div class="earn-card">
              <span class="earn-icon">⭐</span>
              <strong>Canjealos</strong>
              <span>100 pts = $100 ARS de descuento en tu próximo checkout</span>
            </div>
          </div>
        </section>

        <!-- ── REFERRAL CODE ─────────────────────────────────────────────── -->
        <section class="section">
          <div class="referral-banner">
            <div class="referral-info">
              <h2>🔗 Tu código de referido</h2>
              <p>Compartí tu código y recibís <strong>200 pts</strong> por cada amigo que se registre. Ellos reciben <strong>50 pts</strong> de bienvenida.</p>
              @if (loy.referralCount > 0) {
                <p class="ref-used">Ya usaron tu código: <strong>{{ loy.referralCount }} persona{{ loy.referralCount !== 1 ? 's' : '' }}</strong></p>
              }
            </div>
            <div class="referral-code-box">
              <code class="referral-code">{{ loy.referralCode }}</code>
              <button class="btn-copy" (click)="copyCode(loy.referralCode)">
                @if (codeCopied()) {
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                  Copiado
                } @else {
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  Copiar
                }
              </button>
            </div>
          </div>
        </section>

        <!-- ── LEVEL COMPARISON ─────────────────────────────────────────── -->
        <section class="section">
          <h2 class="section-title">Todos los niveles</h2>
          <div class="levels-grid">
            @for (lvl of allLevels; track lvl.key) {
              <div class="level-card" [class.current]="loy.level === lvl.key" [class.locked]="!isUnlocked(loy.points, lvl.minPoints)">
                <div class="lc-header" [attr.data-level]="lvl.key">
                  <span class="lc-icon">{{ lvl.icon }}</span>
                  <span class="lc-name">{{ lvl.label }}</span>
                  @if (loy.level === lvl.key) {
                    <span class="current-badge">Actual</span>
                  }
                </div>
                <p class="lc-threshold">Desde {{ lvl.minPoints | number }} pts</p>
                @if (lvl.discountPercent > 0) {
                  <p class="lc-discount">{{ lvl.discountPercent }}% off en cada compra</p>
                }
                <ul class="lc-benefits">
                  @for (b of lvl.benefits; track b) {
                    <li>{{ b }}</li>
                  }
                </ul>
              </div>
            }
          </div>
        </section>

        <!-- ── POINTS HISTORY ────────────────────────────────────────────── -->
        <section class="section">
          <h2 class="section-title">Historial de puntos</h2>

          @if (historyLoading()) {
            <div class="history-loading">
              <div class="spinner-sm"></div>
              <span>Cargando historial...</span>
            </div>
          } @else if (pointsHistory().length === 0) {
            <div class="empty-history">
              <span>🌟</span>
              <p>Todavía no tenés movimientos de puntos. ¡Hacé tu primera compra!</p>
              <a routerLink="/" class="btn-primary">Ver productos</a>
            </div>
          } @else {
            <div class="history-table">
              <div class="history-header">
                <span>Descripción</span>
                <span>Fecha</span>
                <span>Puntos</span>
              </div>
              @for (tx of pointsHistory(); track tx.id) {
                <div class="history-row" [class.positive]="tx.amount > 0" [class.negative]="tx.amount < 0">
                  <div class="history-desc">
                    <span class="tx-icon">{{ tx.amount > 0 ? '↑' : '↓' }}</span>
                    <div>
                      <span class="tx-reason">{{ reasonLabel(tx.reason) }}</span>
                      @if (tx.referenceId) {
                        <span class="tx-ref">Pedido #{{ tx.referenceId }}</span>
                      }
                    </div>
                  </div>
                  <span class="tx-date">{{ formatDate(tx.createdAt) }}</span>
                  <span class="tx-amount">{{ tx.amount > 0 ? '+' : '' }}{{ tx.amount }} pts</span>
                </div>
              }
            </div>

            @if (historyTotalPages() > 1) {
              <div class="pagination">
                <button class="page-btn" [disabled]="historyPage() === 0" (click)="changePage(historyPage() - 1)">
                  ‹ Anterior
                </button>
                <span class="page-info">Página {{ historyPage() + 1 }} de {{ historyTotalPages() }}</span>
                <button class="page-btn" [disabled]="historyPage() >= historyTotalPages() - 1" (click)="changePage(historyPage() + 1)">
                  Siguiente ›
                </button>
              </div>
            }
          }
        </section>

        } @else if (!loading()) {
          <div class="error-state">
            <p>No se pudo cargar tu perfil de lealtad.</p>
            <button class="btn-primary" (click)="load()">Reintentar</button>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .loyalty-page {
      max-width: 900px;
      margin: 0 auto;
      padding: 1.5rem 1.5rem 4rem;
    }

    /* Loading */
    .loading-state {
      display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 5rem;
      color: var(--text-muted);
    }
    .spinner-lg {
      width: 36px; height: 36px;
      border: 3px solid var(--border);
      border-top-color: var(--primary);
      border-radius: 50%; animation: spin 0.7s linear infinite;
    }
    .spinner-sm {
      width: 20px; height: 20px;
      border: 2px solid var(--border);
      border-top-color: var(--primary);
      border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* HERO */
    .hero {
      border-radius: 16px; margin-bottom: 2.5rem; padding: 2rem;
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
      color: white;
    }
    .hero[data-level="BRONZE"] { background: linear-gradient(135deg, #78350f 0%, #b45309 100%); }
    .hero[data-level="SILVER"] { background: linear-gradient(135deg, #374151 0%, #6b7280 100%); }
    .hero[data-level="GOLD"]   { background: linear-gradient(135deg, #92400e 0%, #d97706 100%); }
    .hero[data-level="PLATINUM"] { background: linear-gradient(135deg, #312e81 0%, #6d28d9 100%); }

    .hero-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: center; }
    .hero-left { display: flex; flex-direction: column; gap: 1.25rem; }
    .hero-level-badge { display: flex; align-items: center; gap: 1rem; }
    .level-icon { font-size: 2.5rem; line-height: 1; }
    .level-label-small { font-size: 0.75rem; opacity: 0.8; margin: 0; text-transform: uppercase; letter-spacing: 0.08em; }
    .level-name { font-size: 2rem; font-weight: 800; margin: 0; }
    .hero-points { display: flex; flex-direction: column; }
    .points-number { font-size: 3rem; font-weight: 900; line-height: 1; }
    .points-label { font-size: 0.875rem; opacity: 0.8; }

    .hero-right { display: flex; flex-direction: column; gap: 1rem; }
    .next-level-info { display: flex; align-items: center; gap: 0.5rem; }
    .next-label { font-size: 0.75rem; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.05em; }
    .next-name { font-weight: 700; font-size: 1.1rem; }
    .next-icon { font-size: 1.4rem; }

    .progress-wrap { display: flex; flex-direction: column; gap: 0.4rem; }
    .progress-track {
      height: 10px; background: rgba(255,255,255,0.2); border-radius: 5px; overflow: hidden;
    }
    .progress-fill { height: 100%; background: white; border-radius: 5px; transition: width 0.4s ease; }
    .progress-meta { display: flex; justify-content: space-between; font-size: 0.75rem; opacity: 0.8; }
    .pts-to-next { font-weight: 700; }
    .unlock-msg { font-size: 0.82rem; opacity: 0.9; background: rgba(255,255,255,0.15); padding: 0.5rem 0.75rem; border-radius: 8px; margin: 0; }
    .platinum-achieved { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; text-align: center; }
    .platinum-star { font-size: 3.5rem; }
    .platinum-achieved p { font-size: 0.9375rem; opacity: 0.9; margin: 0; }

    /* Sections */
    .section { margin-bottom: 2.5rem; }
    .section-title { font-size: 1.15rem; font-weight: 700; margin: 0 0 1.25rem; color: var(--text); }

    /* Current benefits */
    .benefits-grid { display: flex; flex-wrap: wrap; gap: 0.625rem; }
    .benefit-card {
      display: flex; align-items: center; gap: 0.4rem;
      background: var(--success-bg); border: 1px solid var(--success-border); color: var(--success-text);
      border-radius: 8px; padding: 0.5rem 0.875rem; font-size: 0.875rem;
    }
    .benefit-check { font-weight: 700; color: var(--success); }

    /* Earn grid */
    .earn-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
    .earn-card {
      display: flex; flex-direction: column; gap: 0.25rem;
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 12px; padding: 1.25rem;
    }
    .earn-icon { font-size: 1.75rem; margin-bottom: 0.25rem; }
    .earn-card strong { font-size: 0.9375rem; font-weight: 700; color: var(--text); }
    .earn-card span { font-size: 0.8125rem; color: var(--text-secondary); }

    /* Referral banner */
    .referral-banner {
      display: flex; align-items: center; justify-content: space-between; gap: 2rem;
      background: var(--info-bg);
      border: 1px solid var(--info-border); border-radius: 14px; padding: 1.5rem 2rem;
    }
    .referral-info h2 { font-size: 1.1rem; font-weight: 700; margin: 0 0 0.4rem; }
    .referral-info p { font-size: 0.875rem; color: var(--info-text); margin: 0 0 0.25rem; }
    .ref-used { color: var(--info); font-weight: 600; }
    .referral-code-box { display: flex; flex-direction: column; align-items: center; gap: 0.625rem; flex-shrink: 0; }
    .referral-code {
      font-size: 1.35rem; font-weight: 900; letter-spacing: 0.12em;
      color: var(--info-text); background: var(--bg-card); border: 2px solid var(--info-border);
      border-radius: 10px; padding: 0.5rem 1.25rem; display: block;
    }
    .btn-copy {
      display: flex; align-items: center; gap: 0.35rem;
      background: var(--info); color: white; border: none; border-radius: 8px;
      padding: 0.5rem 1.25rem; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; transition: background 0.15s;
    }
    .btn-copy:hover { background: var(--info-text); }

    /* Levels grid */
    .levels-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
    .level-card {
      border: 2px solid var(--border); border-radius: 14px; overflow: hidden;
      transition: box-shadow 0.15s; background: var(--bg-card);
    }
    .level-card.current { box-shadow: 0 0 0 3px var(--info-bg); border-color: var(--info); }
    .level-card.locked { opacity: 0.6; }
    .lc-header {
      display: flex; align-items: center; gap: 0.4rem;
      padding: 0.875rem 1rem; flex-wrap: wrap;
    }
    .lc-header[data-level="BRONZE"]   { background: var(--warning-bg); }
    .lc-header[data-level="SILVER"]   { background: var(--bg-secondary); }
    .lc-header[data-level="GOLD"]     { background: var(--warning-bg); }
    .lc-header[data-level="PLATINUM"] { background: var(--info-bg); }
    .lc-icon { font-size: 1.35rem; }
    .lc-name { font-weight: 700; font-size: 0.9375rem; flex: 1; }
    .current-badge {
      font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
      background: var(--info); color: white; padding: 2px 6px; border-radius: 4px;
    }
    .lc-threshold { font-size: 0.775rem; color: var(--text-secondary); margin: 0.5rem 1rem 0; }
    .lc-discount { font-size: 0.82rem; font-weight: 700; color: var(--warning-text); margin: 0.25rem 1rem 0; }
    .lc-benefits {
      list-style: none; padding: 0.5rem 1rem 1rem; margin: 0;
      display: flex; flex-direction: column; gap: 0.25rem;
    }
    .lc-benefits li { font-size: 0.775rem; color: var(--text); }
    .lc-benefits li::before { content: '✓ '; color: var(--success); font-weight: 700; }

    /* History */
    .history-loading { display: flex; align-items: center; gap: 0.75rem; color: var(--text-muted); padding: 1rem; }
    .empty-history {
      display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
      padding: 3rem; text-align: center; color: var(--text-muted);
    }
    .empty-history span { font-size: 2rem; }
    .empty-history p { margin: 0; }

    .history-table { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: var(--bg-card); }
    .history-header {
      display: grid; grid-template-columns: 1fr auto auto;
      padding: 0.75rem 1.25rem; background: var(--bg-secondary);
      font-size: 0.775rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.05em; color: var(--text-secondary);
      border-bottom: 1px solid var(--border); gap: 1rem;
    }
    .history-row {
      display: grid; grid-template-columns: 1fr auto auto;
      padding: 0.875rem 1.25rem; gap: 1rem; align-items: center;
      border-bottom: 1px solid var(--border);
      transition: background 0.1s;
    }
    .history-row:last-child { border-bottom: none; }
    .history-row:hover { background: var(--bg-secondary); }
    .history-desc { display: flex; align-items: center; gap: 0.75rem; }
    .tx-icon {
      width: 28px; height: 28px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 0.875rem; flex-shrink: 0;
    }
    .positive .tx-icon { background: var(--success-bg); color: var(--success-text); }
    .negative .tx-icon { background: var(--danger-bg); color: var(--danger-text); }
    .tx-reason { font-size: 0.875rem; font-weight: 600; display: block; color: var(--text); }
    .tx-ref { font-size: 0.775rem; color: var(--text-muted); display: block; }
    .tx-date { font-size: 0.8125rem; color: var(--text-muted); white-space: nowrap; }
    .tx-amount { font-weight: 700; font-size: 0.9375rem; white-space: nowrap; }
    .positive .tx-amount { color: var(--success-text); }
    .negative .tx-amount { color: var(--danger-text); }

    .pagination {
      display: flex; align-items: center; justify-content: center; gap: 1rem;
      margin-top: 1.25rem; font-size: 0.875rem;
    }
    .page-btn {
      padding: 0.4rem 0.875rem; border: 1px solid var(--border);
      border-radius: 8px; background: var(--bg-card); color: var(--text); cursor: pointer; font-size: 0.875rem;
      transition: background 0.15s;
    }
    .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .page-btn:not(:disabled):hover { background: var(--bg-secondary); }
    .page-info { color: var(--text-secondary); }

    /* Misc */
    .btn-primary {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.7rem 1.5rem; background: var(--primary); color: white;
      border: none; border-radius: 8px; font-weight: 600; font-size: 0.9375rem;
      cursor: pointer; text-decoration: none; transition: opacity 0.15s;
    }
    .btn-primary:hover { opacity: 0.9; }
    .error-state { text-align: center; padding: 4rem; display: flex; flex-direction: column; align-items: center; gap: 1rem; }

    /* Responsive */
    @media (max-width: 768px) {
      .hero-inner { grid-template-columns: 1fr; }
      .levels-grid { grid-template-columns: repeat(2, 1fr); }
      .earn-grid { grid-template-columns: 1fr; }
      .referral-banner { flex-direction: column; align-items: flex-start; }
    }
    @media (max-width: 500px) {
      .levels-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class LoyaltyComponent implements OnInit {
  private profileService = inject(ProfileService);

  readonly allLevels = LEVELS;

  profile = signal<LoyaltyProfile | null>(null);
  loading = signal(true);
  codeCopied = signal(false);

  pointsHistory = signal<PointTransaction[]>([]);
  historyLoading = signal(false);
  historyPage = signal(0);
  historyTotal = signal(0);
  readonly PAGE_SIZE = 10;

  historyTotalPages = computed(() => Math.ceil(this.historyTotal() / this.PAGE_SIZE));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.profileService.getLoyalty().subscribe({
      next: p => {
        this.profile.set(p);
        this.loading.set(false);
        this.loadHistory(0);
      },
      error: () => this.loading.set(false),
    });
  }

  loadHistory(page: number): void {
    this.historyLoading.set(true);
    this.profileService.getPointsHistory(page, this.PAGE_SIZE).subscribe({
      next: res => {
        this.pointsHistory.set(res.content);
        this.historyTotal.set(res.totalElements);
        this.historyPage.set(page);
        this.historyLoading.set(false);
      },
      error: () => this.historyLoading.set(false),
    });
  }

  changePage(page: number): void {
    this.loadHistory(page);
  }

  copyCode(code: string): void {
    navigator.clipboard.writeText(code).then(() => {
      this.codeCopied.set(true);
      setTimeout(() => this.codeCopied.set(false), 2000);
    });
  }

  levelIcon(level: string): string {
    return LEVELS.find(l => l.key === level)?.icon ?? '⭐';
  }

  currentBenefits(level: string): string[] {
    const idx = LEVELS.findIndex(l => l.key === level);
    if (idx < 0) return [];
    return LEVELS.slice(0, idx + 1).flatMap(l => l.benefits);
  }

  nextLevelInfo(level: string): LevelInfo | undefined {
    const idx = LEVELS.findIndex(l => l.key === level);
    return idx >= 0 && idx < LEVELS.length - 1 ? LEVELS[idx + 1] : undefined;
  }

  discountForNextLevel(level: string): number {
    return this.nextLevelInfo(level)?.discountPercent ?? 0;
  }

  isUnlocked(points: number, minPoints: number): boolean {
    return points >= minPoints;
  }

  reasonLabel(reason: string): string {
    return REASON_LABELS[reason] ?? reason;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
