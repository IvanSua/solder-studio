import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

export interface PageMeta {
  title: string;
  description: string;
  keywords?: string;
  /** Absolute or relative canonical URL (e.g. '/producto/camiseta-blanca') */
  canonicalPath?: string;
  /** OG image URL (absolute) */
  image?: string;
  /** 'website' | 'product' | 'article' */
  ogType?: string;
}

export interface ProductMeta {
  name: string;
  description: string | null;
  slug: string;
  imageUrl: string | null;
  priceAmount: number;        // in centavos
  currencyCode: string;
  brand?: string;
  categoryName?: string;
  availability?: 'InStock' | 'OutOfStock';
}

const SITE_NAME  = 'Solder Studio';
const SITE_URL   = 'https://solderstudio.com.ar'; // update when domain is known
const DEFAULT_OG = `${SITE_URL}/assets/og-default.svg`;

@Injectable({ providedIn: 'root' })
export class SeoService {
  private meta     = inject(Meta);
  private title    = inject(Title);
  private document = inject(DOCUMENT);

  /**
   * Set title + standard meta tags for any page.
   * Automatically sets og:title, og:description, og:image and twitter: equivalents.
   */
  set(meta: PageMeta): void {
    const fullTitle = meta.title.includes(SITE_NAME)
      ? meta.title
      : `${meta.title} | ${SITE_NAME}`;

    this.title.setTitle(fullTitle);

    const desc  = meta.description.slice(0, 160);
    const image = meta.image ?? DEFAULT_OG;
    const type  = meta.ogType ?? 'website';
    const canon = meta.canonicalPath
      ? (meta.canonicalPath.startsWith('http') ? meta.canonicalPath : `${SITE_URL}${meta.canonicalPath}`)
      : null;

    this.updateTag('description',         desc);
    if (meta.keywords) this.updateTag('keywords', meta.keywords);

    // Open Graph
    this.updateOg('og:site_name',    SITE_NAME);
    this.updateOg('og:type',         type);
    this.updateOg('og:title',        fullTitle);
    this.updateOg('og:description',  desc);
    this.updateOg('og:image',        image);
    if (canon) this.updateOg('og:url', canon);

    // Twitter Card
    this.updateMeta('twitter:card',        'summary_large_image');
    this.updateMeta('twitter:title',       fullTitle);
    this.updateMeta('twitter:description', desc);
    this.updateMeta('twitter:image',       image);

    // Canonical link tag
    this.setCanonical(canon);
  }

  /**
   * Sets rich product meta (OG + JSON-LD) for a product page.
   * Also calls `set()` so standard tags are populated.
   */
  setProduct(product: ProductMeta): void {
    const desc = product.description
      ? product.description.slice(0, 160)
      : `Comprá ${product.name} en ${SITE_NAME}. Envío a todo Argentina.`;

    this.set({
      title:         product.name,
      description:   desc,
      keywords:      `${product.name}, ${product.categoryName ?? ''}, ropa personalizada, Solder Studio`,
      canonicalPath: `/producto/${product.slug}`,
      image:         product.imageUrl ?? DEFAULT_OG,
      ogType:        'product',
    });

    // og:price (Facebook Catalog)
    this.updateOg('product:price:amount',   (product.priceAmount / 100).toFixed(2));
    this.updateOg('product:price:currency', product.currencyCode);

    // JSON-LD: Product schema
    const priceArs = (product.priceAmount / 100).toFixed(2);
    const jsonLd = {
      '@context':    'https://schema.org',
      '@type':       'Product',
      name:          product.name,
      description:   desc,
      image:         product.imageUrl ? [product.imageUrl] : [],
      url:           `${SITE_URL}/producto/${product.slug}`,
      brand: {
        '@type': 'Brand',
        name:    product.brand ?? SITE_NAME,
      },
      ...(product.categoryName ? { category: product.categoryName } : {}),
      offers: {
        '@type':         'Offer',
        priceCurrency:   product.currencyCode,
        price:           priceArs,
        availability:    `https://schema.org/${product.availability ?? 'InStock'}`,
        url:             `${SITE_URL}/producto/${product.slug}`,
        seller: {
          '@type': 'Organization',
          name:    SITE_NAME,
        },
      },
    };
    this.setJsonLd('product-schema', jsonLd);
  }

  /**
   * Injects or replaces a JSON-LD <script> block identified by a data attribute.
   * Call with `null` to remove an existing block.
   */
  setJsonLd(id: string, data: object | null): void {
    const scriptId = `json-ld-${id}`;
    let existing = this.document.getElementById(scriptId) as HTMLScriptElement | null;

    if (data === null) {
      existing?.remove();
      return;
    }

    if (!existing) {
      existing = this.document.createElement('script');
      existing.id   = scriptId;
      existing.type = 'application/ld+json';
      this.document.head.appendChild(existing);
    }
    existing.textContent = JSON.stringify(data);
  }

  /** Reset to generic site-wide defaults (call on route change to non-product pages). */
  reset(): void {
    this.setJsonLd('product-schema', null);
    this.meta.removeTag("property='product:price:amount'");
    this.meta.removeTag("property='product:price:currency'");
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private updateTag(name: string, content: string): void {
    this.meta.updateTag({ name, content });
  }

  private updateOg(property: string, content: string): void {
    this.meta.updateTag({ property, content });
  }

  private updateMeta(name: string, content: string): void {
    this.meta.updateTag({ name, content });
  }

  private setCanonical(url: string | null): void {
    const existing = this.document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!url) {
      existing?.remove();
      return;
    }
    if (existing) {
      existing.href = url;
    } else {
      const link  = this.document.createElement('link');
      link.rel    = 'canonical';
      link.href   = url;
      this.document.head.appendChild(link);
    }
  }
}
