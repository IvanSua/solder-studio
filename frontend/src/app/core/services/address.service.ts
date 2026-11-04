import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { Address, AddressRequest } from '../models/address.model';

@Injectable({ providedIn: 'root' })
export class AddressService {
  private readonly apiUrl = `${environment.apiUrl}/addresses`;

  constructor(private http: HttpClient) {}

  getAddresses(): Observable<Address[]> {
    return this.http.get<Address[]>(this.apiUrl);
  }

  createAddress(request: AddressRequest): Observable<Address> {
    return this.http.post<Address>(this.apiUrl, request);
  }

  updateAddress(id: number, request: AddressRequest): Observable<Address> {
    return this.http.put<Address>(`${this.apiUrl}/${id}`, request);
  }

  deleteAddress(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  setDefault(id: number): Observable<Address> {
    return this.http.patch<Address>(`${this.apiUrl}/${id}/default`, {});
  }
}
