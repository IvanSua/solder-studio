import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./admin-shell.component').then(m => m.AdminShellComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./admin-dashboard.component').then(m => m.AdminDashboardComponent),
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./admin-orders.component').then(m => m.AdminOrdersComponent),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./admin-products.component').then(m => m.AdminProductsComponent),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./admin-categories.component').then(m => m.AdminCategoriesComponent),
      },
      {
        path: 'questions',
        loadComponent: () =>
          import('./admin-questions.component').then(m => m.AdminQuestionsComponent),
      },
      {
        path: 'suggestions',
        loadComponent: () =>
          import('./admin-suggestions.component').then(m => m.AdminSuggestionsComponent),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./admin-users.component').then(m => m.AdminUsersComponent),
      },
      {
        path: 'promotions',
        loadComponent: () =>
          import('./admin-promotions.component').then(m => m.AdminPromotionsComponent),
      },
      {
        path: 'returns',
        loadComponent: () =>
          import('./admin-returns.component').then(m => m.AdminReturnsComponent),
      },
      {
        path: 'newsletter',
        loadComponent: () =>
          import('./admin-newsletter.component').then(m => m.AdminNewsletterComponent),
      },
      {
        path: 'events',
        loadComponent: () =>
          import('./admin-events.component').then(m => m.AdminEventsComponent),
      },
      {
        path: 'gift-cards',
        loadComponent: () =>
          import('./admin-gift-cards.component').then(m => m.AdminGiftCardsComponent),
      },
      {
        path: 'size-guides',
        loadComponent: () =>
          import('./admin-size-guides.component').then(m => m.AdminSizeGuidesComponent),
      },
      {
        path: 'blog',
        loadComponent: () =>
          import('./admin-blog.component').then(m => m.AdminBlogComponent),
      },
      {
        path: 'reviews',
        loadComponent: () =>
          import('./admin-reviews.component').then(m => m.AdminReviewsComponent),
      },
      {
        path: 'shipping',
        loadComponent: () =>
          import('./admin-shipping.component').then(m => m.AdminShippingComponent),
      },
      {
        path: 'bulk-upload',
        loadComponent: () =>
          import('./admin-bulk-upload.component').then(m => m.AdminBulkUploadComponent),
      },
    ],
  },
];
