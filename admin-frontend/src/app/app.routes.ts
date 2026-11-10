
import { Routes } from '@angular/router';

import { AdminLayoutComponent } from './layouts/admin-layout/admin-layout';
import { Dashboard } from './pages/dashboard/dashboard';
import { Login } from './pages/login/login';
import { Users } from './pages/users/users';
import { BoardingHouses } from './pages/boarding-houses/boarding-houses';
import { OwnerManagement } from './pages/owner-management/owner-management';
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
        component: OwnerManagement
      },

      {
        path: 'boarding-houses',
        component: BoardingHouses
      }

    ]
  },

  {
    path: '**',
    redirectTo: 'login'
  }

];

