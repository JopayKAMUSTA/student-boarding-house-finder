import { describe, expect, it } from 'vitest';
import { AddBoardingHouse } from './pages/add-boarding-house/add-boarding-house';
import { Dashboard } from './pages/dashboard/dashboard';
import { OwnerProfile } from './pages/owner-profile/owner-profile';
import { RoomForm } from './pages/rooms/room-form';
import { RoomDetails } from './pages/rooms/room-details';
import { RoomManagement } from './pages/rooms/room-management';
import { TenantManagement } from './pages/tenants/tenant-management';
import { OwnerLayout } from './layouts/owner-layout';
import { ownerAuthGuard } from './guards/owner-auth.guard';
import { routes } from './app.routes';

describe('owner routes', () => {
  const ownerRoutes = routes.find((route) => route.component === OwnerLayout)?.children ?? [];

  it('keeps the add-boarding-house page on its own route', () => {
    expect(ownerRoutes.find((route) => route.path === 'add-boarding-house')?.component)
      .toBe(AddBoardingHouse);
  });

  it('routes add-room and edit-room URLs to RoomForm', () => {
    const addRoom = ownerRoutes.find((route) =>
      route.path === 'owner/boarding-houses/:boardingHouseId/rooms/new'
    );
    const editRoom = ownerRoutes.find((route) =>
      route.path === 'owner/boarding-houses/:boardingHouseId/rooms/:roomId/edit'
    );

    expect(addRoom?.component).toBe(RoomForm);
    expect(editRoom?.component).toBe(RoomForm);
  });

  it('routes room details to the read-only RoomDetails page', () => {
    expect(ownerRoutes.find((route) =>
      route.path === 'owner/boarding-houses/:boardingHouseId/rooms/:roomId'
    )?.component).toBe(RoomDetails);
  });

  it('keeps the room-list route on RoomManagement', () => {
    expect(ownerRoutes.find((route) =>
      route.path === 'owner/boarding-houses/:boardingHouseId/rooms'
    )?.component).toBe(RoomManagement);
  });

  it('protects tenant management inside the shared owner layout', () => {
    expect(ownerRoutes.find((route) => route.path === 'owner/tenants')?.component)
      .toBe(TenantManagement);
    expect(routes.find((route) => route.component === OwnerLayout)?.canActivate)
      .toContain(ownerAuthGuard);
  });

  it('keeps the other owner pages inside the shared layout', () => {
    expect(ownerRoutes.find((route) => route.path === 'dashboard')?.component).toBe(Dashboard);
    expect(ownerRoutes.find((route) => route.path === 'owner-profile')?.component)
      .toBe(OwnerProfile);
  });
});
