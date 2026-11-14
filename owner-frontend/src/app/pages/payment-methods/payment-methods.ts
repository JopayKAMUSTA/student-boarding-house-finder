import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  BoardingHousePaymentMethodInfo,
  OwnerAuth
} from '../../services/owner-auth';

type ProviderChoice = 'GCash' | 'Maya' | 'Other';

@Component({
  selector: 'app-payment-methods',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './payment-methods.html',
  styleUrl: './payment-methods.css'
})
export class PaymentMethods implements OnInit, OnDestroy {
  private readonly ownerAuth = inject(OwnerAuth);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private methodListRequest = new Subscription();
  private qrRequests = new Subscription();
  private readonly requestedQrIds = new Set<number>();

  boardingHouseId = 0;
  paymentMethods: BoardingHousePaymentMethodInfo[] = [];
  qrImageUrls: Record<number, string> = {};
  qrImageErrors: Record<number, string> = {};
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  isSaving = false;
  isFormOpen = false;
  editingMethod: BoardingHousePaymentMethodInfo | null = null;
  providerChoice: ProviderChoice = 'GCash';
  otherProvider = '';
  accountName = '';
  accountNumber = '';
  qrFile: File | null = null;
  isActive = true;
  formError = '';
  savingStatusId: number | null = null;
  deletingId: number | null = null;

  ngOnInit(): void {
    this.boardingHouseId = Number(this.route.snapshot.paramMap.get('boardingHouseId'));
    if (!Number.isInteger(this.boardingHouseId) || this.boardingHouseId < 1) {
      this.errorMessage = 'The boarding house ID is invalid.';
      return;
    }
    this.loadPaymentMethods();
  }

  ngOnDestroy(): void {
    this.methodListRequest.unsubscribe();
    this.qrRequests.unsubscribe();
    this.revokeQrUrls();
  }

