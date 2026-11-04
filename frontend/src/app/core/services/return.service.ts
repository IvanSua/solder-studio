import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateReturnRequest, ReturnRequest } from '@core/models/return.model';
import { environment } from '@env/environment';

@Injectable({ providedIn: 'root' })
export class ReturnService {
  private http   = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/returns`;

  /** List all return requests for the authenticated user */
  getMyReturns(): Observable<ReturnRequest[]> {
    return this.http.get<ReturnRequest[]>(this.apiUrl);
  }

  /** Submit a new return request */
  create(payload: CreateReturnRequest): Observable<ReturnRequest> {
    return this.http.post<ReturnRequest>(this.apiUrl, payload);
  }
}
