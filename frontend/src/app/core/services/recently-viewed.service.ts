import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { Product } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class RecentlyViewedService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/recently-viewed`;

  record(productId: number): void {
    this.http.post(`${this.apiUrl}/${productId}`, {}).subscribe({ error: () => {} });
  }

  getRecentlyViewed(excludeProductId?: number): Observable<Product[]> {
    let params = new HttpParams();
    if (excludeProductId != null) params = params.set('excludeProductId', excludeProductId);
    return this.http.get<Product[]>(this.apiUrl, { params });
  }
}
