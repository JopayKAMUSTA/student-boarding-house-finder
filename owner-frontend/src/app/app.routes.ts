
import { Routes } from '@angular/router';

import { Login } from './pages/login/login';
import { Dashboard } from './pages/dashboard/dashboard';
import { BoardingHouses } from './pages/boarding-houses/boarding-houses';
import { AddBoardingHouse } from './pages/add-boarding-house/add-boarding-house';
import { OwnerProfile } from './pages/owner-profile/owner-profile';
import { Register } from './pages/register/register';
import { ownerAuthGuard } from './guards/owner-auth.guard';
import { RoomManagement } from './pages/rooms/room-management';
import { RoomForm } from './pages/rooms/room-form';


export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'dashboard', component: Dashboard, canActivate: [ownerAuthGuard] },
  { path: 'boarding-houses', component: BoardingHouses, canActivate: [ownerAuthGuard] },
  { path: 'add-boarding-house', component: AddBoardingHouse, canActivate: [ownerAuthGuard] },
  {
    path: 'owner/boarding-houses/:boardingHouseId/rooms',
    component: RoomManagement,
    canActivate: [ownerAuthGuard]
  },
  {
    path: 'owner/boarding-houses/:boardingHouseId/rooms/new',
    component: RoomForm,
    canActivate: [ownerAuthGuard]
  },
  {
    path: 'owner/boarding-houses/:boardingHouseId/rooms/:roomId/edit',
    component: RoomForm,
    canActivate: [ownerAuthGuard]
  },
  { path: 'owner-profile', component: OwnerProfile, canActivate: [ownerAuthGuard] },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];
