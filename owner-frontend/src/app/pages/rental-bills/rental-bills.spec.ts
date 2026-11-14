import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import {
  OwnerAuth,
  OwnerTenantInfo,
  RentalBillInfo,
  RentalPaymentInfo
} from '../../services/owner-auth';
import { RentalBills } from './rental-bills';

describe('RentalBills', () => {
  let fixture: ComponentFixture<RentalBills>;
  let component: RentalBills;
  let ownerAuth: {
    getToken: ReturnType<typeof vi.fn>;
    getOwnerRentalBills: ReturnType<typeof vi.fn>;
    getOwnerRentalBillGenerationStatus: ReturnType<typeof vi.fn>;
    getOwnerRentalPaymentSubmissions: ReturnType<typeof vi.fn>;
    approveOwnerRentalPayment: ReturnType<typeof vi.fn>;
    rejectOwnerRentalPayment: ReturnType<typeof vi.fn>;
    getOwnerRentalPaymentProof: ReturnType<typeof vi.fn>;
    getOwnerTenants: ReturnType<typeof vi.fn>;
    getOwnerBoardingHouses: ReturnType<typeof vi.fn>;
    createOwnerRentalBill: ReturnType<typeof vi.fn>;
    getOwnerRentalBill: ReturnType<typeof vi.fn>;
    recordOwnerRentalPayment: ReturnType<typeof vi.fn>;
    voidOwnerRentalPayment: ReturnType<typeof vi.fn>;
    clearSession: ReturnType<typeof vi.fn>;
  };
  let bill: RentalBillInfo;

  beforeEach(async () => {
    bill = makeBill();
    ownerAuth = {
      getToken: vi.fn(() => 'owner-token'),
      getOwnerRentalBills: vi.fn(() => of({
        success: true,
        data: { data: [bill], current_page: 1, last_page: 1, per_page: 15, total: 1 }
      })),
      getOwnerRentalBillGenerationStatus: vi.fn(() => of({
        success: true,
        data: {
          month: '2026-11',
          period_start: '2026-11-01',
          period_end: '2026-11-30',
          eligible_assignments: 1,
          generated_bills: 1,
          missing_bills: 0,
          status: 'complete',
          scheduled_time: '01:00',
          timezone: 'Asia/Manila'
        }
      })),
      getOwnerRentalPaymentSubmissions: vi.fn(() => of({
        success: true,
        data: {
          data: [makePendingPayment(bill)],
          current_page: 1,
          last_page: 1,
          per_page: 100,
          total: 1
        }
      })),
      approveOwnerRentalPayment: vi.fn(() => of({
        success: true,
        message: 'Payment submission approved.',
        data: makePendingPayment(bill),
        bill
      })),
      rejectOwnerRentalPayment: vi.fn(() => of({
        success: true,
        message: 'Payment submission rejected.',
        data: { ...makePendingPayment(bill), status: 'rejected' },
        bill
      })),
      getOwnerRentalPaymentProof: vi.fn(() => of(new Blob(['proof']))),
      getOwnerTenants: vi.fn(() => of({
        success: true,
        data: {
          data: [makeTenant()],
          current_page: 1,
          last_page: 1,
          total: 1
        }
      })),
      getOwnerBoardingHouses: vi.fn(() => of({
        success: true,
        data: {
          data: [{ id: 5, name: 'Cedar House', billing_policy: 'prorated', total_rooms: 4, available_rooms: 2 }],
          current_page: 1,
          last_page: 1,
          total: 1
        }
      })),
      createOwnerRentalBill: vi.fn(() => of({ success: true, data: bill })),
      getOwnerRentalBill: vi.fn(() => of({ success: true, data: bill })),
      recordOwnerRentalPayment: vi.fn(() => of({
        success: true,
        message: 'Payment recorded.',
        data: {
          ...bill,
          amount_paid: '500.00',
          total_payments: '500.00',
          balance: '2700.00',
          remaining_balance: '2700.00',
          total_outstanding: '2760.00',
          accumulated_late_fee: '60.00',
          overdue_days: 6
        },
        payment: {
          id: 14,
          rental_bill_id: bill.id,
          amount: '500.00',
          payment_date: '2026-11-12',
          notes: null,
          voided_at: null,
          void_reason: null,
          voided_by: null
        }
      })),
      voidOwnerRentalPayment: vi.fn(() => of({
        success: true,
        message: 'Payment voided.',
        data: { ...bill.payments[0], void_reason: 'Duplicate entry' },
        bill: {
          ...bill,
          balance: '3200.00',
          remaining_balance: '3200.00',
          total_outstanding: '3260.00',
          total_payments: '0.00',
          accumulated_late_fee: '60.00'
        }
      })),
      clearSession: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [RentalBills],
      providers: [
        provideRouter([]),
        { provide: OwnerAuth, useValue: ownerAuth }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RentalBills);
    component = fixture.componentInstance;
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  it('loads the paginated list with payment summary and status', () => {
    fixture.detectChanges();

    expect(ownerAuth.getOwnerRentalBills).toHaveBeenCalledWith('owner-token', 1, 15, '2026-11');
    expect(ownerAuth.getOwnerRentalBillGenerationStatus).toHaveBeenCalledWith('owner-token', '2026-11');
    expect(ownerAuth.getOwnerRentalPaymentSubmissions).toHaveBeenCalledWith('owner-token', 'pending', 1, 100);
    expect(fixture.nativeElement.textContent).toContain('Alex Tenant');
    expect(fixture.nativeElement.textContent).toContain('Cedar House');
    expect(fixture.nativeElement.textContent).toContain('₱3,200.00');
    expect(fixture.nativeElement.textContent).toContain('₱10.00/day');
    expect(fixture.nativeElement.textContent).toContain('₱60.00');
    expect(fixture.nativeElement.textContent).toContain('Partially paid');
    expect(fixture.nativeElement.textContent).toContain('Complete: 1 of 1 eligible assignment bills generated.');
    expect(fixture.nativeElement.textContent).toContain('Daily at 01:00 (Asia/Manila)');
    expect(fixture.nativeElement.textContent).toContain('Tenant payment submissions');
    expect(fixture.nativeElement.textContent).not.toContain('Create Rental Bill');
  });

  it('filters generated bills and generation status by the selected month', () => {
    fixture.detectChanges();
    component.billingMonth = '2026-10';
    component.onBillingMonthChange();
    expect(ownerAuth.getOwnerRentalBills).toHaveBeenLastCalledWith('owner-token', 1, 15, '2026-10');
    expect(ownerAuth.getOwnerRentalBillGenerationStatus).toHaveBeenLastCalledWith('owner-token', '2026-10');
  });

  it('creates a future cycle from the move-in anniversary and sets the next anniversary due date', () => {
    fixture.detectChanges();
    component.tenants = [makeTenant()];
    component.tenants[0].current_assignment!.move_in_date = '2026-10-11';
    component.selectedTenantId = 7;
    component.rentalMonth = '2026-11';

    component.createBill();

    expect(ownerAuth.createOwnerRentalBill).toHaveBeenCalledWith('owner-token', 7, {
      room_assignment_id: 31,
      rental_period_start: '2026-11-11',
      rental_period_end: '2026-12-10',
      due_date: '2026-12-11'
    });
  });

  it('approves a verified tenant payment and refreshes submissions', () => {
    fixture.detectChanges();
    const submission = makePendingPayment(bill);
    component.beginPaymentReview(submission);
    component.verifiedAmount = 450;
    component.verifiedPaymentDate = '2026-11-08';
    component.amountAdjustmentReason = 'Verified receipt was short.';
    component.approvePaymentSubmission(submission);

    expect(ownerAuth.approveOwnerRentalPayment).toHaveBeenCalledWith('owner-token', 22, {
      amount: 450,
      payment_date: '2026-11-08',
      amount_adjustment_reason: 'Verified receipt was short.'
    });
    expect(component.paymentReviewSuccess).toBe('Payment submission approved.');
    expect(ownerAuth.getOwnerRentalPaymentSubmissions).toHaveBeenCalledTimes(2);
  });

  it('requires an adjustment reason when the verified amount differs', () => {
    fixture.detectChanges();
    const submission = makePendingPayment(bill);
    component.beginPaymentReview(submission);
    component.verifiedAmount = 450;
    component.approvePaymentSubmission(submission);
    expect(ownerAuth.approveOwnerRentalPayment).not.toHaveBeenCalled();
    expect(component.reviewError).toContain('reason is required');
  });

  it('rejects a tenant payment with a reason', () => {
    fixture.detectChanges();
    const submission = makePendingPayment(bill);
    component.beginPaymentReview(submission);
    component.rejectionReason = 'Proof could not be verified.';
    component.rejectPaymentSubmission(submission);
    expect(ownerAuth.rejectOwnerRentalPayment).toHaveBeenCalledWith(
      'owner-token',
      22,
      'Proof could not be verified.'
    );
    expect(component.paymentReviewSuccess).toBe('Payment submission rejected.');
  });

  it('records a payment and refreshes the bill balance', () => {
    fixture.detectChanges();
    component.selectedBill = bill;
    component.paymentAmount = 500;
    component.paymentDate = '2026-11-12';
    component.paymentNotes = 'Cash';

    component.recordPayment();

    expect(ownerAuth.recordOwnerRentalPayment).toHaveBeenCalledWith('owner-token', 9, {
      amount: 500,
      payment_date: '2026-11-12',
      notes: 'Cash'
    });
    expect(component.selectedBill?.balance).toBe('2700.00');
    expect(component.selectedBill?.total_outstanding).toBe('2760.00');
    expect(component.detailsSuccess).toBe('Payment recorded.');
  });

  it('lets the backend validate a future payment against its recorded date', () => {
    fixture.detectChanges();
    bill.total_outstanding = '110.00';
    component.selectedBill = bill;
    component.paymentAmount = 130;
    component.paymentDate = '2026-11-08';

    component.recordPayment();

    expect(ownerAuth.recordOwnerRentalPayment).toHaveBeenCalledWith('owner-token', 9, {
      amount: 130,
      payment_date: '2026-11-08'
    });
    expect(component.paymentError).toBe('');
  });

  it('shows daily-fee totals and identifies future-dated payments', () => {
    fixture.detectChanges();
    bill.future_dated_payment_total = '50.00';
    bill.payments[0].is_future_dated = true;
    component.openBill(bill);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Daily late fee');
    expect(fixture.nativeElement.textContent).toContain('Accumulated late fee');
    expect(fixture.nativeElement.textContent).toContain('Total outstanding');
    expect(fixture.nativeElement.textContent).toContain('Future-dated payments');
    expect(fixture.nativeElement.textContent).toContain('Future-dated · not yet effective');
  });

  it('requires confirmation and sends the void reason for a payment', () => {
    fixture.detectChanges();
    component.selectedBill = bill;
    component.beginVoidPayment(bill.payments[0]);
    component.voidReason = 'Duplicate entry';
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.voidPayment(bill.payments[0]);

    expect(window.confirm).toHaveBeenCalled();
    expect(ownerAuth.voidOwnerRentalPayment).toHaveBeenCalledWith(
      'owner-token',
      13,
      'Duplicate entry'
    );
    expect(component.selectedBill?.total_outstanding).toBe('3260.00');
  });

  it('keeps the existing bill unchanged and displays API errors when voiding fails', () => {
    fixture.detectChanges();
    component.selectedBill = bill;
    component.beginVoidPayment(bill.payments[0]);
    component.voidReason = 'Duplicate entry';
    ownerAuth.voidOwnerRentalPayment.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 422,
        error: { message: 'This payment has already been voided.' }
      }))
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.voidPayment(bill.payments[0]);

    expect(component.selectedBill?.balance).toBe('2700.00');
    expect(component.voidError).toBe('This payment has already been voided.');
  });
});

