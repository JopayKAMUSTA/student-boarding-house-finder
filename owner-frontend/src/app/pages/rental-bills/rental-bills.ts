import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, forkJoin, of, switchMap } from 'rxjs';
import {
  BillingPolicy,
  BoardingHouseRoomInfo,
  RentalBillGenerationStatusResponse,
  OwnerBoardingHousePageResponse,
  OwnerAuth,
  OwnerTenantInfo,
  OwnerTenantPageResponse,
  RentalBillInfo,
  RentalBillPageResponse,
  RentalPaymentPageResponse,
  RentalPaymentInfo
} from '../../services/owner-auth';

type BillFilter = 'all' | 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'voided';

@Component({
  selector: 'app-rental-bills',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rental-bills.html',
  styleUrl: './rental-bills.css'
})
export class RentalBills implements OnInit {
  private readonly ownerAuth = inject(OwnerAuth);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  bills: RentalBillInfo[] = [];
  currentPage = 1;
  lastPage = 1;
  total = 0;
  filter: BillFilter = 'all';
  isLoadingBills = false;
  billsError = '';
  billingMonth = this.currentMonth();
  isLoadingGenerationStatus = false;
  generationStatusError = '';
  generationStatus: RentalBillGenerationStatusResponse['data'] | null = null;
  pendingPayments: RentalPaymentInfo[] = [];
  isLoadingPendingPayments = false;
  pendingPaymentsError = '';
  paymentReviewSuccess = '';
  reviewingPaymentId: number | null = null;
  selectedReviewPaymentId: number | null = null;
  verifiedAmount: number | null = null;
  verifiedPaymentDate = '';
  amountAdjustmentReason = '';
  rejectionReason = '';
  reviewError = '';

  isCreateFormOpen = false;
  isLoadingOptions = false;
  isCreatingBill = false;
  optionsError = '';
  createError = '';
  createSuccess = '';
  tenants: OwnerTenantInfo[] = [];
  boardingHousePolicies = new Map<number, BillingPolicy>();
  selectedTenantId: number | null = null;
  rentalMonth = this.currentMonth();

  selectedBill: RentalBillInfo | null = null;
  isLoadingDetails = false;
  detailsError = '';
  detailsSuccess = '';
  isRecordingPayment = false;
  paymentError = '';
  paymentAmount: number | null = null;
  paymentDate = this.today();
  paymentNotes = '';
  isVoidingPayment = false;
  voidingPaymentId: number | null = null;
  voidReason = '';
  voidError = '';

  ngOnInit(): void {
    this.loadBills();
    this.loadGenerationStatus();
    this.loadPendingPayments();
  }

  get filteredBills(): RentalBillInfo[] {
    switch (this.filter) {
      case 'unpaid':
        return this.bills.filter((bill) => !bill.is_voided && bill.payment_status === 'unpaid');
      case 'partially_paid':
        return this.bills.filter((bill) =>
          !bill.is_voided && bill.payment_status === 'partially_paid'
        );
      case 'paid':
        return this.bills.filter((bill) => !bill.is_voided && bill.payment_status === 'paid');
      case 'overdue':
        return this.bills.filter((bill) => !bill.is_voided && bill.payment_status === 'overdue');
      case 'voided':
        return this.bills.filter((bill) => bill.is_voided);
      default:
        return this.bills;
    }
  }

  get selectedTenant(): OwnerTenantInfo | null {
    return this.tenants.find((tenant) => tenant.id === this.selectedTenantId) ?? null;
  }

  get selectedAssignment() {
    return this.selectedTenant?.current_assignment ?? null;
  }

  get selectedHousePolicy(): BillingPolicy {
    const houseId = this.selectedAssignment?.boarding_house_room?.boarding_house_id;
    return houseId ? this.boardingHousePolicies.get(houseId) ?? 'full_monthly' : 'full_monthly';
  }

  hasBalance(bill: RentalBillInfo): boolean {
    return Number(bill.total_outstanding ?? bill.balance) > 0;
  }

  dailyFeeDisabled(bill: RentalBillInfo): boolean {
    return Number(bill.daily_late_fee_snapshot ?? 0) === 0;
  }

  hasFutureDatedPayments(bill: RentalBillInfo): boolean {
    return Number(bill.future_dated_payment_total ?? 0) > 0;
  }

