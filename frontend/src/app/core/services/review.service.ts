import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface ProductReview {
  id: number;
  productId: number;
  productSlug: string;
  userId: number;
  authorName: string;
  rating: number;
  title: string | null;
  body: string | null;
  verifiedPurchase: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getAdminReviews(
    status: 'PENDING' | 'APPROVED' | 'REJECTED',
    page = 0,
    size = 20
  ): Observable<PageResponse<ProductReview>> {
    const params = new HttpParams()
      .set('status', status)
      .set('page', page)
      .set('size', size);
    return this.http.get<PageResponse<ProductReview>>(`${this.apiUrl}/admin/reviews`, { params });
  }

  approveReview(id: number): Observable<ProductReview> {
    return this.http.patch<ProductReview>(`${this.apiUrl}/admin/reviews/${id}/approve`, {});
  }

  rejectReview(id: number): Observable<ProductReview> {
    return this.http.patch<ProductReview>(`${this.apiUrl}/admin/reviews/${id}/reject`, {});
  }

  getProductReviews(productId: number): Observable<ProductReview[]> {
    return this.http.get<ProductReview[]>(`${this.apiUrl}/reviews/product/${productId}`);
  }
}
