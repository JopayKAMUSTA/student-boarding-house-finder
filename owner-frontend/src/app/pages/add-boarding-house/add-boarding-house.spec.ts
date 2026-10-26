import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { NgForm } from '@angular/forms';
import { of } from 'rxjs';
import { AddBoardingHouse } from './add-boarding-house';
import { CreateBoardingHouseData, OwnerAuth } from '../../services/owner-auth';

describe('AddBoardingHouse', () => {
  let component: AddBoardingHouse;
  let fixture: ComponentFixture<AddBoardingHouse>;
  let createdPayload: CreateBoardingHouseData | null;

  beforeEach(async () => {
    createdPayload = null;
    await TestBed.configureTestingModule({
      imports: [AddBoardingHouse],
      providers: [
        provideRouter([]),
        {
          provide: OwnerAuth,
          useValue: {
            getToken: () => 'test-owner-token',
            createOwnerBoardingHouse: (
              _token: string,
              payload: CreateBoardingHouseData
            ) => {
              createdPayload = payload;
              return of({
                success: true,
                message: 'Boarding house submitted.',
                data: { total_rooms: 3, available_rooms: 2 }
              });
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AddBoardingHouse);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('submits validated fields and amenities without an owner id', () => {
    component.formModel = {
      name: 'Sample House',
      description: 'Near the campus',
      city: 'Tagum City',
      barangay: 'Mankilam',
      address: '123 Main Street',
      monthly_rent: 4500,
      security_deposit: 1000,
      advance_payment: 4500,
      available_rooms: 2,
      total_rooms: 3,
      room_type: 'Single'
    };
    component.amenitiesInput = 'Wi-Fi, Water';
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(NgForm)).injector.get(NgForm);

    component.submit(form);

    expect(createdPayload).toEqual({
      name: 'Sample House',
      description: 'Near the campus',
      city: 'Tagum City',
      barangay: 'Mankilam',
      address: '123 Main Street',
      monthly_rent: 4500,
      security_deposit: 1000,
      advance_payment: 4500,
      available_rooms: 2,
      total_rooms: 3,
      room_type: 'Single',
      amenities: ['Wi-Fi', 'Water']
    });
    expect('owner_id' in (createdPayload ?? {})).toBe(false);
    expect(component.successMessage).toBe('Boarding house submitted.');
  });

  it('rejects available rooms greater than total rooms', () => {
    component.formModel = {
      name: 'Sample House',
      description: '',
      city: 'Tagum City',
      barangay: '',
      address: '123 Main Street',
      monthly_rent: 4500,
      security_deposit: null,
      advance_payment: null,
      available_rooms: 4,
      total_rooms: 3,
      room_type: ''
    };
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(NgForm)).injector.get(NgForm);

    component.submit(form);

    expect(createdPayload).toBeNull();
    expect(component.errorMessage).toContain('cannot exceed total rooms');
  });
});
