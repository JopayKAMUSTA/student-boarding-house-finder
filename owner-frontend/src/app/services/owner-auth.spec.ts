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
      billing_policy: 'full_monthly' as const,
      late_payment_fee: 75.5,
      grace_period_days: 3,
      rules: 'Quiet after 10 PM',
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

  it('updates a boarding-house billing policy with bearer authentication', () => {
    service.updateOwnerBoardingHouseBillingPolicy('owner-token', 42, 'prorated')
      .subscribe();

    const request = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/owner/boarding-houses/42/billing-policy'
    );
    expect(request.request.method).toBe('PATCH');
    expect(request.request.headers.get('Authorization')).toBeTruthy();
    expect(request.request.body).toEqual({ billing_policy: 'prorated' });
    request.flush({
      success: true,
      message: 'Policy updated.',
      data: {
        id: 42,
        name: 'Owner House',
        total_rooms: 3,
        available_rooms: 2,
        billing_policy: 'prorated'
      }
    });
  });

  it('updates late-payment settings through the owner settings endpoint', () => {
    const settings = {
      late_payment_fee: 125.5,
      grace_period_days: 5,
      rules: 'Quiet hours after 10 PM'
    };
    service.updateOwnerBoardingHouseSettings('owner-token', 42, settings).subscribe();

    const request = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/owner/boarding-houses/42/settings'
    );
    expect(request.request.method).toBe('PATCH');
    expect(request.request.headers.get('Authorization')).toBeTruthy();
    expect(request.request.body).toEqual(settings);
    request.flush({
      success: true,
      message: 'Settings saved.',
      data: {
        id: 42,
        name: 'Owner House',
        total_rooms: 3,
        available_rooms: 2,
        late_payment_fee: '125.50',
        grace_period_days: 5,
        rules: 'Quiet hours after 10 PM'
      }
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

  it('lists rental bills using the owner-authenticated paginated endpoint', () => {
    service.getOwnerRentalBills('owner-token', 2, 25, '2026-11').subscribe();

    const request = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/owner/rental-bills?page=2&per_page=25&month=2026-11'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBeTruthy();
    request.flush({
      success: true,
      data: { data: [], current_page: 2, last_page: 2, per_page: 25, total: 0 }
    });
  });

  it('loads the monthly bill-generation status', () => {
    service.getOwnerRentalBillGenerationStatus('owner-token', '2026-11').subscribe();
    const request = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/owner/rental-bills/generation-status?month=2026-11'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBeTruthy();
    request.flush({
      success: true,
      data: {
        month: '2026-11',
        period_start: '2026-11-01',
        period_end: '2026-11-30',
        eligible_assignments: 2,
        generated_bills: 2,
        missing_bills: 0,
        status: 'complete',
        scheduled_time: '01:00',
        timezone: 'Asia/Manila'
      }
    });
  });

  it('loads pending tenant payment submissions for owner review', () => {
    service.getOwnerRentalPaymentSubmissions('owner-token').subscribe();
    const request = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/owner/rental-payment-submissions?status=pending&page=1&per_page=15'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBeTruthy();
    request.flush({
      success: true,
      data: { data: [], current_page: 1, last_page: 1, per_page: 15, total: 0 }
    });
  });

  it('approves tenant payment submissions with verified amount and date', () => {
    const payload = {
      amount: 450,
      payment_date: '2026-11-08',
      amount_adjustment_reason: 'Receipt was short.'
    };
    service.approveOwnerRentalPayment('owner-token', 18, payload).subscribe();
    const request = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/owner/rental-payments/18/approve'
    );
    expect(request.request.method).toBe('PATCH');
    expect(request.request.headers.get('Authorization')).toBeTruthy();
    expect(request.request.body).toEqual(payload);
    request.flush({ success: true, data: {}, bill: {} });
  });

  it('rejects tenant payment submissions with a reason', () => {
    service.rejectOwnerRentalPayment('owner-token', 18, 'Proof did not match.').subscribe();
    const request = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/owner/rental-payments/18/reject'
    );
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ reason: 'Proof did not match.' });
    request.flush({ success: true, data: {}, bill: {} });
  });

  it('downloads payment proof with owner bearer authentication', () => {
    service.getOwnerRentalPaymentProof('owner-token', 18).subscribe();
    const request = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/rental-payments/18/proof'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    expect(request.request.headers.get('Authorization')).toBeTruthy();
    request.flush(new Blob(['proof']));
  });

  it('creates a rental bill without sending a client-calculated amount', () => {
    const payload = {
      room_assignment_id: 18,
      rental_period_start: '2026-11-01',
      rental_period_end: '2026-11-30',
      due_date: '2026-11-05'
    };
    service.createOwnerRentalBill('owner-token', 17, payload).subscribe();

    const request = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/owner/tenants/17/rental-bills'
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBeTruthy();
    expect(request.request.body).toEqual(payload);
    expect(request.request.body.amount).toBeUndefined();
    request.flush({ success: true, data: { id: 8, amount: '3200.00' } });
  });

  it('loads a rental bill and records payment with the validated fields', () => {
    service.getOwnerRentalBill('owner-token', 8).subscribe();
    const detailRequest = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/owner/rental-bills/8'
    );
    expect(detailRequest.request.method).toBe('GET');
    expect(detailRequest.request.headers.get('Authorization')).toBeTruthy();
    detailRequest.flush({ success: true, data: { id: 8 } });

    const payload = {
      amount: 1250,
      payment_date: '2026-11-10',
      notes: 'Bank transfer'
    };
    service.recordOwnerRentalPayment('owner-token', 8, payload).subscribe();
    const paymentRequest = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/owner/rental-bills/8/payments'
    );
    expect(paymentRequest.request.method).toBe('POST');
    expect(paymentRequest.request.headers.get('Authorization')).toBeTruthy();
    expect(paymentRequest.request.body).toEqual(payload);
    paymentRequest.flush({
      success: true,
      data: { id: 8 },
      payment: { id: 12, amount: '1250.00' }
    });
  });

  it('voids a rental payment with a reason using PATCH', () => {
    service.voidOwnerRentalPayment('owner-token', 12, 'Duplicate entry').subscribe();

    const request = httpTestingController.expectOne(
      'http://127.0.0.1:8000/api/owner/rental-payments/12/void'
    );
    expect(request.request.method).toBe('PATCH');
    expect(request.request.headers.get('Authorization')).toBeTruthy();
    expect(request.request.body).toEqual({ reason: 'Duplicate entry' });
    request.flush({
      success: true,
      data: { id: 12, void_reason: 'Duplicate entry' },
      bill: { id: 8, balance: '3200.00' }
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
