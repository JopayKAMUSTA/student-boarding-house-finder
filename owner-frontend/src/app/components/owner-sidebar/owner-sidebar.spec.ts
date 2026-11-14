import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, RouterOutlet, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { routes } from '../../app.routes';
import { OwnerAuth } from '../../services/owner-auth';

@Component({
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />'
})
class RouterHost {}

describe('OwnerSidebar rental payments navigation', () => {
  let fixture: ComponentFixture<RouterHost>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterHost],
      providers: [
        provideRouter(routes),
        {
          provide: OwnerAuth,
          useValue: {
            isAuthenticated: () => true,
            getToken: () => 'owner-token',
            getOwner: () => ({ role: 'owner' }),
            getOwnerRentalBills: () => of({
              success: true,
              data: {
                data: [],
                current_page: 1,
                last_page: 1,
                per_page: 15,
                total: 0
              }
            }),
            getOwnerRentalBillGenerationStatus: () => of({
              success: true,
              data: {
                month: '2026-11',
                period_start: '2026-11-01',
                period_end: '2026-11-30',
                eligible_assignments: 0,
                generated_bills: 0,
                missing_bills: 0,
                status: 'no_assignments',
                scheduled_time: '01:00',
                timezone: 'Asia/Manila'
              }
            }),
            getOwnerRentalPaymentSubmissions: () => of({
              success: true,
              data: {
                data: [],
                current_page: 1,
                last_page: 1,
                per_page: 15,
                total: 0
              }
            })
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RouterHost);
    router = TestBed.inject(Router);
    await router.navigateByUrl('/owner/rental-bills');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders the Rental Payments link and navigates to the Rental Bills page', async () => {
    const links = Array.from(
      fixture.nativeElement.querySelectorAll('app-owner-sidebar a') as NodeListOf<HTMLAnchorElement>
    );
    const link = links.find((anchor) => anchor.textContent?.includes('Rental Payments'));
    const messagesLink = links.find((anchor) => anchor.textContent?.includes('Messages'));

    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('/owner/rental-bills');
    expect(messagesLink?.getAttribute('href')).toBe('/owner/messages');
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Rental Payments');

    link?.click();
    await fixture.whenStable();

    expect(router.url).toBe('/owner/rental-bills');
  });
});
