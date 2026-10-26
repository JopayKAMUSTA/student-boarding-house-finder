import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Dashboard } from './dashboard';
import { OwnerAuth, OwnerBoardingHousePageResponse } from '../../services/owner-auth';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;
  let response: OwnerBoardingHousePageResponse;

  beforeEach(async () => {
    response = {
      success: true,
      data: { data: [], total: 0, current_page: 1, last_page: 1 }
    };
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        {
          provide: OwnerAuth,
          useValue: {
            getOwner: () => null,
            getToken: () => 'test-token',
            getOwnerBoardingHouses: () => of(response)
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

    expect(component.totalBoardingHouses).toBe(2);
    expect(component.availableRooms).toBe(3);
    expect(component.occupiedRooms).toBe(5);
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
