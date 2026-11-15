import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, of, throwError } from 'rxjs';
import { Dashboard } from './dashboard';
import { OwnerAuth, OwnerBoardingHousePageResponse } from '../../services/owner-auth';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;
  let response: OwnerBoardingHousePageResponse;
  let getResponse: () => Observable<OwnerBoardingHousePageResponse>;

  beforeEach(async () => {
    response = {
      success: true,
      data: { data: [], total: 0, current_page: 1, last_page: 1 }
    };
    getResponse = () => of(response);
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        {
          provide: OwnerAuth,
          useValue: {
            getOwner: () => null,
            getToken: () => 'test-token',
            getOwnerBoardingHouses: () => getResponse(),
            getOwnerProfile: () => of({
              user: { id: 1, first_name: 'Owner', last_name: 'User', email: 'owner@example.com', role: 'owner', created_at: '2026-01-01' },
              profile: { verification_status: 'approved', contact_number: null, business_name: null, business_address: null, verified_at: null }
            }),
            getOwnerTenants: () => of({
              success: true,
              data: { data: [], total: 0, current_page: 1, last_page: 1 }
            }),
            getOwnerRentalBills: () => of({
              success: true,
              data: { data: [], total: 0, current_page: 1, last_page: 1, per_page: 15 }
            }),
            getOwnerRentalPaymentSubmissions: () => of({
              success: true,
              data: { data: [], total: 0, current_page: 1, last_page: 1, per_page: 15 }
            })
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('shows totals only when the response contains every boarding house', async () => {
    response = {
      success: true,
      data: {
        total: 2,
        current_page: 1,
        last_page: 1,
        data: [
          { total_rooms: 5, available_rooms: 2 },
          { total_rooms: 3, available_rooms: 1 }
        ]
      }
    };

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.totalBoardingHouses).toBe(2);
    expect(component.availableRooms).toBe(3);
    expect(component.occupiedRooms).toBe(5);
  });

  it('updates the dashboard and clears loading for the API response', async () => {
    const responseSubject = new Subject<OwnerBoardingHousePageResponse>();
    getResponse = () => responseSubject;

    fixture.detectChanges();
    expect(component.isLoadingSummary).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(
      'Loading your boarding-house summary...'
    );

    responseSubject.next({
      success: true,
      data: {
        current_page: 1,
        data: [
          { id: 4, available_rooms: 8, total_rooms: 10, status: 'pending' },
          { id: 3, available_rooms: 15, total_rooms: 15, status: 'pending' }
        ],
        last_page: 1,
        total: 2
      }
    });
    responseSubject.complete();

    await fixture.whenStable();

    expect(component.isLoadingSummary).toBe(false);
    expect(component.totalBoardingHouses).toBe(2);
    expect(component.availableRooms).toBe(23);
    expect(component.occupiedRooms).toBe(2);
    expect(component.pendingBoardingHouses).toBe(2);
    expect(fixture.nativeElement.textContent).not.toContain(
      'Loading your boarding-house summary...'
    );
    expect(fixture.nativeElement.textContent).toContain('23');
    expect(fixture.nativeElement.textContent).toContain('2');
    expect(fixture.nativeElement.textContent).toContain('Pending boarding houses');
    expect(fixture.nativeElement.textContent).not.toContain('Pending tasks');
  });

  it('counts only boarding houses with pending status', async () => {
    response = {
      success: true,
      data: {
        current_page: 1,
        data: [
          { available_rooms: 2, total_rooms: 3, status: 'pending' },
          { available_rooms: 1, total_rooms: 2, status: 'approved' },
          { available_rooms: 0, total_rooms: 1, status: 'rejected' }
        ],
        last_page: 1,
        total: 3
      }
    };

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.pendingBoardingHouses).toBe(1);
  });

  it('clears loading and displays an error when the request fails', async () => {
    getResponse = () => throwError(() => new HttpErrorResponse({
      status: 500,
      error: { message: 'Summary request failed.' }
    }));

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.isLoadingSummary).toBe(false);
    expect(component.summaryError).toBe('Summary request failed.');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Loading your boarding-house summary...'
    );
    expect(fixture.nativeElement.textContent).toContain('Summary request failed.');
  });

  it('does not present partial room totals as complete metrics', async () => {
    response = {
      success: true,
      data: {
        total: 11,
        current_page: 1,
        last_page: 2,
        data: [{ total_rooms: 5, available_rooms: 2 }]
      }
    };

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.totalBoardingHouses).toBe(11);
    expect(component.availableRooms).toBeNull();
    expect(component.occupiedRooms).toBeNull();
  });
});
