import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  CustomDesign,
  CustomDesignRequest,
  UpdateSceneRequest,
  UploadAssetResponse,
} from '../models/design.model';

@Injectable({ providedIn: 'root' })
export class DesignService {
  private readonly apiUrl = `${environment.apiUrl}/custom-designs`;

  constructor(private http: HttpClient) {}

  /** Creates a design in DRAFT status with an empty scene. */
  create(request: CustomDesignRequest): Observable<CustomDesign> {
    return this.http.post<CustomDesign>(this.apiUrl, request);
  }

  /**
   * Uploads a single file to an existing design.
   * Returns the real backend asset ID — store it and use it when
   * calling updateScene so placements reference the correct DB records.
   */
  uploadAsset(designId: number, file: File): Observable<UploadAssetResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadAssetResponse>(`${this.apiUrl}/${designId}/assets`, formData);
  }

  /**
   * Saves the final asset placement positions and transitions
   * the design from DRAFT → SAVED.
   * Call this once after all files have been uploaded.
   */
  updateScene(designId: number, request: UpdateSceneRequest): Observable<CustomDesign> {
    return this.http.patch<CustomDesign>(`${this.apiUrl}/${designId}/scene`, request);
  }

  list(): Observable<CustomDesign[]> {
    return this.http.get<CustomDesign[]>(this.apiUrl);
  }

  delete(designId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${designId}`);
  }
}
