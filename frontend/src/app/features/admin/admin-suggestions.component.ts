import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';

interface SuggestionResponse {
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

interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

@Component({
  selector: 'app-admin-suggestions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-suggestions">
      <div class="page-header">
        <h1>Buzón de Sugerencias</h1>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button
          class="tab"
          [class.active]="activeTab() === 'pending'"
          (click)="switchTab('pending')"
        >
          Pendientes
          @if (totalPendingCount() > 0) {
            <span class="badge">{{ totalPendingCount() }}</span>
          }
        </button>
        <button
          class="tab"
          [class.active]="activeTab() === 'answered'"
          (click)="switchTab('answered')"
        >
          Respondidas
          @if (totalAnsweredCount() > 0) {
            <span class="badge answered">{{ totalAnsweredCount() }}</span>
          }
        </button>
      </div>

      <!-- Pending Suggestions -->
      @if (activeTab() === 'pending') {
        @if (pendingSuggestions().length === 0) {
          <div class="empty-state">
            <p>No hay sugerencias pendientes. 🎉</p>
          </div>
        } @else {
          <div class="suggestions-list">
            @for (suggestion of pendingSuggestions(); track suggestion.id) {
              <div class="suggestion-card">
                <div class="suggestion-header">
                  <div class="suggestion-info">
                    <h3>{{ suggestion.title }}</h3>
                    <span class="suggestion-meta">
                      Por {{ suggestion.authorName }} • {{ suggestion.voteCount }} votos • {{ suggestion.createdAt | date:'dd/MM/yyyy' }}
                    </span>
                  </div>
                </div>

                @if (suggestion.description) {
                  <p class="suggestion-description">{{ suggestion.description }}</p>
                }

                <div class="answer-form">
                  <textarea
                    [(ngModel)]="answerTexts[suggestion.id]"
                    placeholder="Escribí tu respuesta o comentario..."
                    rows="3"
                  ></textarea>
                  <div class="form-actions">
                    <select [(ngModel)]="statusTexts[suggestion.id]" class="status-select">
                      <option value="open">Abierta</option>
                      <option value="in_progress">En Progreso</option>
                      <option value="implemented">Implementada</option>
                      <option value="rejected">Rechazada</option>
                    </select>
                    <button
                      class="btn-answer"
                      (click)="answerSuggestion(suggestion.id)"
                      [disabled]="!answerTexts[suggestion.id] || !answerTexts[suggestion.id].trim() || submitting() === suggestion.id"
                    >
                      @if (submitting() === suggestion.id) {
                        Enviando...
                      } @else {
                        Responder
                      }
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>

          @if (pendingTotalPages() > 1 || pendingSuggestions().length > 0) {
            <div class="pagination-bar">
              <div class="page-size-btns">
                <span style="font-size:0.78rem;color:var(--text-secondary);margin-right:4px">Mostrar:</span>
                @for (n of [5,10,15,20]; track n) {
                  <button class="size-btn" [class.active]="pageSize() === n" (click)="changePageSize(n)">{{ n }}</button>
                }
              </div>
              <div class="page-controls">
                <button class="btn-page" (click)="prevPendingPage()" [disabled]="pendingPage() === 0">← Anterior</button>
                <span class="page-info">Página {{ pendingPage()+1 }} de {{ pendingTotalPages() }} ({{ pendingTotal() }} total)</span>
                <button class="btn-page" (click)="nextPendingPage()" [disabled]="pendingPage() >= pendingTotalPages()-1">Siguiente →</button>
              </div>
            </div>
          }
        }
      }

      <!-- Answered Suggestions -->
      @if (activeTab() === 'answered') {
        @if (answeredSuggestions().length === 0) {
          <div class="empty-state">
            <p>No hay sugerencias respondidas aún.</p>
          </div>
        } @else {
          <div class="suggestions-list">
            @for (suggestion of answeredSuggestions(); track suggestion.id) {
              <div class="suggestion-card answered">
                <div class="suggestion-header">
                  <div class="suggestion-info">
                    <h3>{{ suggestion.title }}</h3>
                    <span class="suggestion-meta">
                      Por {{ suggestion.authorName }} • {{ suggestion.voteCount }} votos • {{ suggestion.createdAt | date:'dd/MM/yyyy' }}
                    </span>
                    <span class="status-badge" [class]="'status-' + suggestion.status">
                      {{ getStatusLabel(suggestion.status) }}
                    </span>
                  </div>
                  <button class="btn-edit-answer" (click)="startEditAnswer(suggestion)">
                    @if (editingAnswerId() === suggestion.id) { Cancelar } @else { Editar respuesta }
                  </button>
                </div>

                @if (suggestion.description) {
                  <p class="suggestion-description">{{ suggestion.description }}</p>
                }

                @if (editingAnswerId() === suggestion.id) {
                  <div class="answer-form">
                    <textarea
                      [(ngModel)]="editAnswerTexts[suggestion.id]"
                      placeholder="Editar respuesta..."
                      rows="3"
                    ></textarea>
                    <div class="form-actions">
                      <select [(ngModel)]="editStatusTexts[suggestion.id]" class="status-select">
                        <option value="open">Abierta</option>
                        <option value="in_progress">En Progreso</option>
                        <option value="implemented">Implementada</option>
                        <option value="rejected">Rechazada</option>
                      </select>
                      <button
                        class="btn-answer"
                        (click)="saveEditAnswer(suggestion.id)"
                        [disabled]="!(editAnswerTexts[suggestion.id] || '').trim() || submitting() === suggestion.id"
                      >
                        @if (submitting() === suggestion.id) { Guardando... } @else { Guardar cambios }
                      </button>
                    </div>
                  </div>
                } @else {
                  <div class="answer-block">
                    <strong>Respuesta:</strong>
                    <p>{{ suggestion.answer }}</p>
                    <span class="answered-by">
                      Respondida por {{ suggestion.answeredByName || 'Admin' }}
                      @if (suggestion.answeredAt) {
                        el {{ suggestion.answeredAt | date:'dd/MM/yyyy' }}
                      }
                    </span>
                  </div>
                }
              </div>
            }
          </div>

          @if (answeredTotalPages() > 1 || answeredSuggestions().length > 0) {
            <div class="pagination-bar">
              <div class="page-size-btns">
                <span style="font-size:0.78rem;color:var(--text-secondary);margin-right:4px">Mostrar:</span>
                @for (n of [5,10,15,20]; track n) {
                  <button class="size-btn" [class.active]="pageSize() === n" (click)="changePageSize(n)">{{ n }}</button>
                }
              </div>
              <div class="page-controls">
                <button class="btn-page" (click)="prevAnsweredPage()" [disabled]="answeredPage() === 0">← Anterior</button>
                <span class="page-info">Página {{ answeredPage()+1 }} de {{ answeredTotalPages() }} ({{ answeredTotal() }} total)</span>
                <button class="btn-page" (click)="nextAnsweredPage()" [disabled]="answeredPage() >= answeredTotalPages()-1">Siguiente →</button>
              </div>
            </div>
          }
        }
      }
    </div>
  `,
  styles: [`
    .admin-suggestions {
      padding: 1.5rem;
      max-width: 100%;
    }

    .page-header {
      margin-bottom: 1.5rem;
    }

    .page-header h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text);
      margin: 0;
    }

    /* Tabs */
    .tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
      border-bottom: 2px solid var(--border);
      padding-bottom: 0;
    }

