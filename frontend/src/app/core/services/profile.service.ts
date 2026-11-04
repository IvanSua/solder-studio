import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { UserInfo } from '../models/auth.model';

export interface UpdateProfileRequest {
  firstName: string;
  lastName: string;
  phone?: string;
  cuit?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface SavedSize {
  categoryName: string;
  size: string;
}

export interface LoyaltyProfile {
  points: number;
  level: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  levelLabel: string;
  nextLevelPoints: number;
  pointsToNextLevel: number;
  levelProgress: number;
  referralCode: string;
  referralCount: number;
  savedSizes: SavedSize[];
}

export interface PointTransaction {
  id: number;
  amount: number;
  reason: string;
  referenceId: number | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly url = `${environment.apiUrl}/profile`;

  constructor(private http: HttpClient) {}

  getProfile(): Observable<UserInfo> {
    return this.http.get<UserInfo>(this.url);
  }

  updateProfile(data: UpdateProfileRequest): Observable<UserInfo> {
    return this.http.put<UserInfo>(this.url, data);
  }

  changePassword(data: ChangePasswordRequest): Observable<void> {
    return this.http.put<void>(`${this.url}/password`, data);
  }

  getLoyalty(): Observable<LoyaltyProfile> {
    return this.http.get<LoyaltyProfile>(`${this.url}/loyalty`);
  }

  getPointsHistory(page = 0, size = 10): Observable<{ content: PointTransaction[]; totalElements: number }> {
    return this.http.get<{ content: PointTransaction[]; totalElements: number }>(
      `${this.url}/points-history?page=${page}&size=${size}`
    );
  }

  saveSizes(sizes: SavedSize[]): Observable<SavedSize[]> {
    return this.http.put<SavedSize[]>(`${this.url}/sizes`, { sizes });
  }
}
