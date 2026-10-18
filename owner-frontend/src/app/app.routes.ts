
import { Routes } from '@angular/router';

import { Login } from './pages/login/login';
import { Dashboard } from './pages/dashboard/dashboard';
import { BoardingHouses } from './pages/boarding-houses/boarding-houses';
import { AddBoardingHouse } from './pages/add-boarding-house/add-boarding-house';
import { OwnerProfile } from './pages/owner-profile/owner-profile';
import { Register } from './pages/register/register';


export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'dashboard', component: Dashboard },
  { path: 'boarding-houses', component: BoardingHouses },
  { path: 'add-boarding-house', component: AddBoardingHouse },
  { path: 'owner-profile', component: OwnerProfile },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];

