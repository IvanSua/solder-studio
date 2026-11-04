import { Routes } from '@angular/router';

export const workerRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./worker-shell.component').then(m => m.WorkerShellComponent),
    children: [
      {
        path: '',
        redirectTo: 'orders',
        pathMatch: 'full',
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./worker-orders.component').then(m => m.WorkerOrdersComponent),
      },
    ],
  },
];
