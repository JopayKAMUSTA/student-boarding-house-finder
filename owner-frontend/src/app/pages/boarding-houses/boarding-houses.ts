import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  BillingPolicy,
  BoardingHouseSettingsData,
  OwnerAuth,
  BoardingHouseRoomInfo,
  UpdateBoardingHouseSettingsResponse
} from '../../services/owner-auth';

interface BoardingHouseSettingsDraft {
  late_payment_fee: number | null;
  grace_period_days: number | null;
  rules: string;
}

@Component({
  imports: [CommonModule, FormsModule, RouterLink],
  selector: 'app-boarding-houses',
  styleUrl: './boarding-houses.css',
  templateUrl: './boarding-houses.html',
})
export class BoardingHouses implements OnInit {
  private ownerAuth = inject(OwnerAuth);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  boardingHouses: BoardingHouseRoomInfo[] = [];
  currentPage = 1;
  lastPage = 1;
  total = 0;
  isLoading = false;
  errorMessage = '';
  billingPolicyDrafts: Record<number, BillingPolicy> = {};
  billingPolicySaving: Record<number, boolean> = {};
  billingPolicySuccess: Record<number, string> = {};
  billingPolicyErrors: Record<number, string> = {};
  boardingHouseSettingsDrafts: Record<number, BoardingHouseSettingsDraft> = {};
  boardingHouseSettingsSaving: Record<number, boolean> = {};
  boardingHouseSettingsSuccess: Record<number, string> = {};
  boardingHouseSettingsErrors: Record<number, string> = {};

  ngOnInit(): void {
    this.loadBoardingHouses();
  }

  loadBoardingHouses(page = this.currentPage): void {
    const token = this.ownerAuth.getToken();
    if (!token) {
      void this.router.navigate(['/login'], {
        queryParams: { notice: 'session-expired' }
      });
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    console.log('BEFORE API REQUEST:', this.isLoading);
    this.ownerAuth.getOwnerBoardingHouses(token, page).subscribe({
next: (response) => {
  console.log('API SUCCESS:', response);

  this.isLoading = false;

  const result = response?.data;

  if (
    !response?.success ||
    !result ||
    !Array.isArray(result.data) ||
    !Number.isInteger(result.total) ||
    !Number.isInteger(result.current_page) ||
    !Number.isInteger(result.last_page)
  ) {
    this.errorMessage = 'The boarding-house list response was not valid.';
    this.cdr.detectChanges();
    return;
  }

  this.boardingHouses = result.data;
  this.currentPage = result.current_page;
  this.lastPage = result.last_page;
  this.total = result.total;

  console.log('BOARDING HOUSES:', this.boardingHouses);
  console.log('FINAL LOADING STATE:', this.isLoading);
  console.log('TOTAL:', this.total);

  this.cdr.detectChanges();
},
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        this.cdr.detectChanges();
        if (error.status === 401 || error.status === 403) {
          this.ownerAuth.clearSession();
          void this.router.navigate(['/login'], {
            queryParams: {
              notice: error.status === 403 ? 'owner-required' : 'session-expired'
            }
          });
          return;
        }

        this.errorMessage = typeof error.error?.message === 'string'
          ? error.error.message
          : error.status === 0
            ? 'Could not connect to the API. Check that Laravel is running and CORS is configured.'
            : 'Could not load your boarding houses. Please try again.';
      }
    });
  }

  previousPage(): void {
    if (!this.isLoading && this.currentPage > 1) {
      this.loadBoardingHouses(this.currentPage - 1);
    }
  }

  nextPage(): void {
    if (!this.isLoading && this.currentPage < this.lastPage) {
      this.loadBoardingHouses(this.currentPage + 1);
    }
  }

  currentBillingPolicy(house: BoardingHouseRoomInfo): BillingPolicy {
    return house.billing_policy ?? 'full_monthly';
  }

  billingPolicyDraft(house: BoardingHouseRoomInfo): BillingPolicy {
    return house.id
      ? this.billingPolicyDrafts[house.id] ?? this.currentBillingPolicy(house)
      : this.currentBillingPolicy(house);
  }

  setBillingPolicyDraft(house: BoardingHouseRoomInfo, policy: BillingPolicy): void {
    if (house.id) {
      this.billingPolicyDrafts[house.id] = policy;
      this.billingPolicySuccess[house.id] = '';
      this.billingPolicyErrors[house.id] = '';
    }
  }

  billingPolicyLabel(policy: BillingPolicy): string {
    return policy === 'prorated' ? 'Prorated' : 'Full Monthly';
  }

  latePaymentFee(house: BoardingHouseRoomInfo): number {
    return Number(house.late_payment_fee ?? 0);
  }

  gracePeriodDays(house: BoardingHouseRoomInfo): number {
    return Number(house.grace_period_days ?? 0);
  }

  settingsDraft(house: BoardingHouseRoomInfo): BoardingHouseSettingsDraft {
    if (!house.id) {
      return { late_payment_fee: 0, grace_period_days: 0, rules: '' };
    }

    return this.boardingHouseSettingsDrafts[house.id] ??= {
      late_payment_fee: this.latePaymentFee(house),
      grace_period_days: this.gracePeriodDays(house),
      rules: house.rules ?? ''
    };
  }

  settingsChanged(house: BoardingHouseRoomInfo): boolean {
    const draft = this.settingsDraft(house);
    return draft.late_payment_fee !== this.latePaymentFee(house) ||
      draft.grace_period_days !== this.gracePeriodDays(house) ||
      draft.rules !== (house.rules ?? '');
  }

