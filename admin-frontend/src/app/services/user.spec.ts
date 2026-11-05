import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { UserService } from './user';

describe('UserService', () => {
  let service: UserService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    sessionStorage.setItem('admin_token', 'admin-token');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(UserService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    sessionStorage.removeItem('admin_token');
    httpTesting.verify();
  });

  it('loads the paginated owner list with the Admin bearer token', () => {
    service.getOwners(2).subscribe();

    const request = httpTesting.expectOne(
      'http://127.0.0.1:8000/api/admin/owners?page=2'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer admin-token');
    request.flush({
      success: true,
      data: { data: [], current_page: 2, last_page: 2, total: 0 }
    });
  });

  it('sends verification decisions using the Admin API contract', () => {
    service.updateOwnerVerification(8, 'rejected').subscribe();

    const request = httpTesting.expectOne(
      'http://127.0.0.1:8000/api/admin/owners/8/verification'
    );
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ verification_status: 'rejected' });
    expect(request.request.headers.get('Authorization')).toBe('Bearer admin-token');
    request.flush({
      success: true,
      message: 'Owner verification rejected.',
      data: {}
    });
  });

  it('gets paginated boarding houses with an optional status filter', () => {
    service.getAdminBoardingHouses('pending', 3).subscribe();

    const request = httpTesting.expectOne(
      'http://127.0.0.1:8000/api/admin/boarding-houses?page=3&status=pending'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer admin-token');
    request.flush({
      success: true,
      data: { data: [], current_page: 3, last_page: 3, total: 0, per_page: 15 }
    });
  });

  it('requests listing details and updates status through the Admin endpoints', () => {
    service.getAdminBoardingHouse(12).subscribe();
    const detailsRequest = httpTesting.expectOne(
      'http://127.0.0.1:8000/api/admin/boarding-houses/12'
    );
    expect(detailsRequest.request.headers.get('Authorization')).toBe('Bearer admin-token');
    detailsRequest.flush({ success: true, data: { id: 12 } });

    service.updateAdminBoardingHouseStatus(12, 'approved').subscribe();
    const statusRequest = httpTesting.expectOne(
      'http://127.0.0.1:8000/api/admin/boarding-houses/12/status'
    );
    expect(statusRequest.request.method).toBe('PATCH');
    expect(statusRequest.request.body).toEqual({ status: 'approved' });
    expect(statusRequest.request.headers.get('Authorization')).toBe('Bearer admin-token');
    statusRequest.flush({ success: true, message: 'Approved.', data: { id: 12 } });
  });

  it('downloads room images as authenticated blobs', () => {
    const imageUrl = 'http://127.0.0.1:8000/api/admin/boarding-houses/12/rooms/4/images/9';
    service.getAdminBoardingHouseImage(imageUrl).subscribe();

    const request = httpTesting.expectOne(imageUrl);
    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    expect(request.request.headers.get('Authorization')).toBe('Bearer admin-token');
    request.flush(new Blob(['room photo'], { type: 'image/png' }));
  });
});
