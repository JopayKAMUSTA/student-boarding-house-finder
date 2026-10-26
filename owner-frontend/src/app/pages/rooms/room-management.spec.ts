import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { OwnerAuth } from '../../services/owner-auth';
import { RoomManagement } from './room-management';

describe('RoomManagement', () => {
  let component: RoomManagement;
  let fixture: ComponentFixture<RoomManagement>;
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
      data: Array<Record<string, unknown>>;
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
            getOwnerRoomImage: () => EMPTY
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
    component.imageUrls[4] = 'blob:room-image';
    expect(component.imageUrls[4]).toBe('blob:room-image');
    expect(component.rooms[0].images).toHaveLength(1);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('201');
    expect(fixture.nativeElement.textContent).toContain('Single Room');
    expect(fixture.nativeElement.querySelector('img')).not.toBeNull();
  });
});
