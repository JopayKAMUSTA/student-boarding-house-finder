import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { OwnerAuth } from '../services/owner-auth';

export const ownerAuthGuard: CanActivateFn = () => {
  const ownerAuth = inject(OwnerAuth);
  const router = inject(Router);

  if (!ownerAuth.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const role = ownerAuth.getOwner()?.role?.trim().toLowerCase();
  if (role && role !== 'owner') {
    ownerAuth.clearSession();
    return router.createUrlTree(['/login']);
  }

  return true;
};
