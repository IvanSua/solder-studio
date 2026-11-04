import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { environment } from '@env/environment';
import { AuthService } from '@core/services/auth.service';
import { SeoService } from '@core/services/seo.service';

interface Suggestion {
  id: number;
  title: string;
  description: string | null;
  voteCount: number;
  status: string;
  authorName: string;
  hasVoted: boolean;
  createdAt: string;
  answer: string | null;
  answeredByName: string | null;
  answeredAt: string | null;
}

interface SuggestionPage {
  content: Suggestion[];
  totalElements: number;
  totalPages: number;
  number: number;
}

@Component({
  selector: 'app-suggestions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="header-text">
          <h1>Buzón de sugerencias</h1>
          <p>Compartí tus ideas para mejorar la tienda. Votá las que más te gustan.</p>
        </div>
      </div>

      <!-- Submit form (authenticated only) -->
      @if (isAuthenticated()) {
        <div class="submit-card">
          <h2>Enviar una sugerencia</h2>
          <input
            type="text"
            class="input-field"
            [(ngModel)]="newTitle"
            placeholder="Título de tu sugerencia"
            maxlength="200"
          />
          <textarea
            class="textarea-field"
            [(ngModel)]="newDescription"
            placeholder="Describí tu idea (opcional)..."
            rows="3"
          ></textarea>
          @if (submitError()) {
            <p class="error-msg">{{ submitError() }}</p>
          }
          <button
            class="btn-submit"
            (click)="submitSuggestion()"
            [disabled]="!newTitle.trim() || submitting()">
            @if (submitting()) { Enviando... } @else { Enviar sugerencia }
          </button>
        </div>
      } @else {
        <div class="login-prompt">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span><a routerLink="/auth">Iniciá sesión</a> para enviar y votar sugerencias.</span>
        </div>
      }

      <!-- List -->
      <div class="list-header">
        <h2>Sugerencias de la comunidad</h2>
        @if (!loading()) {
          <span class="total-badge">{{ totalElements() }} en total</span>
        }
      </div>

      @if (loading()) {
        <div class="loading-state">
          <div class="spinner"></div>
          <span>Cargando sugerencias...</span>
        </div>
      } @else if (suggestions().length === 0) {
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <p>Todavía no hay sugerencias. ¡Sé el primero en proponer algo!</p>
        </div>
      } @else {
        <div class="suggestions-list">
          @for (s of suggestions(); track s.id) {
            <div class="suggestion-card" [class.voted]="s.hasVoted">
              <div class="vote-col">
                <button
                  class="vote-btn"
                  [class.voted]="s.hasVoted"
                  [disabled]="!isAuthenticated() || votingId() === s.id"
                  (click)="vote(s)"
                  [title]="s.hasVoted ? 'Quitar voto' : 'Votar'"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    [attr.stroke]="s.hasVoted ? 'currentColor' : 'currentColor'"
                    stroke-width="2.5">
                    <polyline points="18 15 12 9 6 15"/>
                  </svg>
                  <span class="vote-count">{{ s.voteCount }}</span>
                </button>
              </div>

              <div class="suggestion-body">
                <div class="suggestion-top">
                  <h3 class="suggestion-title">{{ s.title }}</h3>
                  <span class="status-badge" [class]="'status-' + s.status">{{ statusLabel(s.status) }}</span>
                </div>
                @if (s.description) {
                  <p class="suggestion-desc">{{ s.description }}</p>
                }
                <p class="suggestion-meta">
                  Por {{ s.authorName }} · {{ formatDate(s.createdAt) }}
                </p>
                @if (s.answer) {
                  <div class="answer-block">
                    <div class="answer-header">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      <span>Respuesta del equipo</span>
                    </div>
                    <p class="answer-text">{{ s.answer }}</p>
                    @if (s.answeredByName || s.answeredAt) {
                      <span class="answer-meta">
                        {{ s.answeredByName || 'Admin' }}
                        @if (s.answeredAt) { · {{ formatDate(s.answeredAt) }} }
                      </span>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <!-- Pagination -->
        @if (totalPages() > 1) {
          <div class="pagination">
            <button
              class="page-btn"
              [disabled]="currentPage() === 0"
              (click)="loadPage(currentPage() - 1)">
              ← Anterior
            </button>
            <span class="page-info">Página {{ currentPage() + 1 }} de {{ totalPages() }}</span>
            <button
              class="page-btn"
              [disabled]="currentPage() >= totalPages() - 1"
              (click)="loadPage(currentPage() + 1)">
              Siguiente →
            </button>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .page { max-width: 800px; margin: 0 auto; padding: 2rem 1.25rem; }

    .page-header {
      margin-bottom: 2rem;
    }
    .page-header h1 {
      font-size: 1.75rem; font-weight: 800; color: var(--text); margin: 0 0 0.4rem;
    }
    .page-header p {
      color: var(--text-secondary); font-size: 0.9rem; margin: 0;
    }

    /* Submit form */
    .submit-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px;
      padding: 1.5rem; margin-bottom: 2rem; display: flex; flex-direction: column; gap: 0.75rem;
    }
    .submit-card h2 {
      margin: 0; font-size: 1rem; font-weight: 700; color: var(--text);
    }
    .input-field, .textarea-field {
      width: 100%; padding: 0.6rem 0.85rem; border: 1px solid var(--border); border-radius: 8px;
      font-size: 0.875rem; font-family: inherit; box-sizing: border-box;
      background: var(--bg-secondary); color: var(--text);
      transition: border-color 0.15s, background 0.2s;
    }
    .input-field::placeholder, .textarea-field::placeholder { color: var(--text-secondary); opacity: 0.6; }
    .input-field:focus, .textarea-field:focus { outline: none; border-color: var(--primary); background: var(--bg); }
    .textarea-field { resize: vertical; }
    .error-msg { color: var(--danger); font-size: 0.825rem; margin: 0; }
    .btn-submit {
      align-self: flex-start; padding: 0.55rem 1.25rem;
      background: var(--primary); color: white; border: none; border-radius: 8px;
      font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: background 0.15s;
    }
    .btn-submit:hover:not(:disabled) { background: var(--primary-dark); }
    .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Login prompt */
    .login-prompt {
      display: flex; align-items: center; gap: 0.6rem;
      background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px;
      padding: 1rem 1.25rem; font-size: 0.875rem; color: var(--primary-dark); margin-bottom: 2rem;
    }
    .login-prompt a { color: var(--primary); font-weight: 600; }

    /* List header */
    .list-header {
      display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;
    }
    .list-header h2 { margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text); }
    .total-badge {
      font-size: 0.78rem; background: var(--bg-secondary); color: var(--text-secondary);
      padding: 2px 8px; border-radius: 12px; font-weight: 600;
    }

    /* Loading */
    .loading-state {
      display: flex; align-items: center; gap: 0.75rem; color: var(--text-muted);
      font-size: 0.875rem; padding: 2rem 0;
    }
    .spinner {
      width: 20px; height: 20px; border: 2px solid var(--border);
      border-top-color: var(--primary); border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Empty state */
    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 1rem;
      padding: 3rem 0; color: var(--text-muted); font-size: 0.875rem; text-align: center;
    }

    /* Suggestion cards */
    .suggestions-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .suggestion-card {
      display: flex; gap: 1rem; align-items: flex-start;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px;
      padding: 1.1rem 1.25rem; transition: box-shadow 0.15s, background 0.2s;
    }
    .suggestion-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
    .suggestion-card.voted { border-left: 3px solid var(--primary); }

    /* Vote button */
    .vote-col { flex-shrink: 0; }
    .vote-btn {
      display: flex; flex-direction: column; align-items: center; gap: 0.2rem;
      background: var(--bg-secondary); border: 1.5px solid var(--border); border-radius: 8px;
      padding: 0.5rem 0.6rem; cursor: pointer; min-width: 44px;
      transition: all 0.15s; color: var(--text-secondary);
    }
    .vote-btn:hover:not(:disabled) { background: var(--primary-light); border-color: var(--info-border); color: var(--primary); }
    .vote-btn.voted { background: var(--primary-light); border-color: var(--primary); color: var(--primary); }
    .vote-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .vote-count { font-size: 0.875rem; font-weight: 700; }

    /* Card body */
    .suggestion-body { flex: 1; min-width: 0; }
    .suggestion-top {
      display: flex; align-items: flex-start; gap: 0.75rem;
      justify-content: space-between; margin-bottom: 0.35rem;
    }
    .suggestion-title {
      font-size: 0.95rem; font-weight: 700; color: var(--text); margin: 0;
    }
    .suggestion-desc {
      font-size: 0.85rem; color: var(--text-secondary); margin: 0 0 0.4rem;
      line-height: 1.5;
    }
    .suggestion-meta { font-size: 0.75rem; color: var(--text-muted); margin: 0; }

    /* Answer block */
    .answer-block {
      background: var(--success-bg); border-radius: 8px; padding: 0.75rem 1rem;
      margin-top: 0.6rem; border-left: 3px solid var(--success);
    }
    .answer-header {
      display: flex; align-items: center; gap: 0.4rem;
      font-size: 0.72rem; font-weight: 700; color: var(--success-text);
      text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.4rem;
    }
    .answer-text {
      font-size: 0.875rem; color: var(--text); margin: 0 0 0.35rem; line-height: 1.5;
    }
    .answer-meta {
      font-size: 0.72rem; color: var(--text-secondary);
    }

    /* Status badges */
    .status-badge {
      font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 10px;
      white-space: nowrap; flex-shrink: 0;
    }
    .status-open { background: var(--success-bg); color: var(--success-text); }
    .status-in_progress { background: rgba(var(--primary-rgb, 224,32,200),0.12); color: var(--primary); }
    .status-done { background: var(--bg-secondary); color: var(--text-secondary); }
    .status-rejected { background: var(--danger-bg); color: var(--danger-text); }

    /* Pagination */
    .pagination {
      display: flex; align-items: center; justify-content: center; gap: 1rem;
      margin-top: 1.5rem;
    }
    .page-btn {
      padding: 0.45rem 1rem; border: 1px solid var(--border); border-radius: 8px;
      background: var(--bg-card); font-size: 0.85rem; cursor: pointer; transition: all 0.15s;
      color: var(--text);
    }
    .page-btn:hover:not(:disabled) { background: var(--bg-secondary); }
    .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .page-info { font-size: 0.85rem; color: var(--text-secondary); }
  `],
})
export class SuggestionsComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private seo = inject(SeoService);
  private readonly apiUrl = environment.apiUrl;

  isAuthenticated = this.authService.isAuthenticated;

  suggestions = signal<Suggestion[]>([]);
  loading = signal(true);
  totalElements = signal(0);
  totalPages = signal(1);
  currentPage = signal(0);
  votingId = signal<number | null>(null);

  // Form
  newTitle = '';
  newDescription = '';
  submitting = signal(false);
  submitError = signal('');

  ngOnInit(): void {
    this.seo.set({
      title: 'Sugerencias',
      description: 'Envianos tus ideas y sugerencias para mejorar Solder Studio. Votá las propuestas de la comunidad.',
      canonicalPath: '/sugerencias',
    });
    this.loadPage(0);
  }

  loadPage(page: number): void {
    this.loading.set(true);
    this.http.get<SuggestionPage>(`${this.apiUrl}/suggestions?page=${page}&size=15&sort=voteCount,desc`).subscribe({
      next: (data) => {
        this.suggestions.set(data.content);
        this.totalElements.set(data.totalElements);
        this.totalPages.set(data.totalPages);
        this.currentPage.set(data.number);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  submitSuggestion(): void {
    const title = this.newTitle.trim();
    if (!title) return;
    this.submitting.set(true);
    this.submitError.set('');
    this.http.post<Suggestion>(`${this.apiUrl}/suggestions`, {
      title,
      description: this.newDescription.trim() || null,
    }).subscribe({
      next: (s) => {
        this.suggestions.update(list => [s, ...list]);
        this.totalElements.update(n => n + 1);
        this.newTitle = '';
        this.newDescription = '';
        this.submitting.set(false);
      },
      error: (err) => {
        this.submitting.set(false);
        this.submitError.set(err?.error?.error || 'Error al enviar la sugerencia.');
      },
    });
  }

  vote(suggestion: Suggestion): void {
    if (!this.isAuthenticated() || this.votingId() === suggestion.id) return;
    this.votingId.set(suggestion.id);
    this.http.post<Suggestion>(`${this.apiUrl}/suggestions/${suggestion.id}/vote`, {}).subscribe({
      next: (updated) => {
        this.suggestions.update(list =>
          list.map(s => s.id === updated.id ? updated : s)
        );
        this.votingId.set(null);
      },
      error: () => this.votingId.set(null),
    });
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      open: 'Abierta',
      in_progress: 'En progreso',
      done: 'Implementada',
      rejected: 'Rechazada',
    };
    return labels[status] ?? status;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-AR', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }
}