    .tab {
      background: none;
      border: none;
      padding: 0.75rem 1.25rem;
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--text-secondary);
      cursor: pointer;
      position: relative;
      transition: color 0.2s;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .tab:hover {
      color: var(--text);
    }

    .tab.active {
      color: var(--primary);
      font-weight: 600;
    }

    .tab.active::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--primary);
    }

    .tab .badge {
      background: var(--warning-bg);
      color: var(--warning-text);
      font-size: 0.75rem;
      padding: 0.15rem 0.5rem;
      border-radius: 9999px;
      font-weight: 600;
    }

    .tab .badge.answered {
      background: var(--success-bg);
      color: var(--success-text);
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 3rem;
      color: var(--text-secondary);
    }

    /* Suggestions List */
    .suggestions-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .suggestion-card {
      background: var(--bg-card);
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      padding: 1.25rem;
    }

    .suggestion-card.answered {
      border-left: 4px solid var(--success);
    }

    .suggestion-header {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;
      margin-bottom: 0.75rem;
    }

    .suggestion-info h3 {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text);
      margin: 0 0 0.35rem;
    }

    .suggestion-meta {
      font-size: 0.8rem;
      color: var(--text-secondary);
    }

    .status-badge {
      display: inline-block;
      font-size: 0.7rem;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      margin-left: 0.5rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .status-open { background: var(--warning-bg); color: var(--warning-text); }
    .status-in_progress { background: var(--bg-secondary); color: var(--primary-dark); }
    .status-implemented { background: var(--success-bg); color: var(--success-text); }
    .status-rejected { background: var(--danger-bg); color: var(--danger-text); }

    .suggestion-description {
      color: var(--text);
      margin: 0 0 1rem;
      line-height: 1.5;
    }

    /* Answer Form */
    .answer-form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .answer-form textarea {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-family: inherit;
      font-size: 0.9rem;
      resize: vertical;
      min-height: 80px;
    }

    .answer-form textarea:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(224, 32, 200, 0.1);
    }

    .form-actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    .status-select {
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 0.875rem;
      background: var(--bg-card);
    }

    .btn-answer {
      background: var(--primary);
      color: white;
      border: none;
      padding: 0.6rem 1.25rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
      transition: background 0.15s;
    }

    .btn-answer:hover:not(:disabled) {
      background: var(--primary-dark);
    }

    .btn-answer:disabled {
      background: var(--text-secondary);
      cursor: not-allowed;
    }

    .btn-edit-answer {
      font-size: 0.75rem; font-weight: 600; padding: 0.3rem 0.7rem;
      background: var(--bg-secondary); color: var(--primary); border: 1px solid var(--border);
      border-radius: 6px; cursor: pointer; white-space: nowrap; flex-shrink: 0;
      transition: border-color 0.15s;
    }
    .btn-edit-answer:hover { border-color: var(--primary); }

    /* Answer Block */
    .answer-block {
      background: var(--success-bg);
      border-radius: 6px;
      padding: 1rem;
      margin-top: 0.75rem;
    }

    .answer-block strong {
      color: var(--success-text);
      font-size: 0.85rem;
    }

    .answer-block p {
      color: var(--text);
      margin: 0.5rem 0;
      font-size: 0.95rem;
      line-height: 1.5;
    }

    .answered-by {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    /* Pagination */
    .pagination-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.85rem 1rem; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: 10px; margin-top: 1rem;
    }
    .page-size-btns { display: flex; gap: 0.4rem; align-items: center; }
    .size-btn {
      padding: 0.3rem 0.65rem; border: 1px solid var(--border);
      background: var(--bg-secondary); color: var(--text-secondary);
      border-radius: 6px; font-size: 0.78rem; font-weight: 600; cursor: pointer;
    }
    .size-btn.active { background: var(--primary); color: white; border-color: var(--primary); }
    .page-controls { display: flex; align-items: center; gap: 0.75rem; }
    .page-info { font-size: 0.82rem; color: var(--text-secondary); }
    .btn-page {
      padding: 0.3rem 0.65rem; border: 1px solid var(--border);
      background: var(--bg-secondary); color: var(--text);
      border-radius: 6px; font-size: 0.78rem; cursor: pointer;
    }
    .btn-page:disabled { opacity: 0.4; cursor: not-allowed; }
  `],
})
export class AdminSuggestionsComponent implements OnInit {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  activeTab = signal<'pending' | 'answered'>('pending');
  pendingSuggestions  = signal<SuggestionResponse[]>([]);
  answeredSuggestions = signal<SuggestionResponse[]>([]);
  submitting = signal<number | null>(null);

  pendingPage       = signal(0);
  answeredPage      = signal(0);
  pageSize          = signal(10);
  pendingTotal      = signal(0);
  pendingTotalPages = signal(0);
  answeredTotal     = signal(0);
  answeredTotalPages = signal(0);

  answerTexts: Record<number, string> = {};
  statusTexts: Record<number, string> = {};

  editingAnswerId = signal<number | null>(null);
  editAnswerTexts: Record<number, string> = {};
  editStatusTexts: Record<number, string> = {};

  totalPendingCount  = computed(() => this.pendingTotal());
  totalAnsweredCount = computed(() => this.answeredTotal());

  ngOnInit(): void {
    this.loadPendingSuggestions();
    this.loadAnsweredSuggestions();
  }

  switchTab(tab: 'pending' | 'answered'): void {
    this.activeTab.set(tab);
  }

  nextPendingPage(): void {
    if (this.pendingPage() < this.pendingTotalPages() - 1) {
      this.pendingPage.update(p => p + 1);
      this.loadPendingSuggestions();
    }
  }

  prevPendingPage(): void {
    if (this.pendingPage() > 0) {
      this.pendingPage.update(p => p - 1);
      this.loadPendingSuggestions();
    }
  }

  nextAnsweredPage(): void {
    if (this.answeredPage() < this.answeredTotalPages() - 1) {
      this.answeredPage.update(p => p + 1);
      this.loadAnsweredSuggestions();
    }
  }

  prevAnsweredPage(): void {
    if (this.answeredPage() > 0) {
      this.answeredPage.update(p => p - 1);
      this.loadAnsweredSuggestions();
    }
  }

  changePageSize(n: number): void {
    this.pageSize.set(n);
    this.pendingPage.set(0);
    this.answeredPage.set(0);
    this.loadPendingSuggestions();
    this.loadAnsweredSuggestions();
  }

  loadPendingSuggestions(): void {
    this.http.get<Page<SuggestionResponse>>(
      `${this.apiUrl}/suggestions/admin/pending/page?page=${this.pendingPage()}&size=${this.pageSize()}`
    ).subscribe({
      next: (data) => {
        this.pendingSuggestions.set(data.content);
        this.pendingTotal.set(data.totalElements);
        this.pendingTotalPages.set(data.totalPages);
        data.content.forEach(s => {
          if (!this.statusTexts[s.id]) {
            this.statusTexts[s.id] = s.status || 'open';
          }
        });
      },
      error: (err) => console.error('Error loading pending:', err),
    });
  }

  loadAnsweredSuggestions(): void {
    this.http.get<Page<SuggestionResponse>>(
      `${this.apiUrl}/suggestions/admin/answered/page?page=${this.answeredPage()}&size=${this.pageSize()}`
    ).subscribe({
      next: (data) => {
        this.answeredSuggestions.set(data.content);
        this.answeredTotal.set(data.totalElements);
        this.answeredTotalPages.set(data.totalPages);
      },
      error: (err) => console.error('Error loading answered:', err),
    });
  }

  answerSuggestion(suggestionId: number): void {
    const answer = this.answerTexts[suggestionId]?.trim();
    if (!answer) return;

    this.submitting.set(suggestionId);

    const body = {
      answer: answer,
      status: this.statusTexts[suggestionId] || 'open'
    };

    this.http.patch<SuggestionResponse>(
      `${this.apiUrl}/suggestions/admin/${suggestionId}/answer`,
      body
    ).subscribe({
      next: () => {
        this.pendingPage.set(0);
        this.answeredPage.set(0);
        this.loadPendingSuggestions();
        this.loadAnsweredSuggestions();
        delete this.answerTexts[suggestionId];
        this.submitting.set(null);
      },
      error: (err) => {
        console.error('Error answering:', err);
        this.submitting.set(null);
      },
    });
  }

  startEditAnswer(suggestion: SuggestionResponse): void {
    if (this.editingAnswerId() === suggestion.id) {
      this.editingAnswerId.set(null);
      return;
    }
    this.editAnswerTexts[suggestion.id] = suggestion.answer ?? '';
    this.editStatusTexts[suggestion.id] = suggestion.status ?? 'open';
    this.editingAnswerId.set(suggestion.id);
  }

  saveEditAnswer(suggestionId: number): void {
    const answer = this.editAnswerTexts[suggestionId]?.trim();
    if (!answer) return;

    this.submitting.set(suggestionId);
    const body = { answer, status: this.editStatusTexts[suggestionId] || 'open' };

    this.http.patch<SuggestionResponse>(
      `${this.apiUrl}/suggestions/admin/${suggestionId}/answer`,
      body
    ).subscribe({
      next: () => {
        this.editingAnswerId.set(null);
        delete this.editAnswerTexts[suggestionId];
        this.submitting.set(null);
        this.loadAnsweredSuggestions();
      },
      error: (err) => {
        console.error('Error updating answer:', err);
        this.submitting.set(null);
      },
    });
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'open': 'Abierta',
      'in_progress': 'En Progreso',
      'implemented': 'Implementada',
      'rejected': 'Rechazada'
    };
    return labels[status] || status;
  }
}