function makeTenant(): OwnerTenantInfo {
  return {
    id: 7,
    owner_id: 2,
    user_id: null,
    full_name: 'Alex Tenant',
    contact_number: '09123456789',
    emergency_contact_name: null,
    emergency_contact_number: null,
    current_assignment: {
      id: 31,
      boarding_house_room_id: 6,
      move_in_date: '2026-11-01',
      move_out_date: null,
      monthly_rent: '3200.00',
      status: 'active',
      boarding_house_room: {
        id: 6,
        boarding_house_id: 5,
        room_number: '201',
        boarding_house: { id: 5, name: 'Cedar House' }
      }
    }
  };
}

function makeBill(): RentalBillInfo {
  const tenant = makeTenant();
  return {
    id: 9,
    room_assignment_id: 31,
    amount: '3200.00',
    billing_policy: 'prorated',
    monthly_rent_snapshot: '3200.00',
    billable_days: 30,
    billing_period_days: 30,
    days_in_month: 30,
    rental_period_start: '2026-11-01',
    rental_period_end: '2026-11-30',
    due_date: '2026-11-05',
    amount_paid: '500.00',
    balance: '2700.00',
    daily_late_fee_snapshot: '10.00',
    grace_period_days_snapshot: 0,
    original_amount: '3200.00',
    total_payments: '500.00',
    remaining_balance: '2700.00',
    overdue_days: 6,
    accumulated_late_fee: '60.00',
    remaining_late_fee: '60.00',
    total_outstanding: '2760.00',
    future_dated_payment_total: '0.00',
    payment_status: 'partially_paid',
    is_voided: false,
    voided_at: null,
    void_reason: null,
    voided_by: null,
    room_assignment: {
      ...tenant.current_assignment!,
      tenant,
      boarding_house_room: {
        id: 6,
        boarding_house_id: 5,
        room_number: '201',
        boarding_house: { id: 5, name: 'Cedar House' }
      }
    },
    payments: [{
      id: 13,
      rental_bill_id: 9,
      amount: '500.00',
      payment_date: '2026-11-12',
      notes: null,
      voided_at: null,
      void_reason: null,
      voided_by: null
    }]
  };
}

function makePendingPayment(bill: RentalBillInfo): RentalPaymentInfo {
  return {
    id: 22,
    rental_bill_id: bill.id,
    amount: '500.00',
    submitted_amount: '500.00',
    payment_date: '2026-11-08',
    submitted_payment_date: '2026-11-08',
    status: 'pending',
    proof_url: '/api/rental-payments/22/proof',
    notes: 'Bank transfer',
    recorded_by: { id: 8, name: 'Alex Tenant' },
    reviewed_at: null,
    reviewed_by: null,
    rejection_reason: null,
    amount_adjustment_reason: null,
    voided_at: null,
    void_reason: null,
    voided_by: null,
    bill
  };
}
