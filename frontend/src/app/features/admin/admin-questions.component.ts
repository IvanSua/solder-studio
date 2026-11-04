import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@env/environment';

interface ProductQuestionsResponse {
  productId: number;
  productName: string;
  productSlug: string;
  productImageUrl: string | null;
  totalQuestions: number;
  pendingQuestions: number;
  answeredQuestions: number;
}

interface QuestionResponse {
  id: number;
  question: string;
  answer: string | null;
  authorName: string;
  answeredByName: string | null;
  createdAt: string;
  answeredAt: string | null;
  productId: number;
  productName: string;
  productSlug: string;
  productImageUrl: string | null;
}

interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

@Component({
  selector: 'app-admin-questions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-questions">
      <div class="page-header">
        <h1>Consultas de Productos</h1>
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
          Completadas
          @if (totalAnsweredCount() > 0) {
            <span class="badge answered">{{ totalAnsweredCount() }}</span>
          }
        </button>
      </div>

      <!-- Pending Products -->
      @if (activeTab() === 'pending') {
        @if (pendingProducts().length === 0) {
          <div class="empty-state">
            <p>No hay consultas pendientes. 🎉</p>
          </div>
        } @else {
          <div class="products-list">
            @for (product of pendingProducts(); track product.productId) {
              <div class="product-card" [class.expanded]="expandedProduct() === product.productId">
                <div class="product-header" (click)="toggleProduct(product.productId)">
                  <div class="product-info">
                    @if (product.productImageUrl) {
                      <img [src]="product.productImageUrl" [alt]="product.productName" class="product-thumb" />
                    } @else {
                      <div class="product-thumb-placeholder">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                      </div>
                    }
                    <div class="product-details">
                      <h3>{{ product.productName }}</h3>
                      <span class="question-count">
                        {{ product.pendingQuestions }} pregunta{{ product.pendingQuestions !== 1 ? 's' : '' }} pendiente{{ product.pendingQuestions !== 1 ? 's' : '' }}
                      </span>
                    </div>
                  </div>
                  <svg class="chevron" [class.open]="expandedProduct() === product.productId"
                       width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>

                @if (expandedProduct() === product.productId) {
                  <div class="questions-list">
                    @for (q of productQuestions()[product.productId] || []; track q.id) {
                      <div class="question-item">
                        <div class="question-content">
                          @if (q.productImageUrl) {
                            <img [src]="q.productImageUrl" [alt]="q.productName" class="q-thumb" />
                          } @else {
                            <div class="q-thumb-placeholder"></div>
                          }
                          <div class="q-info">
                            <p class="q-text">{{ q.question }}</p>
                            <span class="q-meta">{{ q.authorName }} • {{ q.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                          </div>
                        </div>
                        <div class="answer-form">
                          <textarea
                            [(ngModel)]="answerTexts[q.id]"
                            placeholder="Escribí tu respuesta..."
                            rows="2"
                          ></textarea>
                          <button
                            class="btn-answer"
                            (click)="answerQuestion(q.id)"
                            [disabled]="!answerTexts[q.id] || !answerTexts[q.id].trim() || submitting() === q.id"
                          >
                            @if (submitting() === q.id) {
                              Enviando...
                            } @else {
                              Responder
                            }
                          </button>
                        </div>
                      </div>
                    } @empty {
                      <p class="no-questions">No hay preguntas para este producto.</p>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }
      }

      <!-- Answered Products -->
      @if (activeTab() === 'answered') {
        <div class="limit-selector">
          <span style="font-size:0.78rem;color:var(--text-secondary);margin-right:4px">Mostrar últimas:</span>
          @for (n of [5,10,15,20]; track n) {
            <button class="size-btn" [class.active]="limit() === n" (click)="changeLimit(n)">{{ n }}</button>
          }
          @if (totalAnsweredCount() > 0) {
            <span style="font-size:0.78rem;color:var(--text-secondary);margin-left:8px">({{ totalAnsweredCount() }} total)</span>
          }
        </div>

        @if (answeredProducts().length === 0) {
          <div class="empty-state">
            <p>No hay consultas completadas aún.</p>
          </div>
        } @else {
          <div class="products-list">
            @for (product of answeredProducts(); track product.productId) {
              <div class="product-card" [class.expanded]="expandedProduct() === product.productId">
                <div class="product-header" (click)="toggleProduct(product.productId)">
                  <div class="product-info">
                    @if (product.productImageUrl) {
                      <img [src]="product.productImageUrl" [alt]="product.productName" class="product-thumb" />
                    } @else {
                      <div class="product-thumb-placeholder">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                      </div>
                    }
                    <div class="product-details">
                      <h3>{{ product.productName }}</h3>
                      <span class="question-count answered">
                        {{ product.answeredQuestions }} respondida{{ product.answeredQuestions !== 1 ? 's' : '' }}
                      </span>
                    </div>
                  </div>
                  <svg class="chevron" [class.open]="expandedProduct() === product.productId" 
                       width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>

                @if (expandedProduct() === product.productId) {
                  <div class="questions-list">
                    @for (q of productQuestions()[product.productId] || []; track q.id) {
                      <div class="question-item answered">
                        <div class="question-content">
                          @if (q.productImageUrl) {
                            <img [src]="q.productImageUrl" [alt]="q.productName" class="q-thumb" />
                          } @else {
                            <div class="q-thumb-placeholder"></div>
                          }
                          <div class="q-info">
                            <p class="q-text">{{ q.question }}</p>
                            <span class="q-meta">{{ q.authorName }} • {{ q.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                          </div>
                        </div>
                        <div class="answer-block">
                          <strong>Respuesta:</strong>
                          <p>{{ q.answer }}</p>
                          <span class="answered-by">
                            Respondida por {{ q.answeredByName || 'Admin' }}
                            @if (q.answeredAt) {
                              el {{ q.answeredAt | date:'dd/MM/yyyy' }}
                            }
                          </span>
                        </div>
                      </div>
                    } @empty {
                      <p class="no-questions">No hay preguntas para este producto.</p>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .admin-questions {
      padding: 1.5rem;
      width: 100%;
      box-sizing: border-box;
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

    /* Limit Selector */
    .limit-selector {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }

    .size-btn {
      padding: 0.3rem 0.65rem; border: 1px solid var(--border);
      background: var(--bg-secondary); color: var(--text-secondary);
      border-radius: 6px; font-size: 0.78rem; font-weight: 600; cursor: pointer;
    }
    .size-btn.active { background: var(--primary); color: white; border-color: var(--primary); }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 3rem;
      color: var(--text-secondary);
    }

    /* Products List */
    .products-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .product-card {
      background: var(--bg-card);
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      overflow: hidden;
    }

    .product-card.expanded {
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .product-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem;
      cursor: pointer;
      transition: background 0.15s;
    }

    .product-header:hover {
      background: var(--bg-secondary);
    }

    .product-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .product-thumb {
      width: 48px;
      height: 48px;
      object-fit: cover;
      border-radius: 6px;
      background: var(--bg-secondary);
    }

    .product-thumb-placeholder {
      width: 48px;
      height: 48px;
      border-radius: 6px;
      background: var(--bg-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .product-details h3 {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text);
      margin: 0 0 0.25rem;
    }

    .question-count {
      font-size: 0.8rem;
      color: var(--warning-text);
      font-weight: 500;
    }

    .question-count.answered {
      color: var(--success-text);
    }

    .chevron {
      color: var(--text-secondary);
      transition: transform 0.2s;
      flex-shrink: 0;
    }

    .chevron.open {
      transform: rotate(180deg);
    }

    /* Questions List */
    .questions-list {
      border-top: 1px solid var(--border);
      padding: 1rem;
      background: var(--bg-secondary);
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .question-item {
      background: var(--bg-card);
      border-radius: 6px;
      padding: 1rem;
      border: 1px solid var(--border);
    }

    .question-content {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .q-thumb {
      width: 40px;
      height: 40px;
      object-fit: cover;
      border-radius: 4px;
      background: var(--bg-secondary);
      flex-shrink: 0;
    }

    .q-thumb-placeholder {
      width: 40px;
      height: 40px;
      border-radius: 4px;
      background: var(--border);
      flex-shrink: 0;
    }

    .q-info {
      flex: 1;
    }

    .q-text {
      color: var(--text);
      margin: 0 0 0.35rem;
      line-height: 1.4;
    }

    .q-meta {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    /* Answer Form */
    .answer-form {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .answer-form textarea {
      width: 100%;
      padding: 0.6rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-family: inherit;
      font-size: 0.875rem;
      resize: vertical;
      min-height: 60px;
    }

    .answer-form textarea:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(224, 32, 200, 0.1);
    }

    .btn-answer {
      align-self: flex-start;
      background: var(--primary);
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.8rem;
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

    /* Answer Block */
    .answer-block {
      background: var(--success-bg);
      border-radius: 6px;
      padding: 0.75rem;
      margin-top: 0.5rem;
    }

    .answer-block strong {
      color: var(--success-text);
      font-size: 0.8rem;
    }

    .answer-block p {
      color: var(--text);
      margin: 0.35rem 0;
      font-size: 0.9rem;
    }

    .answered-by {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .no-questions {
      color: var(--text-secondary);
      font-size: 0.875rem;
      text-align: center;
      padding: 0.5rem;
    }
  `],
})
export class AdminQuestionsComponent implements OnInit {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  activeTab = signal<'pending' | 'answered'>('pending');
  pendingProducts = signal<ProductQuestionsResponse[]>([]);
  answeredProducts = signal<ProductQuestionsResponse[]>([]);
  expandedProduct = signal<number | null>(null);
  productQuestions = signal<Record<number, QuestionResponse[]>>({});
  submitting = signal<number | null>(null);
  limit = signal(10);

  // Computed: total count of pending questions across all products
  totalPendingCount = computed(() =>
    this.pendingProducts().reduce((sum, p) => sum + p.pendingQuestions, 0)
  );

  // Computed: total count of answered questions across all products
  totalAnsweredCount = computed(() =>
    this.answeredProducts().reduce((sum, p) => sum + p.answeredQuestions, 0)
  );

  answerTexts: Record<number, string> = {};

  ngOnInit(): void {
    this.loadPendingProducts();
    this.loadAnsweredProducts();
  }

  switchTab(tab: 'pending' | 'answered'): void {
    this.activeTab.set(tab);
    this.expandedProduct.set(null);
  }

  loadPendingProducts(): void {
    this.http.get<ProductQuestionsResponse[]>(`${this.apiUrl}/admin/questions/pending`)
      .subscribe({
        next: (data) => this.pendingProducts.set(data),
        error: (err) => console.error('Error loading pending:', err),
      });
  }

  changeLimit(n: number): void {
    this.limit.set(n);
    this.loadAnsweredProducts();
  }

  loadAnsweredProducts(): void {
    const params = new HttpParams().set('limit', this.limit().toString());
    this.http.get<ProductQuestionsResponse[]>(`${this.apiUrl}/admin/questions/answered`, { params })
      .subscribe({
        next: (data) => this.answeredProducts.set(data),
        error: (err) => console.error('Error loading answered:', err),
      });
  }

  toggleProduct(productId: number): void {
    if (this.expandedProduct() === productId) {
      this.expandedProduct.set(null);
    } else {
      this.expandedProduct.set(productId);
      this.loadProductQuestions(productId);
    }
  }

  loadProductQuestions(productId: number): void {
    const params = new HttpParams().set('size', '50');
    this.http.get<Page<QuestionResponse>>(`${this.apiUrl}/admin/questions/product/${productId}`, { params })
      .subscribe({
        next: (data) => {
          this.productQuestions.update(questions => ({
            ...questions,
            [productId]: data.content,
          }));
        },
        error: (err) => console.error('Error loading questions:', err),
      });
  }

  answerQuestion(questionId: number): void {
    const answer = this.answerTexts[questionId]?.trim();
    if (!answer) return;

    this.submitting.set(questionId);

    this.http.patch<QuestionResponse>(
      `${this.apiUrl}/admin/questions/${questionId}/answer`,
      { answer }
    ).subscribe({
      next: (updated) => {
        // Update questions in current list
        const productId = this.expandedProduct();
        if (productId) {
          this.productQuestions.update(questions => ({
            ...questions,
            [productId]: questions[productId].map(q => q.id === questionId ? updated : q),
          }));
        }
        // Reload pending products to update counts
        this.loadPendingProducts();
        this.loadAnsweredProducts();
        // Clear textarea
        delete this.answerTexts[questionId];
        this.submitting.set(null);
      },
      error: (err) => {
        console.error('Error answering:', err);
        this.submitting.set(null);
      },
    });
  }
}