  paymentAmountChanged(payment: RentalPaymentInfo): boolean {
    return this.verifiedAmount !== null &&
      this.verifiedAmount !== Number(payment.submitted_amount ?? payment.amount);
  }

  recordedByName(payment: RentalPaymentInfo): string | null {
    return typeof payment.recorded_by === 'object' && payment.recorded_by
      ? payment.recorded_by.name
      : null;
  }

  voidedByName(payment: RentalPaymentInfo): string | null {
    return typeof payment.voided_by === 'object' && payment.voided_by
      ? payment.voided_by.name
      : null;
  }

  reviewedByName(payment: RentalPaymentInfo): string | null {
    return typeof payment.reviewed_by === 'object' && payment.reviewed_by
      ? payment.reviewed_by.name
      : null;
  }

  loadBills(page = this.currentPage): void {
    const token = this.getTokenOrRedirect();
    if (!token) {
      return;
    }

    this.isLoadingBills = true;
    this.billsError = '';
    this.ownerAuth.getOwnerRentalBills(token, page, 15, this.billingMonth).subscribe({
      next: (response) => {
        this.isLoadingBills = false;
        if (!this.isBillPageResponse(response)) {
          this.billsError = 'The rental-bill list response was not valid.';
          this.cdr.detectChanges();
          return;
        }

        this.bills = response.data.data;
        this.currentPage = response.data.current_page;
        this.lastPage = response.data.last_page;
        this.total = response.data.total;
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.isLoadingBills = false;
        this.billsError = this.getApiErrorMessage(error, 'Could not load rental bills.');
        this.handleUnauthorized(error);
        this.cdr.detectChanges();
      }
    });
  }

  onBillingMonthChange(): void {
    this.currentPage = 1;
    this.loadBills(1);
    this.loadGenerationStatus();
  }

  loadGenerationStatus(): void {
    const token = this.getTokenOrRedirect();
    if (!token) {
      return;
    }

    this.isLoadingGenerationStatus = true;
    this.generationStatusError = '';
    this.ownerAuth.getOwnerRentalBillGenerationStatus(token, this.billingMonth).subscribe({
      next: (response) => {
        this.isLoadingGenerationStatus = false;
        if (!response.success || !response.data) {
          this.generationStatusError = 'The bill-generation status response was not valid.';
          this.cdr.detectChanges();
          return;
        }
        this.generationStatus = response.data;
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.isLoadingGenerationStatus = false;
        this.generationStatusError = this.getApiErrorMessage(
          error,
          'Could not load automatic bill-generation status.'
        );
        this.handleUnauthorized(error);
        this.cdr.detectChanges();
      }
    });
  }

  loadPendingPayments(): void {
    const token = this.getTokenOrRedirect();
    if (!token) {
      return;
    }

    this.isLoadingPendingPayments = true;
    this.pendingPaymentsError = '';
    this.ownerAuth.getOwnerRentalPaymentSubmissions(token, 'pending', 1, 100).subscribe({
      next: (response) => {
        this.isLoadingPendingPayments = false;
        if (!response.success || !Array.isArray(response.data?.data)) {
          this.pendingPaymentsError = 'The payment-submission response was not valid.';
          this.cdr.detectChanges();
          return;
        }
        this.pendingPayments = response.data.data;
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.isLoadingPendingPayments = false;
        this.pendingPaymentsError = this.getApiErrorMessage(
          error,
          'Could not load pending payment submissions.'
        );
        this.handleUnauthorized(error);
        this.cdr.detectChanges();
      }
    });
  }

  beginPaymentReview(payment: RentalPaymentInfo): void {
    if (this.reviewingPaymentId !== null || payment.status !== 'pending') {
      return;
    }
    this.selectedReviewPaymentId = payment.id;
    this.verifiedAmount = Number(payment.submitted_amount ?? payment.amount);
    this.verifiedPaymentDate = payment.submitted_payment_date ?? payment.payment_date;
    this.amountAdjustmentReason = '';
    this.rejectionReason = '';
    this.reviewError = '';
  }

  cancelPaymentReview(): void {
    if (this.reviewingPaymentId === null) {
      this.selectedReviewPaymentId = null;
      this.reviewError = '';
    }
  }