  saveBoardingHouseSettings(house: BoardingHouseRoomInfo): void {
    if (!house.id || this.boardingHouseSettingsSaving[house.id]) {
      return;
    }

    const draft = this.settingsDraft(house);
    if (
      draft.late_payment_fee === null ||
      !Number.isFinite(draft.late_payment_fee) ||
      draft.late_payment_fee < 0 ||
      Math.round(draft.late_payment_fee * 100) !== draft.late_payment_fee * 100
    ) {
      this.boardingHouseSettingsErrors[house.id] =
        'Enter a late payment fee of zero or more with up to two decimal places.';
      return;
    }
    if (
      draft.grace_period_days === null ||
      !Number.isInteger(draft.grace_period_days) ||
      draft.grace_period_days < 0
    ) {
      this.boardingHouseSettingsErrors[house.id] =
        'Enter a grace period as a non-negative whole number of days.';
      return;
    }

    const token = this.ownerAuth.getToken();
    if (!token) {
      void this.router.navigate(['/login'], {
        queryParams: { notice: 'session-expired' }
      });
      return;
    }

    const settings: BoardingHouseSettingsData = {
      late_payment_fee: draft.late_payment_fee,
      grace_period_days: draft.grace_period_days,
      rules: draft.rules.trim() || null
    };
    const houseId = house.id;
    this.boardingHouseSettingsSaving[houseId] = true;
    this.boardingHouseSettingsErrors[houseId] = '';
    this.boardingHouseSettingsSuccess[houseId] = '';
    this.ownerAuth.updateOwnerBoardingHouseSettings(token, houseId, settings).subscribe({
      next: (response: UpdateBoardingHouseSettingsResponse) => {
        this.boardingHouseSettingsSaving[houseId] = false;
        if (
          !response?.success ||
          !response.data ||
          response.data.late_payment_fee === undefined ||
          response.data.grace_period_days === undefined
        ) {
          this.boardingHouseSettingsErrors[houseId] =
            response.message || 'The boarding-house settings were not updated.';
          this.cdr.detectChanges();
          return;
        }

        house.late_payment_fee = response.data.late_payment_fee;
        house.grace_period_days = response.data.grace_period_days;
        house.rules = response.data.rules;
        this.boardingHouseSettingsDrafts[houseId] = {
          late_payment_fee: Number(response.data.late_payment_fee),
          grace_period_days: response.data.grace_period_days,
          rules: response.data.rules ?? ''
        };
        this.boardingHouseSettingsSuccess[houseId] =
          response.message || 'Boarding-house settings updated successfully.';
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.boardingHouseSettingsSaving[houseId] = false;
        this.boardingHouseSettingsErrors[houseId] = this.getPolicyErrorMessage(error);
        if (error.status === 401) {
          this.ownerAuth.clearSession();
          void this.router.navigate(['/login'], {
            queryParams: { notice: 'session-expired' }
          });
        }
        this.cdr.detectChanges();
      }
    });
  }

  saveBillingPolicy(house: BoardingHouseRoomInfo): void {
    if (!house.id || this.billingPolicySaving[house.id]) {
      return;
    }

    const policy = this.billingPolicyDraft(house);
    if (policy === this.currentBillingPolicy(house)) {
      return;
    }

    const token = this.ownerAuth.getToken();
    if (!token) {
      void this.router.navigate(['/login'], {
        queryParams: { notice: 'session-expired' }
      });
      return;
    }

    const houseId = house.id;
    this.billingPolicySuccess[houseId] = '';
    this.billingPolicyErrors[houseId] = '';
    this.billingPolicySaving[houseId] = true;

    this.ownerAuth.updateOwnerBoardingHouseBillingPolicy(token, houseId, policy)
      .subscribe({
        next: (response) => {
          this.billingPolicySaving[houseId] = false;
          if (!response.success || !response.data?.billing_policy) {
            this.billingPolicyErrors[houseId] =
              response.message || 'The billing policy was not updated.';
            this.cdr.detectChanges();
            return;
          }

          house.billing_policy = response.data.billing_policy;
          this.billingPolicyDrafts[houseId] = response.data.billing_policy;
          this.billingPolicySuccess[houseId] =
            response.message || 'Billing policy updated successfully.';
          this.cdr.detectChanges();
        },
        error: (error: HttpErrorResponse) => {
          this.billingPolicySaving[houseId] = false;
          this.billingPolicyErrors[houseId] = this.getPolicyErrorMessage(error);
          if (error.status === 401) {
            this.ownerAuth.clearSession();
            void this.router.navigate(['/login'], {
              queryParams: { notice: 'session-expired' }
            });
          }
          this.cdr.detectChanges();
        }
      });
  }

  private getPolicyErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'Could not connect to the API. Check that Laravel is running and CORS is configured.';
    }

    const validationErrors = error.error?.errors;
    if (validationErrors && typeof validationErrors === 'object') {
      const messages = Object.values(validationErrors as Record<string, unknown>)
        .flatMap((messages) => Array.isArray(messages) ? messages : [])
        .filter((message): message is string => typeof message === 'string');
      if (messages.length > 0) {
        return messages.join(' ');
      }
    }

    if (typeof error.error?.message === 'string') {
      return error.error.message;
    }

    return 'Could not update the billing policy. Please try again.';
  }
}
