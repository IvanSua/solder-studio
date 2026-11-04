import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { workerGuard } from './core/guards/worker.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/catalog/catalog.component').then(m => m.CatalogComponent),
  },
  {
    path: 'product/:slug',
    loadComponent: () =>
      import('./features/catalog/product-detail.component').then(m => m.ProductDetailComponent),
  },
  {
    path: 'auth',
    loadComponent: () =>
      import('./features/auth/auth.component').then(m => m.AuthComponent),
  },
  {
    path: 'auth/reset-password',
    loadComponent: () =>
      import('./features/auth/auth.component').then(m => m.AuthComponent),
  },
  {
    path: 'oauth-callback',
    loadComponent: () =>
      import('./features/auth/oauth-callback.component').then(m => m.OAuthCallbackComponent),
  },
  {
    path: 'verificar-email',
    loadComponent: () =>
      import('./features/auth/verify-email.component').then(m => m.VerifyEmailComponent),
  },
  {
    path: 'cart',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/cart/cart.component').then(m => m.CartComponent),
  },
  {
    path: 'checkout',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/checkout/checkout.component').then(m => m.CheckoutComponent),
  },
  {
    path: 'customizer/:variantId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/customizer/customizer.component').then(m => m.CustomizerComponent),
  },
  {
    path: 'orders',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/orders/orders.component').then(m => m.OrdersComponent),
  },
  {
    path: 'orders/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/orders/order-detail.component').then(m => m.OrderDetailComponent),
  },
  {
    path: 'designs',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/designs/designs.component').then(m => m.DesignsComponent),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/profile.component').then(m => m.ProfileComponent),
  },
  {
    path: 'loyalty',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/loyalty/loyalty.component').then(m => m.LoyaltyComponent),
  },
  {
    path: 'wishlist',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/wishlist/wishlist.component').then(m => m.WishlistComponent),
  },
  {
    path: 'sugerencias',
    loadComponent: () =>
      import('./features/suggestions/suggestions.component').then(m => m.SuggestionsComponent),
  },
  {
    path: 'blog',
    loadComponent: () =>
      import('./features/blog/blog.component').then(m => m.BlogComponent),
  },
  {
    path: 'blog/:slug',
    loadComponent: () =>
      import('./features/blog/blog-post.component').then(m => m.BlogPostComponent),
  },
  {
    path: 'gift-cards',
    loadComponent: () =>
      import('./features/gift-cards/gift-cards.component').then(m => m.GiftCardsComponent),
  },
  {
    path: 'events',
    loadComponent: () =>
      import('./features/events/events.component').then(m => m.EventsComponent),
  },
  {
    path: 'compare',
    loadComponent: () =>
      import('./features/compare/compare.component').then(m => m.CompareComponent),
  },
  {
    path: 'legal/privacy',
    loadComponent: () =>
      import('./features/legal/legal.component').then(m => m.LegalComponent),
  },
  {
    path: 'legal/terms',
    loadComponent: () =>
      import('./features/legal/legal.component').then(m => m.LegalComponent),
  },
  {
    path: 'empresa',
    loadComponent: () =>
      import('./features/empresa/empresa.component').then(m => m.EmpresaComponent),
  },
  {
    path: 'contacto',
    loadComponent: () =>
      import('./features/contacto/contacto.component').then(m => m.ContactoComponent),
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadChildren: () =>
      import('./features/admin/admin.routes').then(m => m.adminRoutes),
  },
  {
    path: 'worker',
    canActivate: [authGuard, workerGuard],
    loadChildren: () =>
      import('./features/worker/worker.routes').then(m => m.workerRoutes),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then(m => m.NotFoundComponent),
  },
];
