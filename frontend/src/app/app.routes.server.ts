import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Per-route SSR render modes.
 *
 * - Prerender: built at compile time, served as static HTML → best SEO + performance.
 * - Server:    rendered on each request → for pages with dynamic data (product/blog detail).
 * - Client:    standard SPA, no server render → auth-protected and highly interactive pages.
 */
export const serverRoutes: ServerRoute[] = [
  // ── Public static pages — prerender at build time ──────────────────────────
  { path: '',                  renderMode: RenderMode.Prerender },
  { path: 'blog',              renderMode: RenderMode.Prerender },
  { path: 'legal/privacy',     renderMode: RenderMode.Prerender },
  { path: 'legal/terms',       renderMode: RenderMode.Prerender },
  { path: 'gift-cards',        renderMode: RenderMode.Prerender },
  { path: 'sugerencias',       renderMode: RenderMode.Prerender },

  // ── Dynamic public pages — SSR on each request ─────────────────────────────
  { path: 'product/:slug',     renderMode: RenderMode.Server },
  { path: 'blog/:slug',        renderMode: RenderMode.Server },

  // ── Auth-protected + highly interactive → CSR only ─────────────────────────
  { path: '**',                renderMode: RenderMode.Client },
];
