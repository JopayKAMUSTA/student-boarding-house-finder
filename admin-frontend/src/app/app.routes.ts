
import { Routes } from '@angular/router';

import { AdminLayoutComponent } from './layouts/admin-layout/admin-layout';
import { Dashboard } from './pages/dashboard/dashboard';
import { Login } from './pages/login/login';
import { Users } from './pages/users/users';
import { OwnerVerification } from './pages/owner-verification/owner-verification';
import { BoardingHouses } from './pages/boarding-houses/boarding-houses';
import { authGuard } from './guards/auth-guard';

export const routes: Routes = [

  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },

  {
    path: 'login',
    component: Login
  },

  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [authGuard],
    children: [

      {
        path: 'dashboard',
        component: Dashboard
      },

      {
        path: 'users',
        component: Users
      },

      {
        path: 'owners',
        component: OwnerVerification
      },

      {
        path: 'boarding-houses',
        component: BoardingHouses
      },

      {
        path: 'boarding-houses/:boardingHouseId',
        component: BoardingHouses
      },

      {
        path: 'owner-verification',
        redirectTo: 'owners',
        pathMatch: 'full'
      }

    ]
  },

  {
    path: '**',
    redirectTo: 'login'
  }

];
