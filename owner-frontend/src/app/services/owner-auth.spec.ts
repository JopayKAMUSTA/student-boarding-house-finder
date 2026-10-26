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
