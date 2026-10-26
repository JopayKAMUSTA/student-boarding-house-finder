import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { BoardingHouses } from './boarding-houses';
import { OwnerBoardingHousePageResponse, OwnerAuth } from '../../services/owner-auth';

describe('BoardingHouses', () => {
  let component: BoardingHouses;
  let fixture: ComponentFixture<BoardingHouses>;
  let response: OwnerBoardingHousePageResponse;
  let requestedPage: number | undefined;

  beforeEach(async () => {
    response = {
      success: true,
      data: { data: [], total: 0, current_page: 1, last_page: 1 }
    };
    requestedPage = undefined;
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
            }
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
          status: 'pending'
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
    expect(component.total).toBe(11);

    component.nextPage();
    expect(requestedPage).toBe(2);
  });
});
