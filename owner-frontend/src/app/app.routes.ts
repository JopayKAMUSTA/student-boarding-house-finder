
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
import { RoomDetails } from './pages/rooms/room-details';
import { OwnerLayout } from './layouts/owner-layout';
import { TenantManagement } from './pages/tenants/tenant-management';
import { RentalBills } from './pages/rental-bills/rental-bills';


export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  {
    path: '',
    component: OwnerLayout,
    canActivate: [ownerAuthGuard],
    children: [
      { path: 'dashboard', component: Dashboard },
      { path: 'boarding-houses', component: BoardingHouses },
      { path: 'add-boarding-house', component: AddBoardingHouse },
      {
        path: 'owner/boarding-houses/:boardingHouseId/rooms/new',
        component: RoomForm
      },
      {
        path: 'owner/boarding-houses/:boardingHouseId/rooms/:roomId',
        component: RoomDetails
      },
      {
        path: 'owner/boarding-houses/:boardingHouseId/rooms/:roomId/edit',
        component: RoomForm
      },
      {
        path: 'owner/boarding-houses/:boardingHouseId/rooms',
        component: RoomManagement
      },
      { path: 'owner/tenants', component: TenantManagement },
      { path: 'owner/rental-bills', component: RentalBills },
      { path: 'owner-profile', component: OwnerProfile }
    ]
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];
