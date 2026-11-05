import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import {
  AdminBoardingHouse,
  AdminBoardingHousePageResponse,
  AdminBoardingHouseResponse,
  AdminBoardingHouseStatusResponse,
  UserService
} from '../../services/user';
import { BoardingHouses } from './boarding-houses';
import { convertToParamMap } from '@angular/router';

describe('BoardingHouses', () => {
  let component: BoardingHouses;
  let routeParams: BehaviorSubject<ParamMap>;
  let userService: {
    getAdminBoardingHouses: ReturnType<typeof vi.fn>;
    getAdminBoardingHouse: ReturnType<typeof vi.fn>;
    updateAdminBoardingHouseStatus: ReturnType<typeof vi.fn>;
    getAdminBoardingHouseImage: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let currentHouse: AdminBoardingHouse;

  const house: AdminBoardingHouse = {
    id: 12,
    owner_id: 7,
    name: 'Tagum Student House',
    description: 'Near campus',
    city: 'Tagum City',
    barangay: 'Mankilam',
    address: '12 Main Street',
    monthly_rent: '4500.00',
    security_deposit: '1000.00',
    advance_payment: '4500.00',
    available_rooms: 2,
    total_rooms: 3,
    room_type: 'Single Room',
    amenities: ['Wi-Fi', 'Laundry'],
    status: 'pending',
    created_at: '2026-10-01T00:00:00.000000Z',
    updated_at: '2026-10-01T00:00:00.000000Z',
    owner: {
      id: 7,
      name: 'Casey Owner',
      first_name: 'Casey',
      middle_name: null,
      last_name: 'Owner',
      email: 'casey@example.com',
      role: 'owner',
      status: 'active',
      owner_profile: {
        contact_number: '09123456789',
        business_name: 'Casey Boarding',
        business_address: 'Tagum City',
        verification_status: 'approved',
        verified_at: null
      }
    },
    rooms: [{
      id: 4,
      boarding_house_id: 12,
      room_number: '101',
      room_type: 'Single Room',
      monthly_rent: '4500.00',
      pricing_basis: 'per_person',
      max_occupants: 1,
      availability_status: 'available',
      description: 'Bright room',
      amenities: ['Bed'],
      images: [{
        id: 9,
        boarding_house_room_id: 4,
        image_path: 'room-images/room.png',
        url: 'http://127.0.0.1:8000/api/admin/boarding-houses/12/rooms/4/images/9'
      }]
    }]
  };

  const pageResponse: AdminBoardingHousePageResponse = {
    success: true,
    data: {
      data: [house],
      current_page: 1,
      last_page: 2,
      total: 16,
      per_page: 15
    }
  };

  beforeEach(() => {
    routeParams = new BehaviorSubject(convertToParamMap({}));
    currentHouse = house;
    userService = {
      getAdminBoardingHouses: vi.fn().mockReturnValue(of(pageResponse)),
      getAdminBoardingHouse: vi.fn().mockImplementation(
        () => of({ success: true, data: currentHouse } satisfies AdminBoardingHouseResponse)
      ),
      updateAdminBoardingHouseStatus: vi.fn().mockImplementation(
        (_boardingHouseId: number, status: 'approved' | 'rejected') => {
          currentHouse = { ...currentHouse, status };
          return of({
          success: true,
            message: `Boarding house ${status}.`,
            data: currentHouse
          } satisfies AdminBoardingHouseStatusResponse);
        }
      ),
      getAdminBoardingHouseImage: vi.fn().mockReturnValue(
        of(new Blob(['room photo'], { type: 'image/png' }))
      )
    };
    router = { navigate: vi.fn().mockResolvedValue(true) };
    component = new BoardingHouses(
      userService as unknown as UserService,
      { paramMap: routeParams.asObservable() } as ActivatedRoute,
      router as unknown as Router
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('loads the paginated list, filters status, and changes pages', () => {
    component.ngOnInit();
    expect(component.boardingHouses).toEqual([house]);
    expect(component.total).toBe(16);

    component.filterByStatus('rejected');
    expect(userService.getAdminBoardingHouses).toHaveBeenLastCalledWith('rejected', 1);
    component.changePage(2);
    expect(userService.getAdminBoardingHouses).toHaveBeenLastCalledWith('rejected', 2);
  });

  it('loads details and room photos as object URLs, then revokes previews on cleanup', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:room-preview');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    component.handleRoute(convertToParamMap({ boardingHouseId: '12' }));

    expect(component.selectedBoardingHouse?.name).toBe('Tagum Student House');
    expect(userService.getAdminBoardingHouse).toHaveBeenCalledWith(12);
    expect(userService.getAdminBoardingHouseImage).toHaveBeenCalledWith(house.rooms?.[0].images[0].url);
    expect(component.imageUrls.get(9)).toBe('blob:room-preview');

    component.ngOnDestroy();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:room-preview');
  });

  it('confirms decisions, updates pending listings, and refreshes listing and details', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.ngOnInit();
    component.handleRoute(convertToParamMap({ boardingHouseId: '12' }));
    const initialListCalls = userService.getAdminBoardingHouses.mock.calls.length;
    const initialDetailCalls = userService.getAdminBoardingHouse.mock.calls.length;

    component.decideStatus(house, 'approved');

    expect(userService.updateAdminBoardingHouseStatus)
      .toHaveBeenCalledWith(12, 'approved');
    expect(component.successMessage).toBe('Boarding house approved.');
    expect(userService.getAdminBoardingHouses).toHaveBeenCalledTimes(initialListCalls + 1);
    expect(userService.getAdminBoardingHouse).toHaveBeenCalledTimes(initialDetailCalls + 1);
    expect(component.selectedBoardingHouse?.status).toBe('approved');
  });

  it('does not send a decision if confirmation is declined or listing is not pending', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    component.decideStatus(house, 'rejected');
    component.decideStatus({ ...house, status: 'approved' }, 'rejected');
    expect(userService.updateAdminBoardingHouseStatus).not.toHaveBeenCalled();
  });

  it('reports list and status request errors', () => {
    userService.getAdminBoardingHouses.mockReturnValue(
      throwError(() => ({ status: 500, error: { message: 'List unavailable.' } }))
    );
    component.loadBoardingHouses();
    expect(component.errorMessage).toBe('List unavailable.');

    userService.updateAdminBoardingHouseStatus.mockReturnValue(
      throwError(() => ({ status: 500, error: { message: 'Update unavailable.' } }))
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.decideStatus(house, 'rejected');
    expect(component.errorMessage).toBe('Update unavailable.');
    expect(component.actionLoadingId).toBeNull();
  });

  it('shows an image error when the authenticated image request fails', () => {
    userService.getAdminBoardingHouseImage.mockReturnValue(
      throwError(() => ({ status: 403 }))
    );

    component.handleRoute(convertToParamMap({ boardingHouseId: '12' }));

    expect(component.imageErrors.get(9)).toBe('Image could not be loaded.');
    expect(component.imageLoading.has(9)).toBe(false);
  });
});
