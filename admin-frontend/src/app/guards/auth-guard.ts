
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const admin = authService.getAdmin();

  if (
    authService.isLoggedIn() &&
    admin &&
    admin.role === 'admin'
  ) {
    return true;
  }

  authService.clearSession();

  return router.createUrlTree(['/login']);
};
