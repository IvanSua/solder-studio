import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { CheckoutRequest, CheckoutResponse, Order } from '../models/order.model';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  checkout(request: CheckoutRequest): Observable<CheckoutResponse> {
    return this.http.post<CheckoutResponse>(`${this.apiUrl}/checkout`, request);
  }

  getOrders(page = 0, size = 10): Observable<{ content: Order[]; totalElements: number; totalPages: number }> {
    const params = new HttpParams().set('page', page).set('size', size).set('sort', 'createdAt,desc');
    return this.http.get<{ content: Order[]; totalElements: number; totalPages: number }>(`${this.apiUrl}/orders`, { params });
  }

  getOrder(id: number): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/orders/${id}`);
  }

  cancelOrder(id: number): Observable<Order> {
    return this.http.post<Order>(`${this.apiUrl}/orders/${id}/cancel`, {});
  }

  /** Download the PDF invoice as a Blob. */
  downloadInvoice(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/orders/${id}/invoice`, { responseType: 'blob' });
  }
}
