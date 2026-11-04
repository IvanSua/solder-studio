import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const workerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const role = auth.user()?.role;
  if (role === 'WORKER' || role === 'ADMIN') {
    return true;
  }
  return router.createUrlTree(['/']);
};
