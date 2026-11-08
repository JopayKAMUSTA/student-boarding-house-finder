import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { vi } from 'vitest';
import { ManagedRoomInfo, OwnerAuth } from '../../services/owner-auth';
import { RoomDetails } from './room-details';

describe('RoomDetails', () => {
  let fixture: ComponentFixture<RoomDetails>;
  let component: RoomDetails;
  let routeParams = convertToParamMap({ boardingHouseId: '42', roomId: '7' });
  let room: ManagedRoomInfo;
  let requestedRoom: { boardingHouseId: number; roomId: number } | null;

  beforeEach(async () => {
    routeParams = convertToParamMap({ boardingHouseId: '42', roomId: '7' });
    requestedRoom = null;
    room = {
      id: 7,
      boarding_house_id: 42,
      room_number: '201',
      room_type: 'Double-Sharing Room',
      monthly_rent: '3500.00',
      pricing_basis: 'per_person',
      max_occupants: 3,
      availability_status: 'occupied',
      description: 'Bright room near the study area.',
      amenities: ['Bed', 'Study table'],
      images: [],
      current_occupant_count: 2,
      current_occupants: [{
        tenant_id: 21,
        full_name: 'Alex Tenant',
        contact_number: '09171234567',
        emergency_contact_name: 'Sam Tenant',
        emergency_contact_number: '09179990000',
        move_in_date: '2026-11-01',
        monthly_rent: '3200.00',
        status: 'active'
      }]
    };

    await TestBed.configureTestingModule({
      imports: [RoomDetails],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              get paramMap() {
                return routeParams;
              }
            }
          }
        },
        {
          provide: OwnerAuth,
          useValue: {
            getToken: () => 'owner-token',
            getOwnerRoom: (
              _token: string,
              boardingHouseId: number,
              roomId: number
            ) => {
              requestedRoom = { boardingHouseId, roomId };
              return of({ success: true, data: room });
            },
            getOwnerRoomImage: () => EMPTY,
            clearSession: vi.fn()
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RoomDetails);
    component = fixture.componentInstance;
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  it('loads room details with occupants, amenities, capacity and photos state', () => {
    fixture.detectChanges();

    expect(requestedRoom).toEqual({ boardingHouseId: 42, roomId: 7 });
    expect(component.room).toEqual(room);
    expect(fixture.nativeElement.textContent).toContain('Room 201');
    expect(fixture.nativeElement.textContent).toContain('Double-Sharing Room');
    expect(fixture.nativeElement.textContent).toContain('₱3,500');
    expect(fixture.nativeElement.textContent).toContain('Study table');
    expect(fixture.nativeElement.textContent).toContain('Bright room near the study area.');
    expect(fixture.nativeElement.textContent).toContain('2 / 3 occupants');
    expect(fixture.nativeElement.textContent).toContain('Alex Tenant');
    expect(fixture.nativeElement.textContent).toContain('09171234567');
    expect(fixture.nativeElement.textContent).toContain('No room photos uploaded.');
    expect(fixture.nativeElement.querySelector('a.btn-primary')?.textContent).toContain('Edit Room');
  });

  it('shows an empty state for a room with no occupants or amenities', () => {
    room = {
      ...room,
      amenities: [],
      current_occupant_count: 0,
      current_occupants: []
    };

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('0 / 3 occupants');
    expect(fixture.nativeElement.textContent).toContain('No current occupants.');
    expect(fixture.nativeElement.textContent).toContain('No amenities listed.');
  });
});
