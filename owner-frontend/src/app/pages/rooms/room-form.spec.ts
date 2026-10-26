import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgForm } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { OwnerAuth } from '../../services/owner-auth';
import { RoomForm } from './room-form';

describe('RoomForm', () => {
  let fixture: ComponentFixture<RoomForm>;
  let component: RoomForm;
  let submittedData: FormData | null;

  beforeEach(async () => {
    submittedData = null;
    await TestBed.configureTestingModule({
      imports: [RoomForm],
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
            createOwnerRoom: (_token: string, _boardingHouseId: number, data: FormData) => {
              submittedData = data;
              return of({
                success: true,
                data: { id: 2, images: [] }
              });
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RoomForm);
    component = fixture.componentInstance;
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  it('creates a room with selected amenities and photos as multipart form data', () => {
    component.formModel = {
      room_number: '201',
      room_type: 'Double-Sharing Room',
      monthly_rent: 3500,
      pricing_basis: 'per_person',
      max_occupants: 2,
      availability_status: 'available',
      description: 'Bright room'
    };
    component.amenities = new Set(['Bed', 'Study table']);
    const photo = new File(['image bytes'], 'room.png', { type: 'image/png' });
    component.selectedImages = [{ file: photo, url: 'blob:preview' }];
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(NgForm)).injector.get(NgForm);

    component.submit(form);

    expect(submittedData).toBeInstanceOf(FormData);
    expect(submittedData?.get('room_number')).toBe('201');
    expect(submittedData?.get('monthly_rent')).toBe('3500');
    expect(submittedData?.getAll('amenities[0]')).toEqual(['Bed']);
    expect(submittedData?.getAll('amenities[1]')).toEqual(['Study table']);
    expect(submittedData?.getAll('images[]')).toEqual([photo]);
  });

  it('rejects an invalid rent before making an API request', () => {
    component.formModel = {
      room_number: '201',
      room_type: 'Single Room',
      monthly_rent: 0,
      pricing_basis: 'per_person',
      max_occupants: 1,
      availability_status: 'available',
      description: ''
    };
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(NgForm)).injector.get(NgForm);

    component.submit(form);

    expect(submittedData).toBeNull();
    expect(component.errorMessage).toContain('Rent must be positive');
  });

  it('supports adding multiple custom amenities without comma-separated input', () => {
    component.newAmenity = 'Balcony';
    component.addOtherAmenity();
    component.newAmenity = 'Laundry area';
    component.addOtherAmenity();

    expect(component.otherAmenities).toEqual(['Balcony', 'Laundry area']);
  });
});
