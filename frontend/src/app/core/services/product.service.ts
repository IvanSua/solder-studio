import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { Product, ProductPage, VariantDetail } from '../models/product.model';

export interface AutocompleteItem {
  productId: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  minPriceAmount: number;
  currencyCode: string;
}

export interface FilterOptions {
  sizes: string[];
  colors: string[];
  minPrice: number;
  maxPrice: number;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly apiUrl = `${environment.apiUrl}/products`;

  constructor(private http: HttpClient) {}

  list(page = 0, size = 12): Observable<ProductPage> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ProductPage>(this.apiUrl, { params });
  }

  listFiltered(opts: {
    q?: string;
    categoryId?: number | null;
    page?: number;
    size?: number;
    sort?: string;
  }): Observable<ProductPage> {
    let params = new HttpParams()
      .set('page', opts.page ?? 0)
      .set('size', opts.size ?? 12);
    if (opts.q && opts.q.trim()) params = params.set('q', opts.q.trim());
    if (opts.categoryId != null)  params = params.set('categoryId', opts.categoryId);
    if (opts.sort)                params = params.set('sort', opts.sort);
    return this.http.get<ProductPage>(this.apiUrl, { params });
  }

  getById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${id}`);
  }

  getBySlug(slug: string): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/slug/${slug}`);
  }

  getByCategory(categoryId: number, page = 0, size = 12): Observable<ProductPage> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ProductPage>(`${this.apiUrl}/category/${categoryId}`, { params });
  }

  search(query: string, page = 0, size = 12): Observable<ProductPage> {
    const params = new HttpParams().set('q', query).set('page', page).set('size', size);
    return this.http.get<ProductPage>(`${this.apiUrl}/search`, { params });
  }

  /**
   * Returns full variant context (variant + product + images + print area)
   * in a single call. Used by the customizer component.
   */
  getVariantDetail(variantId: number): Observable<VariantDetail> {
    return this.http.get<VariantDetail>(`${this.apiUrl}/variants/${variantId}`);
  }

  autocomplete(q: string): Observable<AutocompleteItem[]> {
    const params = new HttpParams().set('q', q);
    return this.http.get<AutocompleteItem[]>(`${this.apiUrl}/autocomplete`, { params });
  }

  listAdvanced(opts: {
    q?: string;
    categoryId?: number | null;
    priceMin?: number | null;
    priceMax?: number | null;
    sizes?: string[];
    colors?: string[];
    inStockOnly?: boolean;
    page?: number;
    size?: number;
    sort?: string;
  }): Observable<ProductPage> {
    let params = new HttpParams()
      .set('page', opts.page ?? 0)
      .set('size', opts.size ?? 12);
    if (opts.q?.trim())              params = params.set('q', opts.q.trim());
    if (opts.categoryId != null)      params = params.set('categoryId', opts.categoryId);
    if (opts.priceMin != null)        params = params.set('priceMin', opts.priceMin);
    if (opts.priceMax != null)        params = params.set('priceMax', opts.priceMax);
    if (opts.sizes?.length)           opts.sizes.forEach(s => params = params.append('sizes', s));
    if (opts.colors?.length)          opts.colors.forEach(c => params = params.append('colors', c));
    if (opts.inStockOnly)             params = params.set('inStockOnly', true);
    if (opts.sort)                    params = params.set('sort', opts.sort);
    return this.http.get<ProductPage>(this.apiUrl, { params });
  }

  getFilterOptions(categoryId?: number | null): Observable<FilterOptions> {
    let params = new HttpParams();
    if (categoryId != null) params = params.set('categoryId', categoryId);
    return this.http.get<FilterOptions>(`${this.apiUrl}/filter-options`, { params });
  }

  getRecommendations(productId: number): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.apiUrl}/${productId}/recommendations`);
  }
}