  approvePaymentSubmission(payment: RentalPaymentInfo): void {
    if (
      this.reviewingPaymentId !== null ||
      this.selectedReviewPaymentId !== payment.id ||
      this.verifiedAmount === null ||
      this.verifiedAmount <= 0 ||
      !this.verifiedPaymentDate
    ) {
      this.reviewError = 'Enter a valid verified amount and payment date.';
      return;
    }
    const submitted = Number(payment.submitted_amount ?? payment.amount);
    if (
      this.verifiedAmount !== submitted &&
      !this.amountAdjustmentReason.trim()
    ) {
      this.reviewError = 'A reason is required when changing the submitted amount.';
      return;
    }

    const token = this.getTokenOrRedirect();
    if (!token) {
      return;
    }

    this.reviewingPaymentId = payment.id;
    this.reviewError = '';
    this.paymentReviewSuccess = '';
    this.ownerAuth.approveOwnerRentalPayment(token, payment.id, {
      amount: this.verifiedAmount,
      payment_date: this.verifiedPaymentDate,
      ...(this.amountAdjustmentReason.trim() && {
        amount_adjustment_reason: this.amountAdjustmentReason.trim()
      })
    }).subscribe({
      next: (response) => {
        this.reviewingPaymentId = null;
        if (!response.success || !response.bill) {
          this.reviewError = response.message || 'The payment submission could not be approved.';
          this.cdr.detectChanges();
          return;
        }
        this.paymentReviewSuccess = response.message || 'Payment approved.';
        if (this.selectedBill?.id === response.bill.id) {
          this.selectedBill = response.bill;
        }
        this.selectedReviewPaymentId = null;
        this.loadPendingPayments();
        this.loadBills(this.currentPage);
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.reviewingPaymentId = null;
        this.reviewError = this.getApiErrorMessage(error, 'The payment submission could not be approved.');
        this.handleUnauthorized(error);
        this.cdr.detectChanges();
      }
    });
  }

  rejectPaymentSubmission(payment: RentalPaymentInfo): void {
    const reason = this.rejectionReason.trim();
    if (this.selectedReviewPaymentId !== payment.id || !reason || this.reviewingPaymentId !== null) {
      this.reviewError = 'Enter a rejection reason before continuing.';
      return;
    }
    const token = this.getTokenOrRedirect();
    if (!token) {
      return;
    }

    this.reviewingPaymentId = payment.id;
    this.reviewError = '';
    this.paymentReviewSuccess = '';
    this.ownerAuth.rejectOwnerRentalPayment(token, payment.id, reason).subscribe({
      next: (response) => {
        this.reviewingPaymentId = null;
        if (!response.success || !response.bill) {
          this.reviewError = response.message || 'The payment submission could not be rejected.';
          this.cdr.detectChanges();
          return;
        }
        this.paymentReviewSuccess = response.message || 'Payment rejected.';
        if (this.selectedBill?.id === response.bill.id) {
          this.selectedBill = response.bill;
        }
        this.selectedReviewPaymentId = null;
        this.loadPendingPayments();
        this.loadBills(this.currentPage);
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.reviewingPaymentId = null;
        this.reviewError = this.getApiErrorMessage(error, 'The payment submission could not be rejected.');
        this.handleUnauthorized(error);
        this.cdr.detectChanges();
      }
    });
  }

