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
});