  loadPaymentMethods(): void {
    const token = this.getTokenOrRedirect();
    if (!token) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.methodListRequest.unsubscribe();
    this.methodListRequest = new Subscription();
    this.methodListRequest.add(this.ownerAuth.getOwnerPaymentMethods(
      token,
      this.boardingHouseId
    ).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (!response?.success || !Array.isArray(response.data)) {
          this.errorMessage = 'The payment-method response was not valid.';
          this.cdr.detectChanges();
          return;
        }
        this.paymentMethods = response.data;
        this.loadQrImages(response.data, token);
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        this.errorMessage = this.apiError(error, 'Could not load payment methods.');
        this.handleUnauthorized(error);
        this.cdr.detectChanges();
      }
    }));
  }

  openCreateForm(): void {
    this.editingMethod = null;
    this.providerChoice = 'GCash';
    this.otherProvider = '';
    this.accountName = '';
    this.accountNumber = '';
    this.qrFile = null;
    this.isActive = true;
    this.formError = '';
    this.isFormOpen = true;
  }

  openEditForm(method: BoardingHousePaymentMethodInfo): void {
    this.editingMethod = method;
    this.providerChoice = method.provider === 'GCash' || method.provider === 'Maya'
      ? method.provider
      : 'Other';
    this.otherProvider = this.providerChoice === 'Other' ? method.provider : '';
    this.accountName = method.account_name;
    this.accountNumber = method.account_number;
    this.qrFile = null;
    this.isActive = method.is_active;
    this.formError = '';
    this.isFormOpen = true;
  }

  cancelForm(): void {
    this.isFormOpen = false;
    this.editingMethod = null;
    this.qrFile = null;
    this.formError = '';
  }

  selectQr(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.qrFile = input.files?.[0] ?? null;
    this.formError = '';
  }

  savePaymentMethod(): void {
    if (this.isSaving) {
      return;
    }
    const provider = this.providerChoice === 'Other'
      ? this.otherProvider.trim()
      : this.providerChoice;
    if (!provider || !this.accountName.trim() || !this.accountNumber.trim()) {
      this.formError = 'Enter a provider, account holder name, and account number.';
      return;
    }
    if (!this.editingMethod && !this.qrFile) {
      this.formError = 'Upload a QR code image for the new payment method.';
      return;
    }

    const token = this.getTokenOrRedirect();
    if (!token) {
      return;
    }
    const data = new FormData();
    data.append('provider', provider);
    data.append('account_name', this.accountName.trim());
    data.append('account_number', this.accountNumber.trim());
    data.append('is_active', this.isActive ? '1' : '0');
    if (this.qrFile) {
      data.append('qr_code', this.qrFile);
    }

    this.isSaving = true;
    this.formError = '';
    this.successMessage = '';
    const request = this.editingMethod
      ? this.ownerAuth.updateOwnerPaymentMethod(
        token,
        this.boardingHouseId,
        this.editingMethod.id,
        data
      )
      : this.ownerAuth.createOwnerPaymentMethod(token, this.boardingHouseId, data);
    request.subscribe({
      next: (response) => {
        this.isSaving = false;
        if (!response?.success || !response.data) {
          this.formError = response?.message || 'The payment method was not saved.';
          this.cdr.detectChanges();
          return;
        }
        if (this.editingMethod && this.qrFile) {
          this.revokeQrUrl(this.editingMethod.id);
          this.requestedQrIds.delete(this.editingMethod.id);
          delete this.qrImageErrors[this.editingMethod.id];
        }
        this.successMessage = response.message || 'Payment method saved.';
        this.isFormOpen = false;
        this.editingMethod = null;
        this.loadPaymentMethods();
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving = false;
        this.formError = this.apiError(error, 'The payment method was not saved.');
        this.handleUnauthorized(error);
        this.cdr.detectChanges();
      }
    });
  }

  toggleActive(method: BoardingHousePaymentMethodInfo): void {
    if (this.savingStatusId !== null) {
      return;
    }
    const token = this.getTokenOrRedirect();
    if (!token) {
      return;
    }
    this.savingStatusId = method.id;
    this.errorMessage = '';
    this.ownerAuth.setOwnerPaymentMethodStatus(
      token,
      this.boardingHouseId,
      method.id,
      !method.is_active
    ).subscribe({
      next: (response) => {
        this.savingStatusId = null;
        if (!response?.success || !response.data) {
          this.errorMessage = response?.message || 'The payment-method status was not updated.';
        } else {
          method.is_active = response.data.is_active;
          this.successMessage = response.message || 'Payment-method status updated.';
        }
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.savingStatusId = null;
        this.errorMessage = this.apiError(error, 'The payment-method status was not updated.');
        this.handleUnauthorized(error);
        this.cdr.detectChanges();
      }
    });
  }

  deletePaymentMethod(method: BoardingHousePaymentMethodInfo): void {
    if (this.deletingId !== null || !window.confirm(`Remove ${method.provider} payment details?`)) {
      return;
    }
    const token = this.getTokenOrRedirect();
    if (!token) {
      return;
    }
    this.deletingId = method.id;
    this.errorMessage = '';
    this.ownerAuth.deleteOwnerPaymentMethod(
      token,
      this.boardingHouseId,
      method.id
    ).subscribe({
      next: (response) => {
        this.deletingId = null;
        if (!response?.success) {
          this.errorMessage = response?.message || 'The payment method was not removed.';
        } else {
          this.paymentMethods = this.paymentMethods.filter((item) => item.id !== method.id);
          this.revokeQrUrl(method.id);
          this.successMessage = response.message || 'Payment method removed.';
        }
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.deletingId = null;
        this.errorMessage = this.apiError(error, 'The payment method was not removed.');
        this.handleUnauthorized(error);
        this.cdr.detectChanges();
      }
    });
  }

  qrImageFailed(method: BoardingHousePaymentMethodInfo): void {
    this.revokeQrUrl(method.id);
    this.qrImageErrors[method.id] = 'QR image could not be displayed.';
    this.cdr.detectChanges();
  }

  private loadQrImages(methods: BoardingHousePaymentMethodInfo[], token: string): void {
    for (const method of methods) {
      if (this.requestedQrIds.has(method.id) || this.qrImageUrls[method.id]) {
        continue;
      }
      this.requestedQrIds.add(method.id);
      this.qrRequests.add(this.ownerAuth.getOwnerPaymentMethodQr(
        token,
        this.boardingHouseId,
        method.id
      ).subscribe({
        next: (blob) => {
          if (!blob.type.startsWith('image/')) {
            this.qrImageErrors[method.id] = 'QR image response was not an image.';
          } else {
            this.qrImageUrls[method.id] = URL.createObjectURL(blob);
          }
          this.cdr.detectChanges();
        },
        error: (error: HttpErrorResponse) => {
          this.qrImageErrors[method.id] = this.apiError(error, 'QR image could not be loaded.');
          this.handleUnauthorized(error);
          this.cdr.detectChanges();
        }
      }));
    }
  }

  private getTokenOrRedirect(): string | null {
    const token = this.ownerAuth.getToken();
    if (!token) {
      void this.router.navigate(['/login'], {
        queryParams: { notice: 'session-expired' }
      });
      return null;
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

  private apiError(error: HttpErrorResponse, fallback: string): string {
    const responseMessage = error.error instanceof Blob
      ? ''
      : error.error?.message;
    if (typeof responseMessage === 'string') {
      return responseMessage;
    }
    const validationErrors = error.error instanceof Blob ? null : error.error?.errors;
    if (validationErrors && typeof validationErrors === 'object') {
      const messages = Object.values(validationErrors as Record<string, unknown>)
        .flatMap((items) => Array.isArray(items) ? items : [])
        .filter((message): message is string => typeof message === 'string');
      if (messages.length) {
        return messages.join(' ');
      }
    }
    return error.status === 0
      ? 'Could not connect to the API. Check that Laravel is running and CORS is configured.'
      : fallback;
  }

  private revokeQrUrls(): void {
    Object.values(this.qrImageUrls).forEach((url) => URL.revokeObjectURL(url));
    this.qrImageUrls = {};
  }

  private revokeQrUrl(methodId: number): void {
    const url = this.qrImageUrls[methodId];
    if (url) {
      URL.revokeObjectURL(url);
      delete this.qrImageUrls[methodId];
    }
  }
}