  openPaymentProof(payment: RentalPaymentInfo): void {
    if (!payment.proof_url) {
      return;
    }
    const proofWindow = window.open('about:blank', '_blank');
    if (!proofWindow) {
      this.pendingPaymentsError = 'Allow pop-ups to view the private payment proof.';
      return;
    }
    const token = this.getTokenOrRedirect();
    if (!token) {
      proofWindow.close();
      return;
    }
    this.ownerAuth.getOwnerRentalPaymentProof(token, payment.id).subscribe({
      next: (proof) => {
        const url = URL.createObjectURL(proof);
        proofWindow.location.href = url;
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (error: HttpErrorResponse) => {
        proofWindow.close();
        this.pendingPaymentsError = this.getApiErrorMessage(error, 'Could not open payment proof.');
        this.handleUnauthorized(error);
        this.cdr.detectChanges();
      }
    });
  }


  previousPage(): void {
    if (!this.isLoadingBills && this.currentPage > 1) {
      this.loadBills(this.currentPage - 1);
    }
  }

  nextPage(): void {
    if (!this.isLoadingBills && this.currentPage < this.lastPage) {
      this.loadBills(this.currentPage + 1);
    }
  }

  openCreateForm(): void {
    this.isCreateFormOpen = true;
    this.createError = '';
    this.createSuccess = '';
    this.optionsError = '';
    this.selectedTenantId = null;
    this.rentalMonth = this.currentMonth();
    this.loadCreateOptions();
  }

  closeCreateForm(): void {
    if (!this.isCreatingBill) {
      this.isCreateFormOpen = false;
    }
  }

  loadCreateOptions(): void {
    const token = this.getTokenOrRedirect();
    if (!token) {
      return;
    }

    this.isLoadingOptions = true;
    this.ownerAuth.getOwnerTenants(token, 1, '', 100).pipe(
      switchMap((tenantResponse) => {
        if (!this.isTenantPageResponse(tenantResponse)) {
          throw new Error('The tenant list response was not valid.');
        }
        return forkJoin({
          tenants: this.loadTenantPages(token, tenantResponse),
          houses: this.ownerAuth.getOwnerBoardingHouses(token, 1).pipe(
            switchMap((houseResponse) => {
              if (!houseResponse.success || !houseResponse.data) {
                throw new Error('The boarding-house list response was not valid.');
              }
              return this.loadHousePages(token, houseResponse.data);
            })
          )
        });
      })
    ).subscribe({
      next: ({ tenants, houses }) => {
        this.tenants = tenants.filter((tenant) =>
          tenant.current_assignment?.status === 'active' &&
          !!tenant.current_assignment.boarding_house_room
        );
        this.boardingHousePolicies = new Map(
          houses
            .filter((house): house is BoardingHouseRoomInfo & { id: number } =>
              typeof house.id === 'number'
            )
            .map((house) => [house.id, house.billing_policy ?? 'full_monthly'])
        );
        this.isLoadingOptions = false;
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse | Error) => {
        this.isLoadingOptions = false;
        if (error instanceof HttpErrorResponse) {
          this.optionsError = this.getApiErrorMessage(error, 'Could not load eligible tenants.');
          this.handleUnauthorized(error);
        } else {
          this.optionsError = error.message;
        }
        this.cdr.detectChanges();
      }
    });
  }

  createBill(): void {
    const tenant = this.selectedTenant;
    const assignment = tenant?.current_assignment;
    if (!tenant || !assignment || !this.rentalMonth || this.isCreatingBill) {
      this.createError = 'Select an eligible tenant and provide the anniversary billing month.';
      return;
    }

    const token = this.getTokenOrRedirect();
    if (!token) {
      return;
    }

    const cycle = this.anniversaryCycle(this.rentalMonth, assignment.move_in_date);
    if (!cycle) {
      this.createError = 'Choose a month after the assignment move-in month.';
      return;
    }
    this.isCreatingBill = true;
    this.createError = '';
    this.createSuccess = '';
    this.ownerAuth.createOwnerRentalBill(token, tenant.id, {
      room_assignment_id: assignment.id,
      rental_period_start: cycle.start,
      rental_period_end: cycle.end,
      due_date: cycle.dueDate
    }).subscribe({
      next: (response) => {
        this.isCreatingBill = false;
        if (!response.success || !response.data) {
          this.createError = response.message || 'The rental bill could not be created.';
          this.cdr.detectChanges();
          return;
        }

        this.createSuccess = `Bill created. Calculated amount: ${this.money(response.data.amount)}.`;
        this.isCreateFormOpen = false;
        this.loadBills(1);
        this.openBill(response.data);
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.isCreatingBill = false;
        this.createError = this.getApiErrorMessage(error, 'The rental bill could not be created.');
        this.handleUnauthorized(error);
        this.cdr.detectChanges();
      }
    });
  }

  openBill(bill: RentalBillInfo): void {
    const token = this.getTokenOrRedirect();
    if (!token) {
      return;
    }

    this.selectedBill = bill;
    this.isLoadingDetails = true;
    this.detailsError = '';
    this.detailsSuccess = '';
    this.paymentError = '';
    this.ownerAuth.getOwnerRentalBill(token, bill.id).subscribe({
      next: (response) => {
        this.isLoadingDetails = false;
        if (!response.success || !response.data) {
          this.detailsError = response.message || 'Bill details could not be loaded.';
          this.cdr.detectChanges();
          return;
        }

        this.selectedBill = response.data;
        this.resetPaymentForm();
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.isLoadingDetails = false;
        this.detailsError = this.getApiErrorMessage(error, 'Could not load bill details.');
        this.handleUnauthorized(error);
        this.cdr.detectChanges();
      }
    });
  }

  closeBillDetails(): void {
    if (!this.isRecordingPayment && !this.isVoidingPayment) {
      this.selectedBill = null;
    }
  }

  recordPayment(): void {
    const bill = this.selectedBill;
    if (!bill || this.isRecordingPayment || this.paymentAmount === null) {
      return;
    }
    if (this.paymentAmount <= 0) {
      this.paymentError = 'Enter a positive payment amount.';
      return;
    }

    const token = this.getTokenOrRedirect();
    if (!token) {
      return;
    }

    this.isRecordingPayment = true;
    this.paymentError = '';
    this.ownerAuth.recordOwnerRentalPayment(token, bill.id, {
      amount: this.paymentAmount,
      payment_date: this.paymentDate,
      ...(this.paymentNotes.trim() && { notes: this.paymentNotes.trim() })
    }).subscribe({
      next: (response) => {
        this.isRecordingPayment = false;
        if (!response.success) {
          this.paymentError = response.message || 'The payment could not be recorded.';
          this.cdr.detectChanges();
          return;
        }

        this.detailsSuccess = response.message || 'Payment recorded successfully.';
        this.selectedBill = response.data;
        this.resetPaymentForm();
        this.loadBills(this.currentPage);
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.isRecordingPayment = false;
        this.paymentError = this.getApiErrorMessage(error, 'The payment could not be recorded.');
        this.handleUnauthorized(error);
        this.cdr.detectChanges();
      }
    });
  }

  beginVoidPayment(payment: RentalPaymentInfo): void {
    if (this.isVoidingPayment) {
      return;
    }
    this.voidingPaymentId = payment.id;
    this.voidReason = '';
    this.voidError = '';
  }

  cancelVoidPayment(): void {
    if (!this.isVoidingPayment) {
      this.voidingPaymentId = null;
      this.voidReason = '';
      this.voidError = '';
    }
  }

  voidPayment(payment: RentalPaymentInfo): void {
    const reason = this.voidReason.trim();
    if (!reason || reason.length > 1000 || this.isVoidingPayment) {
      this.voidError = 'Enter a reason of no more than 1000 characters.';
      return;
    }
    if (!window.confirm('Void this payment? This action cannot be undone.')) {
      return;
    }

    const token = this.getTokenOrRedirect();
    if (!token) {
      return;
    }

    this.isVoidingPayment = true;
    this.voidError = '';
    this.ownerAuth.voidOwnerRentalPayment(token, payment.id, reason).subscribe({
      next: (response) => {
        this.isVoidingPayment = false;
        if (!response.success) {
          this.voidError = response.message || 'The payment could not be voided.';
          this.cdr.detectChanges();
          return;
        }

        this.selectedBill = response.bill;
        this.voidingPaymentId = null;
        this.voidReason = '';
        this.detailsSuccess = response.message || 'Payment voided successfully.';
        this.loadBills(this.currentPage);
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.isVoidingPayment = false;
        this.voidError = this.getApiErrorMessage(error, 'The payment could not be voided.');
        this.handleUnauthorized(error);
        this.cdr.detectChanges();
      }
    });
  }

  statusLabel(bill: RentalBillInfo): string {
    return bill.is_voided ? 'Voided' : bill.payment_status.replace('_', ' ');
  }

  money(value: string | number | null): string {
    return value === null ? '—' : Number(value).toLocaleString('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    });
  }

  trackBill(_index: number, bill: RentalBillInfo): number {
    return bill.id;
  }

  private loadTenantPages(
    token: string,
    page: OwnerTenantPageResponse,
    collected: OwnerTenantInfo[] = []
  ): Observable<OwnerTenantInfo[]> {
    const tenants = [...collected, ...page.data.data];
    if (page.data.current_page >= page.data.last_page) {
      return of(tenants);
    }

    return this.ownerAuth.getOwnerTenants(token, page.data.current_page + 1, '', 100).pipe(
      switchMap((nextPage) => {
        if (!this.isTenantPageResponse(nextPage)) {
          throw new Error('The tenant list response was not valid.');
        }
        return this.loadTenantPages(token, nextPage, tenants);
      })
    );
  }

  private loadHousePages(
    token: string,
    page: OwnerBoardingHousePageResponse['data'],
    collected: BoardingHouseRoomInfo[] = []
  ): Observable<BoardingHouseRoomInfo[]> {
    const houses = [...collected, ...page.data];
    if (page.current_page >= page.last_page) {
      return of(houses);
    }

    return this.ownerAuth.getOwnerBoardingHouses(token, page.current_page + 1).pipe(
      switchMap((nextPage) => {
        if (!nextPage.success || !nextPage.data) {
          throw new Error('The boarding-house list response was not valid.');
        }
        return this.loadHousePages(token, nextPage.data, houses);
      })
    );
  }

  private resetPaymentForm(): void {
    this.paymentAmount = null;
    this.paymentDate = this.today();
    this.paymentNotes = '';
    this.paymentError = '';
    this.voidingPaymentId = null;
    this.voidReason = '';
    this.voidError = '';
  }

  private isBillPageResponse(response: RentalBillPageResponse): boolean {
    return !!response?.success &&
      Array.isArray(response.data?.data) &&
      Number.isInteger(response.data.current_page) &&
      Number.isInteger(response.data.last_page) &&
      Number.isInteger(response.data.total);
  }

  private isTenantPageResponse(response: OwnerTenantPageResponse): boolean {
    return !!response?.success &&
      Array.isArray(response.data?.data) &&
      Number.isInteger(response.data.current_page) &&
      Number.isInteger(response.data.last_page);
  }

  private getTokenOrRedirect(): string | null {
    const token = this.ownerAuth.getToken();
    if (!token) {
      void this.router.navigate(['/login'], {
        queryParams: { notice: 'session-expired' }
      });
    }
    return token;
  }

  private handleUnauthorized(error: HttpErrorResponse): void {
    if (error.status === 401) {
      this.ownerAuth.clearSession();
      void this.router.navigate(['/login'], {
        queryParams: { notice: 'session-expired' }
      });
    }
  }

  private getApiErrorMessage(error: HttpErrorResponse, fallback: string): string {
    if (error.status === 0) {
      return 'Could not connect to the API. Check that Laravel is running and CORS is configured.';
    }

    const validationErrors = error.error?.errors;
    if (validationErrors && typeof validationErrors === 'object') {
      const messages = Object.values(validationErrors as Record<string, unknown>)
        .flatMap((value) => Array.isArray(value) ? value : [])
        .filter((value): value is string => typeof value === 'string');
      if (messages.length) {
        return messages.join(' ');
      }
    }

    return typeof error.error?.message === 'string' ? error.error.message : fallback;
  }

  private currentMonth(): string {
    const today = this.today();
    return today.slice(0, 7);
  }

  private anniversaryCycle(
    billingMonth: string,
    moveInDate: string
  ): { start: string; end: string; dueDate: string } | null {
    const [year, month] = billingMonth.split('-').map(Number);
    const [moveInYear, moveInMonth, anchorDay] = moveInDate.split('-').map(Number);
    if (
      !year || !month || month < 1 || month > 12 ||
      !moveInYear || !moveInMonth || moveInMonth < 1 || moveInMonth > 12 ||
      !anchorDay || anchorDay < 1 || anchorDay > 31 ||
      year * 12 + month <= moveInYear * 12 + moveInMonth
    ) {
      return null;
    }

    const start = this.anniversaryDate(year, month, anchorDay);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextStart = this.anniversaryDate(nextYear, nextMonth, anchorDay);
    const end = new Date(Date.UTC(
      Number(nextStart.slice(0, 4)),
      Number(nextStart.slice(5, 7)) - 1,
      Number(nextStart.slice(8, 10)) - 1
    )).toISOString().slice(0, 10);

    return { start, end, dueDate: nextStart };
  }

  private anniversaryDate(year: number, month: number, anchorDay: number): string {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(anchorDay, lastDay)).padStart(2, '0')}`;
  }

  private today(): string {
    const date = new Date();
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return localDate.toISOString().slice(0, 10);
  }
}
