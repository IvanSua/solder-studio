import { Component, OnInit, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { ProductService } from '@core/services/product.service';
import { CartService } from '@core/services/cart.service';
import { AuthService } from '@core/services/auth.service';
import { WishlistService } from '@core/services/wishlist.service';
import { RecentlyViewedService } from '@core/services/recently-viewed.service';
import { SeoService } from '@core/services/seo.service';
import { ProfileService, SavedSize } from '@core/services/profile.service';
import { Product, ProductVariant, ProductImage } from '@core/models/product.model';
import { PricePipe } from '@shared/pipes/price.pipe';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface SizeGuideRow {
  size: string;
  chest: number;
  waist: number;
  hip: number;
}

interface SizeGuideResponse {
  id: number;
  categoryId: number;
  categoryName: string;
  name: string;
  sizes: string[];
  measurements: Partial<Record<string, Partial<Record<string, string>>>>;
  instructions: string | null;
}

interface ReviewSummary {
  averageRating: number | null;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  reviews: Array<{ id: number; rating: number; title: string | null; body: string | null; authorName: string; verifiedPurchase: boolean; createdAt: string; }>;
  userHasReviewed: boolean;
}

interface QAItem {
  id: number;
  question: string;
  answer: string | null;
  authorName: string;
  createdAt: string;
  answeredAt: string | null;
}

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, PricePipe],
  template: `
    <div class="page">

      <!-- Back link -->
      <a routerLink="/" class="back-link">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Volver al catálogo
      </a>

      @if (loading()) {
        <div class="skeleton-wrap">
          <div class="skeleton-img"></div>
          <div class="skeleton-info">
            <div class="skeleton-line w60"></div>
            <div class="skeleton-line w40"></div>
            <div class="skeleton-line w80"></div>
          </div>
        </div>
      }

      @if (errorMessage()) {
        <div class="alert-error">{{ errorMessage() }}</div>
      }

      @if (product() && !loading()) {
        <div class="product-layout">

          <!-- ── Image gallery ────────────────────────────────────── -->
          <div class="gallery">
            <div class="main-image-container"
                 (mousemove)="onImageMouseMove($event)"
                 (mouseleave)="onImageMouseLeave()"
                 (touchstart)="onTouchStart($event)"
                 (touchmove)="onTouchMove($event)"
                 (touchend)="onTouchEnd()"
                 [class.zoomed]="isZoomed()"
            >
              <div class="main-image"
                   [class.clickable]="activeImage()"
                   [class.zoomed]="isZoomed()"
                   [style.transform]="getImageTransform()"
                   (click)="toggleZoom($event)"
              >
                @if (activeImage()) {
                  <img [src]="activeImage()!.imageUrl" [alt]="activeImage()!.altText || product()!.name" draggable="false" loading="eager" />
                } @else {
                  <div class="no-image">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                }
              </div>

              <!-- Zoom controls -->
              @if (activeImage()) {
                <div class="zoom-controls">
                  <button class="zoom-btn" (click)="zoomOut(); $event.stopPropagation()" [disabled]="zoomLevel() <= 1" title="Alejar">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      <line x1="8" y1="11" x2="14" y2="11"/>
                    </svg>
                  </button>
                  <span class="zoom-level">{{ Math.round(zoomLevel() * 100) }}%</span>
                  <button class="zoom-btn" (click)="zoomIn(); $event.stopPropagation()" [disabled]="zoomLevel() >= 4" title="Acercar">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                    </svg>
                  </button>
                  @if (isZoomed()) {
                    <button class="zoom-btn reset" (click)="resetZoom(); $event.stopPropagation()" title="Restablecer">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="1 4 1 10 7 10"/>
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                      </svg>
                    </button>
                  }
                </div>
              }
            </div>

            @if (product()!.images.length > 1) {
              <div class="thumbnails">
                @for (img of product()!.images; track img.id) {
                  <button
                    class="thumb"
                    [class.active]="activeImage()?.id === img.id"
                    (click)="selectImage(img)"
                  >
                    <img [src]="img.imageUrl" [alt]="img.altText || product()!.name" loading="lazy" />
                  </button>
                }
              </div>
            }
          </div>

          <!-- ── Product info ─────────────────────────────────────── -->
          <div class="info">

            @if (product()!.categoryName) {
              <span class="category-tag">{{ product()!.categoryName }}</span>
            }

            <h1 class="product-name">{{ product()!.name }}</h1>

            @if (selectedVariant()) {
              <div class="price">
                {{ selectedVariant()!.priceAmount | price: selectedVariant()!.currencyCode }}
              </div>
            }

            <p class="description">{{ product()!.description }}</p>

            <!-- Color selector -->
            @if (colors().length > 0) {
              <div class="selector-group">
                <div class="selector-label">
                  Color: <strong>{{ selectedColor() }}</strong>
                </div>
                <div class="color-buttons">
                  @for (c of colors(); track c) {
                    <button
                      class="color-btn"
                      [class.selected]="selectedColor() === c"
                      (click)="selectColor(c)"
                    >{{ c }}</button>
                  }
                </div>
              </div>
            }

            <!-- Size selector -->
            @if (sizesForColor().length > 0) {
              <div class="selector-group">
                <div class="selector-label-row">
                  <span>Talle</span>
                  <button class="btn-size-guide" (click)="openSizeGuide()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    Guía de tallas
                  </button>
                </div>
                <div class="size-buttons">
                  @for (s of sizesForColor(); track s.id) {
                    <button
                      class="size-btn"
                      [class.selected]="selectedVariant()?.id === s.id"
                      [class.out-of-stock]="s.stockAvailable === 0"
                      [disabled]="s.stockAvailable === 0"
                      (click)="selectVariant(s)"
                    >
                      {{ s.size }}
                      @if (isFavoriteSize(s.size)) {
                        <span class="favorite-star">★</span>
                      }
                    </button>
                  }
                </div>
                <!-- Favorite size button -->
                @if (isAuthenticated() && selectedVariant() && selectedVariant()!.stockAvailable > 0) {
                  <button 
                    class="btn-favorite-size"
                    [class.saved]="isCurrentFavorite()"
                    (click)="toggleFavoriteSize()"
                    [disabled]="savingFavorite()"
                  >
                    @if (savingFavorite()) {
                      Guardando...
                    } @else if (isCurrentFavorite()) {
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                      </svg>
                      Talle favorito guardado
                    } @else {
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                      Guardar como talle favorito
                    }
                  </button>
                }
              </div>
            }

            <!-- Stock indicator -->
            @if (selectedVariant()) {
              <div class="stock-info" [class.low]="selectedVariant()!.stockAvailable <= 5" [class.out]="selectedVariant()!.stockAvailable === 0">
                @if (selectedVariant()!.stockAvailable === 0) {
                  Sin stock
                } @else if (selectedVariant()!.stockAvailable <= 5) {
                  ¡Solo {{ selectedVariant()!.stockAvailable }} disponibles!
                } @else {
                  En stock
                }
              </div>

              <!-- Notify-me banner for out-of-stock variants -->
              @if (selectedVariant()!.stockAvailable === 0) {
                <div class="notify-banner">
                  @if (!wishlisted()) {
                    <p class="notify-hint">
                      🔔 ¿Querés que te avisemos cuando vuelva el stock?
                    </p>
                    <button class="btn-notify" (click)="toggleWishlist()">
                      Avisame cuando esté disponible
                    </button>
                  } @else {
                    <p class="notify-active">
                      ✓ Te avisaremos cuando vuelva el stock de esta variante
                    </p>
                  }
                </div>
              }
            }

            @if (addedMessage()) {
              <div class="added-msg">✓ {{ addedMessage() }}</div>
            }
            @if (errorMessage()) {
              <div class="alert-error small">{{ errorMessage() }}</div>
            }

            <!-- Action buttons -->
            <div class="actions">
              <button
                class="btn-cart"
                [disabled]="!selectedVariant() || selectedVariant()!.stockAvailable === 0 || addingToCart()"
                (click)="addToCart()"
              >
                @if (addingToCart()) {
                  Agregando...
                } @else {
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                  </svg>
                  Agregar al carrito
                }
              </button>

              <button
                class="btn-wishlist"
                [class.wishlisted]="wishlisted()"
                (click)="toggleWishlist()"
                [title]="wishlisted() ? 'Quitar de favoritos' : 'Agregar a favoritos'"
              >
                @if (wishlisted()) {
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                } @else {
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                }
              </button>

              @if (product()!.customizable && selectedVariant()) {
                <button
                  class="btn-customize"
                  (click)="goToCustomizer()"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                  Personalizar
                </button>
              }
            </div>

          </div>
        </div>

        <!-- ── Recommendations section ────────────────────────────── -->
        @if (recommendations().length > 0) {
          <div class="recommendations-section">
            <h2 class="section-title">También te puede gustar</h2>
            <p class="recommendations-subtitle">Basado en tus intereses y compras similares</p>
            <div class="recommendations-scroll">
              @for (rec of recommendations(); track rec.id) {
                <a [routerLink]="['/producto', rec.slug]" class="recommendation-item">
                  <div class="rec-image">
                    @if (rec.images && rec.images.length > 0) {
                      <img [src]="rec.images[0].imageUrl" [alt]="rec.name" loading="lazy" />
                    } @else {
                      <div class="no-image-placeholder">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                      </div>
                    }
                  </div>
                  <div class="rec-info">
                    <p class="rec-name">{{ rec.name }}</p>
                    <p class="rec-price">
                      {{ rec.variants[0].priceAmount | price: rec.variants[0].currencyCode }}
                    </p>
                  </div>
                </a>
              }
            </div>
          </div>
        }

        <!-- ── Reviews section ────────────────────────────────────── -->
        <div class="reviews-section">
          <div class="section-header-row">
            <h2 class="section-title">Reseñas</h2>
            @if (reviewSummary()) {
              <span class="reviews-count">{{ reviewSummary()!.totalReviews }} reseñas</span>
            }
          </div>

          @if (reviewSummary(); as summary) {
            <!-- Rating overview -->
            <div class="rating-overview">
              <div class="rating-big">
                <span class="rating-number">{{ summary.averageRating?.toFixed(1) ?? '—' }}</span>
                <div class="stars-row">{{ starsDisplay(summary.averageRating) }}</div>
              </div>
              <div class="rating-bars">
                @for (entry of ratingEntries(summary.ratingDistribution); track entry.rating) {
                  <div class="rating-bar-row">
                    <span class="bar-label">{{ entry.rating }}★</span>
                    <div class="bar-track">
                      <div class="bar-fill" [style.width.%]="summary.totalReviews > 0 ? (entry.count / summary.totalReviews) * 100 : 0"></div>
                    </div>
                    <span class="bar-count">{{ entry.count }}</span>
                  </div>
                }
              </div>
            </div>

            <!-- Write review form -->
            @if (isAuthenticated() && !summary.userHasReviewed) {
              <div class="review-form-card">
                <h3>Dejá tu reseña</h3>
                <div class="star-picker">
                  @for (s of [1,2,3,4,5]; track s) {
                    <button
                      type="button"
                      class="star-btn"
                      [class.active]="newReviewRating() >= s"
                      (click)="newReviewRating.set(s)">★</button>
                  }
                </div>
                <input
                  type="text"
                  class="review-input"
                  [(ngModel)]="newReviewTitle"
                  placeholder="Título (opcional)"
                  maxlength="150"
                />
                <textarea
                  class="review-textarea"
                  [(ngModel)]="newReviewBody"
                  placeholder="Contanos tu experiencia con el producto..."
                  rows="3"
                ></textarea>
                @if (reviewError()) {
                  <p class="review-error">{{ reviewError() }}</p>
                }
                <button
                  class="btn-submit-review"
                  (click)="submitReview()"
                  [disabled]="newReviewRating() === 0 || submittingReview()">
                  @if (submittingReview()) { Enviando... } @else { Publicar reseña }
                </button>
              </div>
            }

            @if (isAuthenticated() && summary.userHasReviewed) {
              <p class="already-reviewed">✓ Ya dejaste tu reseña en este producto.</p>
            }

            <!-- Reviews list -->
            @if (summary.reviews.length > 0) {
              <div class="reviews-list">
                @for (review of summary.reviews; track review.id) {
                  <div class="review-card">
                    <div class="review-header">
                      <div class="review-meta">
                        <span class="reviewer-name">{{ review.authorName }}</span>
                        @if (review.verifiedPurchase) {
                          <span class="verified-badge">✓ Compra verificada</span>
                        }
                      </div>
                      <div class="review-stars">{{ starsDisplay(review.rating) }}</div>
                    </div>
                    @if (review.title) {
                      <p class="review-title">{{ review.title }}</p>
                    }
                    @if (review.body) {
                      <p class="review-body">{{ review.body }}</p>
                    }
                    <p class="review-date">{{ formatDate(review.createdAt) }}</p>
                  </div>
                }
              </div>
            } @else {
              <p class="no-reviews">Todavía no hay reseñas. ¡Sé el primero!</p>
            }
          } @else {
            <div class="reviews-loading">Cargando reseñas...</div>
          }
        </div>

        <!-- ── Q&A section ──────────────────────────────────────────── -->
        <div class="qa-section">
          <h2 class="section-title">Preguntas y respuestas</h2>

          <!-- Ask a question -->
          @if (isAuthenticated()) {
            <div class="ask-form">
              <input
                type="text"
                class="qa-input"
                [(ngModel)]="newQuestion"
                placeholder="Hacé tu pregunta sobre este producto..."
                (keyup.enter)="submitQuestion()"
              />
              <button
                class="btn-ask"
                (click)="submitQuestion()"
                [disabled]="!newQuestion.trim() || submittingQuestion()">
                @if (submittingQuestion()) { Enviando... } @else { Preguntar }
              </button>
            </div>
          } @else {
            <p class="qa-login-prompt">
              <a routerLink="/auth">Iniciá sesión</a> para hacer una pregunta.
            </p>
          }

          <!-- Questions list -->
          <div class="questions-list">
            @if (questionsLoading()) {
              <p class="qa-loading">Cargando preguntas...</p>
            } @else if (questions().length === 0) {
              <p class="no-questions">Todavía no hay preguntas. ¡Sé el primero en preguntar!</p>
            } @else {
              @for (q of questions(); track q.id) {
                <div class="question-card">
                  <div class="question-row">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <span class="question-text">{{ q.question }}</span>
                    <span class="question-author">— {{ q.authorName }}</span>
                  </div>
                  @if (q.answer) {
                    <div class="answer-row">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      <span class="answer-text">{{ q.answer }}</span>
                    </div>
                  } @else {
                    <p class="pending-answer">Sin respuesta todavía</p>
                  }
                </div>
              }
            }
          </div>
        </div>

      }

      <!-- ── Image Lightbox ──────────────────────────────────────── -->
      @if (lightboxOpen()) {
        <div class="lightbox" (click)="closeLightbox()">
          <div class="lightbox-controls">
            <button class="lightbox-close" (click)="closeLightbox()">✕</button>
            <div class="lightbox-zoom-controls">
              <button class="zoom-btn" (click)="zoomOut(); $event.stopPropagation()" [disabled]="zoomLevel() <= 1" title="Alejar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  <line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
              </button>
              <span class="zoom-level">{{ Math.round(zoomLevel() * 100) }}%</span>
              <button class="zoom-btn" (click)="zoomIn(); $event.stopPropagation()" [disabled]="zoomLevel() >= 4" title="Acercar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
              </button>
              @if (isZoomed()) {
                <button class="zoom-btn reset" (click)="resetZoom(); $event.stopPropagation()" title="Restablecer">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="1 4 1 10 7 10"/>
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                  </svg>
                </button>
              }
            </div>
          </div>
          <div class="lightbox-image-container"
               (mousemove)="onImageMouseMove($event)"
               (mouseleave)="onImageMouseLeave()"
               (touchstart)="onTouchStart($event)"
               (touchmove)="onTouchMove($event)"
               (touchend)="onTouchEnd()"
               [class.zoomed]="isZoomed()"
               (click)="$event.stopPropagation()"
          >
            <img [src]="activeImage()!.imageUrl"
                 [alt]="activeImage()!.altText || product()!.name"
                 [style.transform]="getImageTransform()"
                 draggable="false"
                 loading="eager" />
          </div>
        </div>
      }

      <!-- ── Size Guide Modal ────────────────────────────────────── -->
      @if (sizeGuideOpen()) {
        <div class="modal-overlay" (click)="closeSizeGuide()">
          <div class="modal-content" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2>Guía de Talles</h2>
              <button class="modal-close" (click)="closeSizeGuide()">✕</button>
            </div>
            <div class="modal-body">
              @if (sizeGuideData().length > 0) {
                @for (guide of sizeGuideData(); track guide.id) {
                  <div class="guide-section">
                    <h3>{{ guide.name }}</h3>
                    @if (guide.instructions) {
                      <p class="guide-instructions">{{ guide.instructions }}</p>
                    }
                    <table class="size-guide-table">
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
                }
              } @else {
                <p class="guide-loading">Cargando guía de talles...</p>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page { max-width: 1100px; margin: 0 auto; padding: 1.5rem 1.25rem; }

    .back-link {
      display: inline-flex; align-items: center; gap: 0.3rem;
      color: var(--text-secondary); font-size: 0.85rem;
      text-decoration: none; margin-bottom: 1.5rem;
      transition: color .15s;
    }
    .back-link:hover { color: var(--primary); }

    /* Skeleton */
    .skeleton-wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem; }
    .skeleton-img { background: var(--bg-secondary); border-radius: 12px; aspect-ratio: 1; animation: pulse 1.5s infinite; }
    .skeleton-info { display: flex; flex-direction: column; gap: 0.75rem; padding-top: 0.5rem; }
    .skeleton-line { height: 18px; background: var(--bg-secondary); border-radius: 6px; animation: pulse 1.5s infinite; }
    .skeleton-line.w60 { width: 60%; }
    .skeleton-line.w40 { width: 40%; }
    .skeleton-line.w80 { width: 80%; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }

    /* Layout */
    .product-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: start; }
    @media (max-width: 700px) {
      .product-layout { grid-template-columns: 1fr; gap: 1.5rem; }
    }

    /* Gallery */
    .gallery { display: flex; flex-direction: column; gap: 0.75rem; }
    .main-image-container {
      position: relative;
      width: 100%; aspect-ratio: 1;
    }
    .main-image-container.zoomed { cursor: grab; }
    .main-image-container.zoomed:active { cursor: grabbing; }
    .main-image {
      width: 100%; height: 100%; border-radius: 12px; overflow: hidden;
      background: var(--bg-secondary); border: 1px solid var(--border);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.1s ease-out;
    }
    .main-image.clickable { cursor: zoom-in; }
    .main-image.zoomed {
      cursor: grab;
      transform-origin: center center;
    }
    .main-image.zoomed:active { cursor: grabbing; }
    .main-image img {
      width: 100%; height: 100%; object-fit: cover;
      pointer-events: none;
      user-select: none;
      -webkit-user-drag: none;
    }
    .no-image { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }

    /* Zoom controls */
    .zoom-controls {
      position: absolute; bottom: 0.75rem; right: 0.75rem;
      display: flex; align-items: center; gap: 0.25rem;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 8px; padding: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      backdrop-filter: blur(4px);
      z-index: 10;
    }
    .zoom-btn {
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 6px; cursor: pointer;
      color: var(--text); transition: all 0.15s;
    }
    .zoom-btn:hover:not(:disabled) {
      background: var(--bg-secondary); border-color: var(--border);
    }
    .zoom-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .zoom-btn.reset { margin-left: 0.25rem; }
    .zoom-level {
      font-size: 0.7rem; font-weight: 600; color: var(--text-secondary);
      min-width: 36px; text-align: center;
    }

    .thumbnails { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .thumb {
      width: 64px; height: 64px; border-radius: 8px; overflow: hidden;
      border: 2px solid transparent; padding: 0; cursor: pointer;
      background: var(--bg-secondary); transition: border-color .15s;
    }
    .thumb.active { border-color: var(--primary); }
    .thumb img { width: 100%; height: 100%; object-fit: cover; }

    /* Info */
    .info { display: flex; flex-direction: column; gap: 1rem; }
    .category-tag {
      display: inline-block; background: var(--info-bg); color: var(--info-text);
      font-size: 0.75rem; font-weight: 600; padding: 2px 10px; border-radius: 12px;
    }
    .product-name { font-size: 1.6rem; font-weight: 700; margin: 0; line-height: 1.25; color: var(--text); }
    .price { font-size: 1.5rem; font-weight: 700; color: var(--primary); }
    .description { color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6; margin: 0; }

    /* Selectors */
    .selector-group { display: flex; flex-direction: column; gap: 0.5rem; }
    .selector-label { font-size: 0.82rem; font-weight: 600; color: var(--text); }
    .selector-label-row {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 0.82rem; font-weight: 600; color: var(--text); gap: 0.5rem;
    }
    .color-buttons, .size-buttons { display: flex; flex-wrap: wrap; gap: 0.4rem; }

    .color-btn {
      padding: 0.35rem 0.85rem; border: 1.5px solid var(--border);
      border-radius: 20px; font-size: 0.82rem; background: var(--bg-card); cursor: pointer;
      transition: all .15s;
    }
    .color-btn.selected { border-color: var(--primary); background: var(--primary-light); color: var(--primary); font-weight: 600; }

    .size-btn {
      min-width: 44px; height: 44px; padding: 0 0.75rem;
      border: 1.5px solid var(--border); border-radius: 8px;
      font-size: 0.85rem; background: var(--bg-card); cursor: pointer; transition: all .15s;
    }
    .size-btn.selected { border-color: var(--primary); background: var(--primary); color: white; font-weight: 600; }
    .size-btn.out-of-stock { opacity: 0.35; cursor: not-allowed; text-decoration: line-through; }

    .btn-size-guide {
      background: none; border: none; color: var(--primary);
      font-size: 0.75rem; font-weight: 600; cursor: pointer; padding: 0.25rem 0.5rem;
      display: flex; align-items: center; gap: 0.25rem; transition: opacity .15s;
    }
    .btn-size-guide:hover { opacity: 0.7; }

    .favorite-star {
      font-size: 0.6rem;
      color: var(--warning);
      margin-left: 2px;
    }

    .btn-favorite-size {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.35rem 0.75rem;
      background: var(--warning-bg);
      color: var(--warning-text);
      border: 1px solid var(--warning-border);
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
      margin-top: 0.5rem;
    }
    .btn-favorite-size:hover:not(:disabled) {
      background: var(--warning-bg);
      border-color: var(--warning-border);
    }
    .btn-favorite-size:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .btn-favorite-size.saved {
      background: rgba(var(--primary-rgb,224,32,200),0.1);
      color: var(--primary);
      border-color: var(--primary);
    }
    .btn-favorite-size.saved:hover:not(:disabled) {
      background: rgba(var(--primary-rgb,224,32,200),0.18);
      border-color: var(--primary-dark);
    }

    /* Stock */
    .stock-info { font-size: 0.82rem; font-weight: 600; color: var(--success-text); }
    .stock-info.low { color: var(--warning-text); }
    .stock-info.out { color: var(--danger); }

    /* Messages */
    .added-msg { background: var(--success-bg); border: 1px solid var(--success-border); color: var(--success-text);
      padding: 0.6rem 0.9rem; border-radius: 8px; font-size: 0.85rem; font-weight: 500; }
    .alert-error { background: var(--danger-bg); border: 1px solid var(--danger-border); color: var(--danger-text);
      padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 1rem; }
    .alert-error.small { margin-bottom: 0; }

    /* Actions */
    .actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
    .btn-cart {
      flex: 1; min-width: 180px; padding: 0.75rem 1.25rem;
      background: var(--primary); color: white; border: none;
      border-radius: 10px; font-size: 0.9rem; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      transition: background .15s;
    }
    .btn-cart:hover:not(:disabled) { background: var(--primary-dark); }
    .btn-cart:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-wishlist {
      flex: 0 0 auto; width: 44px; height: 44px; padding: 0;
      background: var(--bg-card); border: 1.5px solid var(--border);
      border-radius: 10px; cursor: pointer; display: flex; align-items: center;
      justify-content: center; color: var(--text-secondary); transition: all .15s;
    }
    .btn-wishlist:hover { border-color: var(--danger); color: var(--danger); }
    .btn-wishlist.wishlisted { color: var(--danger); border-color: var(--danger); background: var(--danger-bg); }

    /* Notify-me banner */
    .notify-banner {
      margin-top: 0.5rem;
      padding: 0.85rem 1rem;
      background: var(--info-bg);
      border: 1px solid var(--info-border);
      border-radius: 8px;
      text-align: center;
    }
    .notify-hint {
      margin: 0 0 0.6rem;
      font-size: 0.875rem;
      color: var(--info-text);
    }
    .btn-notify {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.5rem 1.1rem;
      background: var(--info); color: white;
      border: none; border-radius: 7px;
      font-size: 0.875rem; font-weight: 600; cursor: pointer;
      transition: background 0.15s;
    }
    .btn-notify:hover { background: var(--info-text); }
    .notify-active {
      margin: 0;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--success-text);
    }

    .btn-customize {
      flex: 1; min-width: 160px; padding: 0.75rem 1.25rem;
      background: var(--bg-card); color: var(--info-text); border: 1.5px solid var(--info-text);
      border-radius: 10px; font-size: 0.9rem; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      transition: all .15s;
    }
    .btn-customize:hover { background: var(--info-bg); }

    /* Recommendations */
    .recommendations-section {
      margin-top: 3rem; padding-top: 2rem; border-top: 1px solid var(--border);
    }
    .section-title {
      font-size: 1.3rem; font-weight: 700; color: var(--text); margin: 0 0 0.25rem 0;
    }
    .recommendations-subtitle {
      font-size: 0.85rem; color: var(--text-secondary); margin: 0 0 1.25rem 0;
    }
    .recommendations-scroll {
      display: flex; gap: 1rem; overflow-x: auto; padding-bottom: 1rem;
      scroll-behavior: smooth;
    }
    .recommendations-scroll::-webkit-scrollbar {
      height: 6px;
    }
    .recommendations-scroll::-webkit-scrollbar-track {
      background: var(--bg-secondary); border-radius: 3px;
    }
    .recommendations-scroll::-webkit-scrollbar-thumb {
      background: var(--border); border-radius: 3px;
    }
    .recommendations-scroll::-webkit-scrollbar-thumb:hover {
      background: var(--text-secondary);
    }
    .recommendation-item {
      flex: 0 0 auto; width: 160px; text-decoration: none; color: inherit;
      display: flex; flex-direction: column; gap: 0.75rem; cursor: pointer;
      transition: transform .2s;
    }
    .recommendation-item:hover { transform: translateY(-4px); }
    .rec-image {
      width: 100%; aspect-ratio: 1; border-radius: 8px; overflow: hidden;
      background: var(--bg-secondary); border: 1px solid var(--border);
    }
    .rec-image img { width: 100%; height: 100%; object-fit: cover; }
    .no-image-placeholder {
      width: 100%; height: 100%; display: flex; align-items: center;
      justify-content: center; background: var(--bg-secondary);
    }
    .rec-info { display: flex; flex-direction: column; gap: 0.3rem; }
    .rec-name {
      font-size: 0.85rem; font-weight: 600; color: var(--text); margin: 0;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .rec-price {
      font-size: 0.9rem; font-weight: 700; color: var(--primary); margin: 0;
    }

    /* Lightbox */
    .lightbox {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.95); z-index: 1000;
      display: flex; align-items: center; justify-content: center;
    }
    .lightbox-controls {
      position: absolute; top: 1rem; right: 1rem; z-index: 1001;
      display: flex; align-items: center; gap: 0.5rem;
    }
    .lightbox-close {
      width: 40px; height: 40px;
      background: rgba(255, 255, 255, 0.15); border: none; border-radius: 50%;
      color: white; font-size: 1.2rem; cursor: pointer; display: flex;
      align-items: center; justify-content: center; transition: background .15s;
    }
    .lightbox-close:hover { background: rgba(255, 255, 255, 0.25); }
    .lightbox-zoom-controls {
      display: flex; align-items: center; gap: 0.25rem;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 8px; padding: 4px;
    }
    .lightbox-zoom-controls .zoom-btn {
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      background: transparent; border: none;
      color: white; cursor: pointer; border-radius: 4px;
      transition: background 0.15s;
    }
    .lightbox-zoom-controls .zoom-btn:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.2);
    }
    .lightbox-zoom-controls .zoom-btn:disabled { opacity: 0.4; }
    .lightbox-zoom-controls .zoom-level {
      font-size: 0.75rem; font-weight: 600; color: rgba(255,255,255,0.8);
      min-width: 40px; text-align: center;
    }
    .lightbox-image-container {
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden; cursor: zoom-in;
    }
    .lightbox-image-container.zoomed { cursor: grab; }
    .lightbox-image-container.zoomed:active { cursor: grabbing; }
    .lightbox-image-container img {
      max-width: 90vw; max-height: 90vh; object-fit: contain;
      transition: transform 0.1s ease-out;
      pointer-events: none;
      user-select: none;
      -webkit-user-drag: none;
    }

    /* Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); z-index: 999;
      display: flex; align-items: center; justify-content: center; padding: 1rem;
    }
    .modal-content {
      background: var(--bg-card); border-radius: 12px; max-width: 500px; width: 100%;
      max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    }
    .modal-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 1.5rem; border-bottom: 1px solid var(--border);
    }
    .modal-header h2 {
      margin: 0; font-size: 1.3rem; font-weight: 700; color: var(--text);
    }
    .modal-close {
      background: none; border: none; font-size: 1.5rem; cursor: pointer;
      color: var(--text-secondary); padding: 0; width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      transition: color .15s;
    }
    .modal-close:hover { color: var(--text); }
    .modal-body {
      padding: 1.5rem;
    }
    .guide-intro {
      margin: 0 0 1rem 0; font-size: 0.9rem; color: var(--text-secondary);
    }
    .size-guide-table {
      width: 100%; border-collapse: collapse;
    }
    .size-guide-table thead {
      background: var(--bg-secondary);
    }
    .size-guide-table th {
      padding: 0.75rem; text-align: left; font-weight: 600;
      font-size: 0.82rem; color: var(--text); border-bottom: 1px solid var(--border);
    }
    .size-guide-table td {
      padding: 0.75rem; font-size: 0.85rem; color: var(--text-secondary);
      border-bottom: 1px solid var(--border);
    }
    .size-guide-table td.size-cell {
      font-weight: 600; color: var(--text);
    }

    /* Reviews */
    .reviews-section, .qa-section {
      margin-top: 3rem; padding-top: 2rem; border-top: 1px solid var(--border);
    }
    .section-header-row {
      display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem;
    }
    .section-header-row .section-title { margin-bottom: 0; }
    .reviews-count {
      font-size: 0.82rem; background: var(--bg-secondary); color: var(--text-secondary);
      padding: 2px 8px; border-radius: 12px; font-weight: 600;
    }
    .rating-overview {
      display: flex; gap: 2rem; align-items: flex-start; margin-bottom: 1.5rem;
      background: var(--bg-secondary); border-radius: 12px; padding: 1.25rem;
    }
    .rating-big { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
    .rating-number { font-size: 2.5rem; font-weight: 800; color: var(--text); line-height: 1; }
    .stars-row { font-size: 1.1rem; color: var(--warning); margin-top: 0.3rem; }
    .rating-bars { flex: 1; display: flex; flex-direction: column; gap: 0.35rem; }
    .rating-bar-row { display: flex; align-items: center; gap: 0.5rem; }
    .bar-label { font-size: 0.78rem; color: var(--text-secondary); width: 20px; text-align: right; flex-shrink: 0; }
    .bar-track { flex: 1; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
    .bar-fill { height: 100%; background: var(--warning); border-radius: 4px; transition: width 0.3s; }
    .bar-count { font-size: 0.78rem; color: var(--text-secondary); width: 20px; flex-shrink: 0; }
    .review-form-card {
      background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 12px;
      padding: 1.25rem; margin-bottom: 1.5rem;
    }
    .review-form-card h3 { margin: 0 0 0.75rem; font-size: 1rem; font-weight: 700; }
    .star-picker { display: flex; gap: 0.25rem; margin-bottom: 0.75rem; }
    .star-btn {
      font-size: 1.6rem; background: none; border: none; cursor: pointer;
      color: var(--border); transition: color 0.1s; padding: 0;
    }
    .star-btn.active { color: var(--warning); }
    .review-input, .review-textarea {
      width: 100%; padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: 8px;
      font-size: 0.875rem; margin-bottom: 0.6rem; box-sizing: border-box;
      font-family: inherit; transition: border-color 0.15s;
    }
    .review-input:focus, .review-textarea:focus { outline: none; border-color: var(--primary); }
    .review-textarea { resize: vertical; }
    .review-error { color: var(--danger); font-size: 0.825rem; margin: 0 0 0.5rem; }
    .btn-submit-review {
      padding: 0.5rem 1.25rem; background: var(--primary); color: white;
      border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; transition: background 0.15s;
    }
    .btn-submit-review:hover:not(:disabled) { background: var(--primary-dark); }
    .btn-submit-review:disabled { opacity: 0.5; cursor: not-allowed; }
    .already-reviewed { color: var(--success-text); font-size: 0.875rem; font-weight: 500; margin-bottom: 1rem; }
    .no-reviews, .reviews-loading { color: var(--text-secondary); font-size: 0.875rem; margin: 1rem 0; }
    .reviews-list { display: flex; flex-direction: column; gap: 1rem; }
    .review-card {
      padding: 1rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px;
    }
    .review-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 0.4rem;
    }
    .review-meta { display: flex; flex-direction: column; gap: 0.2rem; }
    .reviewer-name { font-weight: 600; font-size: 0.9rem; color: var(--text); }
    .verified-badge {
      font-size: 0.72rem; color: var(--success-text); font-weight: 500;
    }
    .review-stars { font-size: 1rem; color: var(--warning); }
    .review-title { margin: 0 0 0.3rem; font-weight: 600; font-size: 0.9rem; color: var(--text); }
    .review-body { margin: 0 0 0.5rem; font-size: 0.875rem; color: var(--text); line-height: 1.6; }
    .review-date { margin: 0; font-size: 0.75rem; color: var(--text-secondary); }

    /* Q&A */
    .qa-section .section-title { margin-bottom: 1rem; }
    .ask-form { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; }
    .qa-input {
      flex: 1; padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: 8px;
      font-size: 0.875rem; transition: border-color 0.15s;
    }
    .qa-input:focus { outline: none; border-color: var(--primary); }
    .btn-ask {
      padding: 0.5rem 1rem; background: var(--primary); color: white;
      border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; transition: background 0.15s; white-space: nowrap;
    }
    .btn-ask:hover:not(:disabled) { background: var(--primary-dark); }
    .btn-ask:disabled { opacity: 0.5; cursor: not-allowed; }
    .qa-login-prompt { font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 1rem; }
    .qa-login-prompt a { color: var(--primary); font-weight: 600; }
    .questions-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .qa-loading, .no-questions { color: var(--text-secondary); font-size: 0.875rem; }
    .question-card {
      padding: 0.875rem 1rem; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px;
    }
    .question-row {
      display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem;
    }
    .question-row svg { flex-shrink: 0; margin-top: 2px; }
    .question-text { flex: 1; font-size: 0.875rem; color: var(--text); font-weight: 500; }
    .question-author { font-size: 0.775rem; color: var(--text-secondary); white-space: nowrap; }
    .answer-row {
      display: flex; align-items: flex-start; gap: 0.5rem;
      padding: 0.6rem 0.75rem; background: var(--primary-light);
      border-left: 3px solid var(--primary); border-radius: 0 6px 6px 0; margin-top: 0.25rem;
    }
    .answer-row svg { flex-shrink: 0; margin-top: 2px; }
    .answer-text { font-size: 0.875rem; color: var(--primary-dark); flex: 1; }
    .pending-answer {
      font-size: 0.78rem; color: var(--text-secondary); margin: 0.25rem 0 0 1.5rem; font-style: italic;
    }
  `],
})
export class ProductDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private authService = inject(AuthService);
  private wishlistService = inject(WishlistService);
  private recentlyViewedService = inject(RecentlyViewedService);
  private seo = inject(SeoService);
  private profileService = inject(ProfileService);
  private http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  isAuthenticated = this.authService.isAuthenticated;
  Math = Math; // Expose Math for template

  // State signals
  product = signal<Product | null>(null);
  loading = signal(true);
  errorMessage = signal('');
  addingToCart = signal(false);
  addedMessage = signal('');
  activeImage = signal<ProductImage | null>(null);
  selectedColor = signal('');
  selectedVariant = signal<ProductVariant | null>(null);
  wishlisted = signal(false);
  recommendations = signal<Product[]>([]);
  lightboxOpen = signal(false);

  // Zoom state
  zoomLevel = signal(1);
  panX = signal(0);
  panY = signal(0);
  isZoomed = signal(false);
  private isDragging = false;
  private lastX = 0;
  private lastY = 0;
  private touchStartX = 0;
  private touchStartY = 0;

  // Reviews
  reviewSummary = signal<ReviewSummary | null>(null);
  newReviewRating = signal(0);
  newReviewTitle = '';
  newReviewBody = '';
  submittingReview = signal(false);
  reviewError = signal('');

  // Q&A
  questions = signal<QAItem[]>([]);
  questionsLoading = signal(true);
  newQuestion = '';
  submittingQuestion = signal(false);
  sizeGuideOpen = signal(false);

  // Saved sizes (favorite size per category)
  savedSizes = signal<SavedSize[]>([]);
  savingFavorite = signal(false);

  // Size guide data from API
  sizeGuideData = signal<SizeGuideResponse[]>([]);
  hasSizeGuide = signal(false);

  // Computed properties
  colors = computed(() => {
    const p = this.product();
    if (!p) return [];
    return [...new Set(p.variants.map(v => v.color))];
  });

  sizesForColor = computed(() => {
    const p = this.product();
    const color = this.selectedColor();
    if (!p || !color) return [];
    return p.variants.filter(v => v.color === color);
  });

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    this.loadReviews(slug);
    this.loadQuestions(slug);
    this.loadSavedSizes(); // Load favorite sizes if authenticated

    this.productService.getBySlug(slug).subscribe({
      next: (p) => {
        this.product.set(p);
        this.loading.set(false);
        this.activeImage.set(p.images.find(i => i.primary) ?? p.images[0] ?? null);

        // Auto-select color + variant (favoriting saved size after load)
        if (p.variants.length > 0) {
          // First select color, variant will be auto-selected after sizes load
          const firstWithStock = p.variants.find(v => v.stockAvailable > 0) ?? p.variants[0];
          this.selectedColor.set(firstWithStock.color);
          // Apply saved size preference after a brief delay to ensure savedSizes is loaded
          setTimeout(() => this.applySavedSize(p), 50);
        }

        // SEO meta tags + JSON-LD
        const primaryImage = p.images.find(i => i.primary) ?? p.images[0];
        const cheapestVariant = p.variants.reduce((min, v) =>
          v.priceAmount < min.priceAmount ? v : min, p.variants[0]);
        const hasStock = p.variants.some(v => v.stockAvailable > 0);
        this.seo.setProduct({
          name:          p.name,
          description:   p.description,
          slug:          p.slug,
          imageUrl:      primaryImage?.imageUrl ?? null,
          priceAmount:   cheapestVariant?.priceAmount ?? 0,
          currencyCode:  cheapestVariant?.currencyCode ?? 'ARS',
          brand:         'Solder Studio',
          categoryName:  p.categoryName ?? undefined,
          availability:  hasStock ? 'InStock' : 'OutOfStock',
        });

        // Load size guide for this product's category
        if (p.categoryId) {
          this.loadSizeGuide(p.categoryId);
        }

        // Load recommendations
        this.productService.getRecommendations(p.id).subscribe({
          next: (recs) => this.recommendations.set(recs),
          error: () => this.recommendations.set([]),
        });

        // Record view if authenticated
        if (this.authService.isAuthenticated()) {
          this.recentlyViewedService.record(p.id);
        }

        // Check if wishlisted
        this.wishlisted.set(this.wishlistService.isWishlisted(p.id));
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Producto no encontrado.');
        this.seo.set({ title: 'Producto no encontrado', description: 'El producto que buscás no existe o fue eliminado.', canonicalPath: '/' });
      },
    });
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.lightboxOpen()) this.closeLightbox();
    if (this.sizeGuideOpen()) this.closeSizeGuide();
  }

  selectImage(img: ProductImage): void {
    this.activeImage.set(img);
  }

  selectColor(color: string): void {
    this.selectedColor.set(color);
    const p = this.product();
    if (!p) return;

    // Keep same size if available in new color, otherwise pick first with stock
    const same = p.variants.find(
      v => v.color === color && v.size === this.selectedVariant()?.size
    );
    this.selectedVariant.set(
      same
        ?? p.variants.find(v => v.color === color && v.stockAvailable > 0)
        ?? p.variants.find(v => v.color === color)
        ?? null
    );
  }

  selectVariant(variant: ProductVariant): void {
    this.selectedVariant.set(variant);
    this.addedMessage.set('');
    this.errorMessage.set('');
  }

  addToCart(): void {
    const variant = this.selectedVariant();
    if (!variant || variant.stockAvailable === 0) return;

    if (!this.authService.isAuthenticated()) {
      // Save the item so it can be added automatically after login
      this.cartService.savePendingItem({ productVariantId: variant.id, quantity: 1 });
      this.router.navigate(['/auth']);
      return;
    }

    this.addingToCart.set(true);
    this.errorMessage.set('');
    this.addedMessage.set('');

    this.cartService.addItem({
      productVariantId: variant.id,
      quantity: 1,
    }).subscribe({
      next: () => {
        this.addingToCart.set(false);
        this.addedMessage.set(`${this.product()!.name} agregado al carrito.`);
        setTimeout(() => this.addedMessage.set(''), 3000);
      },
      error: (err) => {
        this.addingToCart.set(false);
        this.errorMessage.set(err?.error?.error || 'Error al agregar al carrito.');
      },
    });
  }

  toggleWishlist(): void {
    const p = this.product();
    if (!p) return;

    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth']);
      return;
    }

    this.wishlistService.toggle(p.id).subscribe({
      next: () => {
        this.wishlisted.set(!this.wishlisted());
      },
      error: () => {
        this.errorMessage.set('Error al actualizar favoritos.');
      },
    });
  }

  goToCustomizer(): void {
    const variant = this.selectedVariant();
    if (!variant) return;

    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth']);
      return;
    }

    this.router.navigate(['/customizer', variant.id]);
  }

  openLightbox(): void {
    if (this.activeImage()) {
      this.lightboxOpen.set(true);
    }
  }

  closeLightbox(): void {
    this.lightboxOpen.set(false);
  }

  // ── Zoom methods ────────────────────────────────────────────────

  toggleZoom(_event: MouseEvent): void {
    if (this.zoomLevel() > 1) {
      this.resetZoom();
    } else {
      this.zoomIn();
    }
  }

  zoomIn(): void {
    const newLevel = Math.min(this.zoomLevel() + 0.5, 4);
    this.zoomLevel.set(newLevel);
    this.isZoomed.set(newLevel > 1);
    this.resetPan();
  }

  zoomOut(): void {
    const newLevel = Math.max(this.zoomLevel() - 0.5, 1);
    this.zoomLevel.set(newLevel);
    this.isZoomed.set(newLevel > 1);
    if (newLevel === 1) {
      this.resetPan();
    }
  }

  resetZoom(): void {
    this.zoomLevel.set(1);
    this.isZoomed.set(false);
    this.resetPan();
  }

  private resetPan(): void {
    this.panX.set(0);
    this.panY.set(0);
  }

  getImageTransform(): string {
    const scale = this.zoomLevel();
    const x = this.panX();
    const y = this.panY();
    if (scale === 1) return 'scale(1)';
    return `scale(${scale}) translate(${x}px, ${y}px)`;
  }

  onImageMouseMove(event: MouseEvent): void {
    if (!this.isZoomed() || this.isDragging) return;

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 50;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 50;

    this.panX.set(x);
    this.panY.set(y);
  }

  onImageMouseLeave(): void {
    if (this.isDragging) return;
    if (!this.isZoomed()) return;
    this.resetPan();
  }

  onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      this.isDragging = true;
      this.touchStartX = event.touches[0].clientX - this.panX();
      this.touchStartY = event.touches[0].clientY - this.panY();
    }
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.isDragging || event.touches.length !== 1) return;
    event.preventDefault();

    const x = event.touches[0].clientX - this.touchStartX;
    const y = event.touches[0].clientY - this.touchStartY;

    this.panX.set(x);
    this.panY.set(y);
  }

  onTouchEnd(): void {
    this.isDragging = false;
  }

  openSizeGuide(): void {
    // Load size guide if not loaded yet
    const guides = this.sizeGuideData();
    if (guides.length === 0) {
      const p = this.product();
      if (p?.categoryId) {
        this.loadSizeGuide(p.categoryId);
      }
    }
    this.sizeGuideOpen.set(true);
  }

  closeSizeGuide(): void {
    this.sizeGuideOpen.set(false);
  }

  private loadSizeGuide(categoryId: number): void {
    this.http.get<SizeGuideResponse[]>(`${this.apiUrl}/size-guides/category/${categoryId}`)
      .subscribe({
        next: (data) => {
          this.sizeGuideData.set(data);
          this.hasSizeGuide.set(data.length > 0);
        },
        error: () => {
          this.sizeGuideData.set([]);
          this.hasSizeGuide.set(false);
        },
      });
  }

  getMeasurementKeys(guide: SizeGuideResponse): string[] {
    if (!guide.measurements) return [];
    const firstSize = guide.sizes[0];
    if (!firstSize || !guide.measurements[firstSize]) return [];
    return Object.keys(guide.measurements[firstSize]);
  }

  getMeasurementLabel(key: string): string {
    const labels: Record<string, string> = {
      'chest': 'Pecho (cm)',
      'waist': 'Cintura (cm)',
      'hips': 'Cadera (cm)',
      'length': 'Largo (cm)',
      'width': 'Ancho (cm)',
      'height': 'Alto (cm)',
      'inseam': 'Entrepierna (cm)',
      'sleeve': 'Manga (cm)',
      'shoulder': 'Hombro (cm)',
    };
    return labels[key] || key;
  }

  getMeasurementValue(guide: SizeGuideResponse, size: string, measurement: string): string {
    return guide.measurements[size]?.[measurement] ?? '-';
  }

  // ── Favorite size methods ──────────────────────────────────────

  private loadSavedSizes(): void {
    if (!this.isAuthenticated()) return;
    this.profileService.getLoyalty().subscribe({
      next: (loyalty) => this.savedSizes.set(loyalty.savedSizes),
      error: () => {},
    });
  }

  private applySavedSize(product: Product): void {
    const categoryName = product.categoryName;
    if (!categoryName) return;

    const saved = this.savedSizes().find(s => s.categoryName === categoryName);
    if (!saved) {
      // No saved size, select first with stock
      const firstWithStock = product.variants.find(v => v.color === this.selectedColor() && v.stockAvailable > 0)
        ?? product.variants.find(v => v.color === this.selectedColor())
        ?? product.variants[0];
      this.selectedVariant.set(firstWithStock);
      return;
    }

    // Try to find variant with saved size in current color
    const variantWithSavedSize = product.variants.find(
      v => v.color === this.selectedColor() && v.size === saved.size
    );

    if (variantWithSavedSize) {
      this.selectedVariant.set(variantWithSavedSize);
    } else {
      // Saved size not available in current color, try first with stock
      const firstWithStock = product.variants.find(v => v.color === this.selectedColor() && v.stockAvailable > 0)
        ?? product.variants.find(v => v.color === this.selectedColor())
        ?? product.variants[0];
      this.selectedVariant.set(firstWithStock);
    }
  }

  isFavoriteSize(size: string): boolean {
    const product = this.product();
    if (!product?.categoryName) return false;
    const saved = this.savedSizes().find(s => s.categoryName === product.categoryName);
    return saved?.size === size;
  }

  isCurrentFavorite(): boolean {
    const variant = this.selectedVariant();
    if (!variant) return false;
    return this.isFavoriteSize(variant.size);
  }

  toggleFavoriteSize(): void {
    const variant = this.selectedVariant();
    const product = this.product();
    if (!variant || !product?.categoryName) return;

    if (!this.isAuthenticated()) {
      this.router.navigate(['/auth']);
      return;
    }

    const newSizes: SavedSize[] = [
      ...this.savedSizes().filter(s => s.categoryName !== product.categoryName),
      { categoryName: product.categoryName, size: variant.size },
    ];

    this.savingFavorite.set(true);
    this.profileService.saveSizes(newSizes).subscribe({
      next: (saved) => {
        this.savedSizes.set(saved);
        this.savingFavorite.set(false);
      },
      error: () => {
        this.savingFavorite.set(false);
        this.errorMessage.set('Error al guardar el talle favorito.');
      },
    });
  }

  // ── Reviews & Q&A ────────────────────────────────────────────

  private loadReviews(slug: string): void {
    this.http.get<ReviewSummary>(`${this.apiUrl}/products/${slug}/reviews`).subscribe({
      next: (s) => this.reviewSummary.set(s),
      error: () => this.reviewSummary.set({
        averageRating: null, totalReviews: 0,
        ratingDistribution: {}, reviews: [], userHasReviewed: false,
      }),
    });
  }

  private loadQuestions(slug: string): void {
    this.http.get<{ content: QAItem[] }>(`${this.apiUrl}/products/${slug}/questions?size=20`).subscribe({
      next: (page) => { this.questions.set(page.content); this.questionsLoading.set(false); },
      error: () => this.questionsLoading.set(false),
    });
  }

  submitReview(): void {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    const rating = this.newReviewRating();
    if (rating === 0) return;
    this.submittingReview.set(true);
    this.reviewError.set('');
    this.http.post<void>(`${this.apiUrl}/products/${slug}/reviews`, {
      rating,
      title: this.newReviewTitle || null,
      body: this.newReviewBody || null,
    }).subscribe({
      next: () => {
        this.submittingReview.set(false);
        this.newReviewRating.set(0);
        this.newReviewTitle = '';
        this.newReviewBody = '';
        this.loadReviews(slug);
      },
      error: (err) => {
        this.submittingReview.set(false);
        this.reviewError.set(err?.error?.error || 'Error al publicar la reseña.');
      },
    });
  }

  submitQuestion(): void {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    const q = this.newQuestion.trim();
    if (!q) return;
    this.submittingQuestion.set(true);
    this.http.post<QAItem>(`${this.apiUrl}/products/${slug}/questions`, { question: q }).subscribe({
      next: (item) => {
        this.questions.update(list => [item, ...list]);
        this.newQuestion = '';
        this.submittingQuestion.set(false);
      },
      error: () => this.submittingQuestion.set(false),
    });
  }

  starsDisplay(rating: number | null): string {
    if (rating == null) return '';
    const full = Math.round(rating);
    return '★'.repeat(Math.max(0, full)) + '☆'.repeat(Math.max(0, 5 - full));
  }

  ratingEntries(dist: Record<number, number>): { rating: number; count: number }[] {
    return [5, 4, 3, 2, 1].map(r => ({ rating: r, count: dist[r] ?? 0 }));
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-AR', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  }
}
