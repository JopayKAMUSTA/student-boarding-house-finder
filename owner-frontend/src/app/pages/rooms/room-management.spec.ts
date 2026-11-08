import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import { ManagedRoomInfo, OwnerAuth } from '../../services/owner-auth';
import { RoomManagement } from './room-management';

describe('RoomManagement', () => {
  let component: RoomManagement;
  let fixture: ComponentFixture<RoomManagement>;
  let deleteResponse: () => Observable<{ success: boolean; message?: string }>;
  let response: {
    success: boolean;
    boarding_house: {
      id: number;
      name: string;
      address: string;
      barangay: string | null;
      city: string;
    };
    data: {
      data: ManagedRoomInfo[];
      total: number;
      current_page: number;
      last_page: number;
    };
  };

  beforeEach(async () => {
    response = {
      success: true,
      boarding_house: {
        id: 42,
        name: 'Owner House',
        address: '123 Main Street',
        barangay: 'Mankilam',
        city: 'Tagum City'
      },
      data: { data: [], total: 0, current_page: 1, last_page: 1 }
    };
    deleteResponse = () => of({ success: true });
    await TestBed.configureTestingModule({
      imports: [RoomManagement],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ boardingHouseId: '42' })
            }
          }
        },
        {
          provide: OwnerAuth,
          useValue: {
            getToken: () => 'owner-token',
            getOwnerRooms: () => of(response),
            getOwnerRoomImage: () => of(new Blob(['photo'])),
            deleteOwnerRoom: () => deleteResponse()
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RoomManagement);
    component = fixture.componentInstance;
  });

  it('shows the selected boarding house and an empty rooms state', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Owner House');
    expect(fixture.nativeElement.textContent).toContain('Mankilam');
    expect(fixture.nativeElement.textContent).toContain('No rooms added yet');
  });

  it('displays room data and its image when rooms exist', async () => {
    response.data.data = [{
      id: 9,
      boarding_house_id: 42,
      room_number: '201',
      room_type: 'Single Room',
      monthly_rent: '5000.00',
      pricing_basis: 'per_person',
      max_occupants: 1,
      availability_status: 'available',
      description: null,
      amenities: ['Bed'],
      images: [{ id: 4, image_path: 'room-images/room.png', url: '/storage/room-images/room.png' }]
    }];
    response.data.total = 1;
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.rooms[0].images).toHaveLength(1);

    expect(fixture.nativeElement.textContent).toContain('201');
    expect(fixture.nativeElement.textContent).toContain('Single Room');
    expect(fixture.nativeElement.textContent).toContain('View Details');
    expect(fixture.nativeElement.textContent).toContain('Edit Room');
    const roomLinks = Array.from(
      fixture.nativeElement.querySelectorAll('.room-actions a') as NodeListOf<HTMLAnchorElement>
    );
    expect(roomLinks.map((link) => link.getAttribute('href'))).toContain(
      '/owner/boarding-houses/42/rooms/9'
    );
    expect(roomLinks.map((link) => link.textContent?.trim())).toContain('View Details');
    expect(fixture.nativeElement.querySelector('img')).not.toBeNull();
  });

  it('removes a room immediately and restores it if deletion fails', async () => {
    const room: ManagedRoomInfo = {
      id: 9,
      boarding_house_id: 42,
      room_number: '201',
      room_type: 'Single Room',
      monthly_rent: 5000,
      pricing_basis: 'per_person',
      max_occupants: 1,
      availability_status: 'available',
      description: null,
      amenities: [],
      images: []
    };
    response.data.data = [room];
    response.data.total = 1;
    const deleteRequest = new Subject<{ success: boolean; message?: string }>();
    deleteResponse = () => deleteRequest;
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    fixture.detectChanges();
    component.deleteRoom(room);
    fixture.detectChanges();

    expect(component.rooms).toHaveLength(0);
    expect(component.total).toBe(0);
    expect(component.deletingRoomId).toBe(room.id);
    expect(fixture.nativeElement.textContent).toContain('Deleting room and its photos...');
    expect(fixture.nativeElement.textContent).not.toContain('201');

    deleteRequest.error(new HttpErrorResponse({
      status: 500,
      error: { message: 'The room could not be deleted.' }
    }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.rooms).toEqual([room]);
    expect(component.total).toBe(1);
    expect(component.deletingRoomId).toBeNull();
    expect(component.errorMessage).toBe('The room could not be deleted.');
    expect(fixture.nativeElement.textContent).toContain('201');
    expect(fixture.nativeElement.textContent).not.toContain('Deleting room and its photos...');
    vi.restoreAllMocks();
  });

  it('keeps the room removed after successful deletion', async () => {
    const room: ManagedRoomInfo = {
      id: 9,
      boarding_house_id: 42,
      room_number: '201',
      room_type: 'Single Room',
      monthly_rent: 5000,
      pricing_basis: 'per_person',
      max_occupants: 1,
      availability_status: 'available',
      description: null,
      amenities: [],
      images: []
    };
    response.data.data = [room];
    response.data.total = 1;
    const deleteRequest = new Subject<{ success: boolean; message?: string }>();
    deleteResponse = () => deleteRequest;
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    fixture.detectChanges();
    component.deleteRoom(room);
    deleteRequest.next({ success: true });
    deleteRequest.complete();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.rooms).toHaveLength(0);
    expect(component.total).toBe(0);
    expect(component.deletingRoomId).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('201');
    expect(fixture.nativeElement.textContent).not.toContain('Deleting room and its photos...');
    vi.restoreAllMocks();
  });
});
