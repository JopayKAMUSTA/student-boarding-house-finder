import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { OwnerAuth } from './owner-auth';

describe('OwnerAuth', () => {
  let service: OwnerAuth;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(OwnerAuth);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('submits boarding-house data with the owner bearer token', () => {
    const payload = {
      name: 'Owner House',
      city: 'Tagum City',
      address: '123 Main Street',
      monthly_rent: 5000,
      available_rooms: 2,
      total_rooms: 3
    };

    service.createOwnerBoardingHouse('owner-token', payload).subscribe();

    const request = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/owner/boarding-houses'
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer owner-token');
    expect(request.request.body).toEqual(payload);
    request.flush({
      success: true,
      message: 'Boarding house submitted.',
      data: { total_rooms: 3, available_rooms: 2 }
    });
  });

  it('requests the selected owner-list page with bearer authentication', () => {
    service.getOwnerBoardingHouses('owner-token', 2).subscribe();

    const request = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/owner/boarding-houses?page=2'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer owner-token');
    request.flush({
      success: true,
      data: { data: [], total: 0, current_page: 2, last_page: 2 }
    });
  });

  it('requests rooms for the selected boarding house with the owner token', () => {
    service.getOwnerRooms('owner-token', 42, 2).subscribe();

    const request = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/owner/boarding-houses/42/rooms?page=2'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer owner-token');
    request.flush({
      success: true,
      boarding_house: {
        id: 42,
        name: 'Owner House',
        address: '123 Main Street',
        barangay: 'Mankilam',
        city: 'Tagum City'
      },
      data: { data: [], total: 0, current_page: 2, last_page: 2 }
    });
  });

  it('lists tenants with search, pagination, and the owner bearer token', () => {
    service.getOwnerTenants('owner-token', 2, 'Jane Doe').subscribe();

    const request = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/owner/tenants?page=2&per_page=10&search=Jane+Doe'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer owner-token');
    request.flush({
      success: true,
      data: { data: [], total: 0, current_page: 2, last_page: 2 }
    });
  });

  it('creates tenants without requiring a linked student account', () => {
    const payload = {
      full_name: 'Jane Doe',
      contact_number: '09123456789',
      emergency_contact_name: 'John Doe',
      emergency_contact_number: '09987654321'
    };
    service.createOwnerTenant('owner-token', payload).subscribe();

    const request = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/owner/tenants'
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer owner-token');
    expect(request.request.body).toEqual(payload);
    request.flush({ success: true, data: { id: 1, ...payload } });
  });

  it('uses the owner tenant detail and update endpoints', () => {
    service.getOwnerTenant('owner-token', 17).subscribe();
    const detailRequest = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/owner/tenants/17'
    );
    expect(detailRequest.request.method).toBe('GET');
    expect(detailRequest.request.headers.get('Authorization')).toBe('Bearer owner-token');
    detailRequest.flush({
      success: true,
      data: { id: 17, full_name: 'Jane Doe', contact_number: '09123456789' }
    });

    const payload = {
      contact_number: '09111111111',
      emergency_contact_name: 'John Doe',
      emergency_contact_number: '09987654321'
    };
    service.updateOwnerTenant('owner-token', 17, payload).subscribe();
    const updateRequest = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/owner/tenants/17'
    );
    expect(updateRequest.request.method).toBe('PUT');
    expect(updateRequest.request.headers.get('Authorization')).toBe('Bearer owner-token');
    expect(updateRequest.request.body).toEqual(payload);
    updateRequest.flush({ success: true, data: { id: 17, ...payload } });
  });

  it('uses the tenant assign, transfer, and move-out endpoints', () => {
    const payload = { boarding_house_room_id: 23, move_in_date: '2026-11-07' };
    service.assignOwnerTenant('owner-token', 17, payload).subscribe();
    const assignRequest = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/owner/tenants/17/assignments'
    );
    expect(assignRequest.request.method).toBe('POST');
    expect(assignRequest.request.headers.get('Authorization')).toBe('Bearer owner-token');
    expect(assignRequest.request.body).toEqual(payload);
    assignRequest.flush({ success: true });

    service.transferOwnerTenant('owner-token', 17, payload).subscribe();
    const transferRequest = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/owner/tenants/17/transfer'
    );
    expect(transferRequest.request.method).toBe('POST');
    expect(transferRequest.request.headers.get('Authorization')).toBe('Bearer owner-token');
    expect(transferRequest.request.body).toEqual(payload);
    transferRequest.flush({ success: true });

    service.moveOutOwnerTenant('owner-token', 17).subscribe();
    const moveOutRequest = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/owner/tenants/17/move-out'
    );
    expect(moveOutRequest.request.method).toBe('PATCH');
    expect(moveOutRequest.request.headers.get('Authorization')).toBe('Bearer owner-token');
    moveOutRequest.flush({ success: true });
  });

  it('creates rooms with multipart data and bearer authentication', () => {
    const data = new FormData();
    data.append('room_number', '101');
    data.append('amenities[0]', 'Bed');

    service.createOwnerRoom('owner-token', 42, data).subscribe();

    const request = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/owner/boarding-houses/42/rooms'
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer owner-token');
    expect(request.request.body.get('room_number')).toBe('101');
    expect(request.request.body.get('amenities[0]')).toBe('Bed');
    request.flush({
      success: true,
      data: { id: 1, images: [] }
    });
  });

  it('uses Laravel method spoofing for multipart room updates', () => {
    const data = new FormData();
    data.append('_method', 'PUT');
    data.append('room_number', '102');

    service.updateOwnerRoom('owner-token', 42, 7, data).subscribe();

    const request = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/owner/boarding-houses/42/rooms/7'
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer owner-token');
    expect(request.request.body.get('_method')).toBe('PUT');
    request.flush({
      success: true,
      data: { id: 7, images: [] }
    });
  });

  it('loads room photos through the authenticated API', () => {
    service.getOwnerRoomImage('owner-token', 42, 7, 3).subscribe();

    const request = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/owner/boarding-houses/42/rooms/7/images/3'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer owner-token');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['photo']));
  });
});
