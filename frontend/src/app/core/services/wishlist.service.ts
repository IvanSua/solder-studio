import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '@env/environment';
import { Product } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class WishlistService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/wishlist`;

  // Local cache of wishlisted product IDs for instant UI updates
  wishlistedIds = signal<Set<number>>(new Set());
  wishlistCount = signal(0);

  loadWishlistIds(): void {
    this.http.get<number[]>(`${this.apiUrl}/ids`).subscribe({
      next: ids => {
        this.wishlistedIds.set(new Set(ids));
        this.wishlistCount.set(ids.length);
      },
      error: () => {},
    });
  }

  getWishlist(): Observable<Product[]> {
    return this.http.get<Product[]>(this.apiUrl);
  }

  toggle(productId: number): Observable<{ wishlisted: boolean }> {
    return this.http.post<{ wishlisted: boolean }>(`${this.apiUrl}/${productId}/toggle`, {}).pipe(
      tap(result => {
        this.wishlistedIds.update(ids => {
          const next = new Set(ids);
          if (result.wishlisted) next.add(productId);
          else next.delete(productId);
          return next;
        });
        this.wishlistCount.update(n => result.wishlisted ? n + 1 : n - 1);
      }),
    );
  }

  isWishlisted(productId: number): boolean {
    return this.wishlistedIds().has(productId);
  }
}
