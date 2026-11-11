import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { BoardingHouses } from './boarding-houses';
import {
  BillingPolicy,
  BoardingHouseSettingsData,
  OwnerBoardingHousePageResponse,
  OwnerAuth,
  UpdateBoardingHouseSettingsResponse,
  UpdateBoardingHouseBillingPolicyResponse
} from '../../services/owner-auth';

describe('BoardingHouses', () => {
  let component: BoardingHouses;
  let fixture: ComponentFixture<BoardingHouses>;
  let response: OwnerBoardingHousePageResponse;
  let requestedPage: number | undefined;
  let updateBillingPolicy: (
    token: string,
    boardingHouseId: number,
    policy: BillingPolicy
  ) => Observable<UpdateBoardingHouseBillingPolicyResponse>;
  let updateRequest: { token: string; id: number; policy: BillingPolicy } | null;
  let updateSettings: (
    token: string,
    boardingHouseId: number,
    settings: BoardingHouseSettingsData
  ) => Observable<UpdateBoardingHouseSettingsResponse>;
  let settingsUpdateRequest: {
    token: string;
    id: number;
    settings: BoardingHouseSettingsData;
  } | null;

  beforeEach(async () => {
    response = {
      success: true,
      data: { data: [], total: 0, current_page: 1, last_page: 1 }
    };
    requestedPage = undefined;
    updateRequest = null;
    settingsUpdateRequest = null;
    updateBillingPolicy = (token, id, policy) => {
      updateRequest = { token, id, policy };
      return of({
        success: true,
        message: 'Policy saved.',
        data: {
          id,
          name: 'Owner House',
          total_rooms: 4,
          available_rooms: 2,
          billing_policy: policy
        }
      });
    };
    updateSettings = (token, id, settings) => {
      settingsUpdateRequest = { token, id, settings };
      return of({
        success: true,
        message: 'Settings saved.',
        data: {
          id,
          name: 'Owner House',
          description: 'Existing house description',
          total_rooms: 4,
          available_rooms: 2,
          late_payment_fee: settings.late_payment_fee,
          grace_period_days: settings.grace_period_days,
          rules: settings.rules
        }
      });
    };
    await TestBed.configureTestingModule({
      imports: [BoardingHouses],
      providers: [
        provideRouter([]),
        {
          provide: OwnerAuth,
          useValue: {
            getToken: () => 'test-owner-token',
            getOwnerBoardingHouses: (_token: string, page: number) => {
              requestedPage = page;
              return of(response);
            },
            updateOwnerBoardingHouseBillingPolicy: (
              token: string,
              id: number,
              policy: BillingPolicy
            ) => updateBillingPolicy(token, id, policy),
            updateOwnerBoardingHouseSettings: (
              token: string,
              id: number,
              settings: BoardingHouseSettingsData
            ) => updateSettings(token, id, settings),
            clearSession: () => undefined
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BoardingHouses);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('shows an empty state when the owner has no boarding houses', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('You have not added any boarding houses yet.');
    expect(component.total).toBe(0);
    expect(requestedPage).toBe(1);
  });

  it('displays the owner list and supports server pagination', async () => {
    response = {
      success: true,
      data: {
        data: [{
          id: 8,
          name: 'Owner House',
          city: 'Tagum City',
          monthly_rent: '5000.00',
          total_rooms: 4,
          available_rooms: 2,
          status: 'pending',
          billing_policy: 'full_monthly'
        }],
        total: 11,
        current_page: 1,
        last_page: 2
      }
    };
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Owner House');
    expect(fixture.nativeElement.textContent).toContain('Tagum City');
    expect(fixture.nativeElement.textContent).toContain('₱0.00');
    expect(fixture.nativeElement.textContent).toContain('0 days');
    expect(component.total).toBe(11);

    component.nextPage();
    expect(requestedPage).toBe(2);
  });

  it('updates and displays the saved policy after the API succeeds', async () => {
    response = {
      success: true,
      data: {
        data: [{
          id: 8,
          name: 'Owner House',
          city: 'Tagum City',
          total_rooms: 4,
          available_rooms: 2,
          billing_policy: 'full_monthly'
        }],
        total: 1,
        current_page: 1,
        last_page: 1
      }
    };
    fixture.detectChanges();
    await fixture.whenStable();
    const house = component.boardingHouses[0];
    component.setBillingPolicyDraft(house, 'prorated');

    component.saveBillingPolicy(house);
    fixture.detectChanges();

    expect(updateRequest).toEqual({
      token: 'test-owner-token',
      id: 8,
      policy: 'prorated'
    });
    expect(house.billing_policy).toBe('prorated');
    expect(fixture.nativeElement.textContent).toContain('Prorated');
    expect(component.billingPolicySuccess[8]).toBe('Policy saved.');
  });

  it('displays saved late-payment settings and separate rules, then saves changes', async () => {
    response = {
      success: true,
      data: {
        data: [{
          id: 8,
          name: 'Owner House',
          description: 'Existing house description',
          city: 'Tagum City',
          total_rooms: 4,
          available_rooms: 2,
          late_payment_fee: '125.50',
          grace_period_days: 5,
          rules: 'Quiet hours after 10 PM'
        }],
        total: 1,
        current_page: 1,
        last_page: 1
      }
    };
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const house = component.boardingHouses[0];

    expect(fixture.nativeElement.textContent).toContain('₱125.50');
    expect(fixture.nativeElement.textContent).toContain('5 days');
    expect(fixture.nativeElement.textContent).toContain('Quiet hours after 10 PM');
    expect(house.description).toBe('Existing house description');

    component.settingsDraft(house).late_payment_fee = 250;
    component.settingsDraft(house).grace_period_days = 7;
    component.settingsDraft(house).rules = 'No smoking indoors';
    component.saveBoardingHouseSettings(house);
    fixture.detectChanges();

    expect(settingsUpdateRequest).toEqual({
      token: 'test-owner-token',
      id: 8,
      settings: {
        late_payment_fee: 250,
        grace_period_days: 7,
        rules: 'No smoking indoors'
      }
    });
    expect(house.late_payment_fee).toBe(250);
    expect(house.grace_period_days).toBe(7);
    expect(house.rules).toBe('No smoking indoors');
    expect(house.description).toBe('Existing house description');
    expect(component.boardingHouseSettingsSuccess[8]).toBe('Settings saved.');
  });

  it('keeps saved house settings unchanged when the update request fails', async () => {
    response = {
      success: true,
      data: {
        data: [{
          id: 8,
          name: 'Owner House',
          total_rooms: 4,
          available_rooms: 2,
          late_payment_fee: '125.50',
          grace_period_days: 5,
          rules: 'Saved rules'
        }],
        total: 1,
        current_page: 1,
        last_page: 1
      }
    };
    updateSettings = (_token, id, settings) => {
      settingsUpdateRequest = { token: 'test-owner-token', id, settings };
      return throwError(() => new HttpErrorResponse({
        status: 422,
        error: { message: 'Settings update failed.' }
      }));
    };
    fixture.detectChanges();
    await fixture.whenStable();
    const house = component.boardingHouses[0];
    component.settingsDraft(house).late_payment_fee = 250;
    component.saveBoardingHouseSettings(house);

    expect(house.late_payment_fee).toBe('125.50');
    expect(house.grace_period_days).toBe(5);
    expect(house.rules).toBe('Saved rules');
    expect(component.boardingHouseSettingsErrors[8]).toBe('Settings update failed.');
    expect(component.boardingHouseSettingsSaving[8]).toBe(false);
  });

  it('keeps the displayed current policy unchanged and shows an error when saving fails', async () => {
    response = {
      success: true,
      data: {
        data: [{
          id: 8,
          name: 'Owner House',
          city: 'Tagum City',
          total_rooms: 4,
          available_rooms: 2,
          billing_policy: 'full_monthly'
        }],
        total: 1,
        current_page: 1,
        last_page: 1
      }
    };
    updateBillingPolicy = (_token, id, policy) => {
      updateRequest = { token: 'test-owner-token', id, policy };
      return throwError(() => new HttpErrorResponse({
        status: 422,
        error: { message: 'Policy update failed.' }
      }));
    };
    fixture.detectChanges();
    await fixture.whenStable();
    const house = component.boardingHouses[0];
    component.setBillingPolicyDraft(house, 'prorated');

    component.saveBillingPolicy(house);
    fixture.detectChanges();

    expect(house.billing_policy).toBe('full_monthly');
    expect(component.currentBillingPolicy(house)).toBe('full_monthly');
    expect(component.billingPolicyErrors[8]).toBe('Policy update failed.');
    expect(component.billingPolicySaving[8]).toBe(false);
  });

  it('prevents duplicate policy saves while a request is pending', async () => {
    response = {
      success: true,
      data: {
        data: [{
          id: 8,
          name: 'Owner House',
          city: 'Tagum City',
          total_rooms: 4,
          available_rooms: 2,
          billing_policy: 'full_monthly'
        }],
        total: 1,
        current_page: 1,
        last_page: 1
      }
    };
    const pendingResponse = new Subject<UpdateBoardingHouseBillingPolicyResponse>();
    let requestCount = 0;
    updateBillingPolicy = (_token, id, policy) => {
      requestCount++;
      updateRequest = { token: 'test-owner-token', id, policy };
      return pendingResponse;
    };
    fixture.detectChanges();
    await fixture.whenStable();
    const house = component.boardingHouses[0];
    component.setBillingPolicyDraft(house, 'prorated');

    component.saveBillingPolicy(house);
    component.saveBillingPolicy(house);

    expect(requestCount).toBe(1);
    expect(component.billingPolicySaving[8]).toBe(true);
    expect(house.billing_policy).toBe('full_monthly');

    pendingResponse.next({
      success: true,
      message: 'Policy saved.',
      data: {
        id: 8,
        name: 'Owner House',
        total_rooms: 4,
        available_rooms: 2,
        billing_policy: 'prorated'
      }
    });
    pendingResponse.complete();
    expect(house.billing_policy).toBe('prorated');
  });
});
