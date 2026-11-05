import { describe, expect, it } from 'vitest';
import { AddBoardingHouse } from './pages/add-boarding-house/add-boarding-house';
import { Dashboard } from './pages/dashboard/dashboard';
import { OwnerProfile } from './pages/owner-profile/owner-profile';
import { RoomForm } from './pages/rooms/room-form';
import { RoomManagement } from './pages/rooms/room-management';
import { OwnerLayout } from './layouts/owner-layout';
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

  it('keeps the room-list route on RoomManagement', () => {
    expect(ownerRoutes.find((route) =>
      route.path === 'owner/boarding-houses/:boardingHouseId/rooms'
    )?.component).toBe(RoomManagement);
  });

  it('keeps the other owner pages inside the shared layout', () => {
    expect(ownerRoutes.find((route) => route.path === 'dashboard')?.component).toBe(Dashboard);
    expect(ownerRoutes.find((route) => route.path === 'owner-profile')?.component)
      .toBe(OwnerProfile);
  });
});
