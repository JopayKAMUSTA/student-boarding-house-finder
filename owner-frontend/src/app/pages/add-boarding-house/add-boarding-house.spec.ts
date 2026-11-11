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
    expect(fixture.nativeElement.querySelector('#rules')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#late_payment_fee')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#grace_period_days')).toBeTruthy();
  });

  it('defaults the billing policy to full monthly', () => {
    expect(component.formModel.billing_policy).toBe('full_monthly');

    component.formModel = {
      ...component.formModel,
      name: 'Sample House',
      city: 'Tagum City',
      address: '123 Main Street',
      monthly_rent: 4500,
      available_rooms: 2,
      total_rooms: 3
    };
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(NgForm)).injector.get(NgForm);
    component.submit(form);

    expect(createdPayload?.billing_policy).toBe('full_monthly');
    expect(createdPayload?.late_payment_fee).toBe(0);
    expect(createdPayload?.grace_period_days).toBe(0);
    expect(createdPayload?.rules).toBeNull();
  });

  it('submits validated fields and amenities without an owner id', () => {
    component.formModel = {
      name: 'Sample House',
      description: 'Near the campus',
      city: 'Tagum City',
      barangay: 'Mankilam',
      address: '123 Main Street',
      monthly_rent: 4500,
      billing_policy: 'prorated',
      security_deposit: 1000,
      advance_payment: 4500,
      late_payment_fee: 150.25,
      grace_period_days: 5,
      available_rooms: 2,
      total_rooms: 3,
      room_type: 'Single',
      rules: 'Quiet after 10 PM'
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
      billing_policy: 'prorated',
      security_deposit: 1000,
      advance_payment: 4500,
      late_payment_fee: 150.25,
      grace_period_days: 5,
      available_rooms: 2,
      total_rooms: 3,
      room_type: 'Single',
      rules: 'Quiet after 10 PM',
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
      billing_policy: 'full_monthly',
      security_deposit: null,
      advance_payment: null,
      late_payment_fee: 0,
      grace_period_days: 0,
      available_rooms: 4,
      total_rooms: 3,
      room_type: '',
      rules: ''
    };
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(NgForm)).injector.get(NgForm);

    component.submit(form);

    expect(createdPayload).toBeNull();
    expect(component.errorMessage).toContain('cannot exceed total rooms');
  });
});
