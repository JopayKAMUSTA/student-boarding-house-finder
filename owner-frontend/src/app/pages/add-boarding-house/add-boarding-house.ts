import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  BillingPolicy,
  CreateBoardingHouseData,
  OwnerAuth
} from '../../services/owner-auth';

@Component({
  imports: [CommonModule, FormsModule, RouterLink],
  selector: 'app-add-boarding-house',
  styleUrl: './add-boarding-house.css',
  templateUrl: './add-boarding-house.html',
})
export class AddBoardingHouse {
  private ownerAuth = inject(OwnerAuth);
  private router = inject(Router);

  amenitiesInput = '';
  formModel = {
    name: '',
    description: '',
    rules: '',
    city: '',
    barangay: '',
    address: '',
    monthly_rent: null as number | null,
    billing_policy: 'full_monthly' as BillingPolicy,
    security_deposit: null as number | null,
    advance_payment: null as number | null,
    late_payment_fee: 0 as number | null,
    grace_period_days: 0 as number | null,
    available_rooms: null as number | null,
    total_rooms: null as number | null,
    room_type: ''
  };
  isSubmitting = false;
  successMessage = '';
  errorMessage = '';

  submit(form: NgForm): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (form.invalid) {
      form.control.markAllAsTouched();
      this.errorMessage = 'Complete all required fields with valid values.';
      return;
    }

    const values = this.formModel;
    const totalRooms = Number(values.total_rooms);
    const availableRooms = Number(values.available_rooms);
    if (availableRooms > totalRooms) {
      this.errorMessage = 'Available rooms cannot exceed total rooms.';
      return;
    }

    const token = this.ownerAuth.getToken();
    if (!token) {
      void this.router.navigate(['/login'], {
        queryParams: { notice: 'session-expired' }
      });
      return;
    }

    const amenities = this.amenitiesInput
      .split(/[,\n]/)
      .map((amenity) => amenity.trim())
      .filter(Boolean);
    const payload: CreateBoardingHouseData = {
      name: values.name.trim(),
      city: values.city.trim(),
      address: values.address.trim(),
      monthly_rent: Number(values.monthly_rent),
      billing_policy: values.billing_policy,
      available_rooms: availableRooms,
      total_rooms: totalRooms,
      ...(values.description.trim() && { description: values.description.trim() }),
      rules: values.rules.trim() || null,
      ...(values.barangay.trim() && { barangay: values.barangay.trim() }),
      ...(this.hasValue(values.security_deposit) && {
        security_deposit: Number(values.security_deposit)
      }),
      ...(this.hasValue(values.advance_payment) && {
        advance_payment: Number(values.advance_payment)
      }),
      late_payment_fee: Number(values.late_payment_fee ?? 0),
      grace_period_days: Number(values.grace_period_days ?? 0),
      ...(values.room_type.trim() && { room_type: values.room_type.trim() }),
      ...(amenities.length > 0 && { amenities })
    };

    this.isSubmitting = true;
    this.ownerAuth.createOwnerBoardingHouse(token, payload).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        if (!response.success) {
          this.errorMessage = response.message || 'The boarding house was not created.';
          return;
        }

        this.successMessage =
          response.message || 'Boarding house submitted successfully.';
        this.formModel = {
          name: '',
          description: '',
          rules: '',
          city: '',
          barangay: '',
          address: '',
          monthly_rent: null,
          billing_policy: 'full_monthly',
          security_deposit: null,
          advance_payment: null,
          late_payment_fee: 0,
          grace_period_days: 0,
          available_rooms: null,
          total_rooms: null,
          room_type: ''
        };
        form.resetForm(this.formModel);
        this.amenitiesInput = '';
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting = false;
        this.errorMessage = this.getErrorMessage(error);
        if (error.status === 401) {
          this.ownerAuth.clearSession();
          void this.router.navigate(['/login'], {
            queryParams: { notice: 'session-expired' }
          });
        }
      }
    });
  }

  private hasValue(value: unknown): boolean {
    return value !== '' && value !== null && value !== undefined;
  }

  private getErrorMessage(error: HttpErrorResponse): string {
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

    return 'Could not create the boarding house. Please try again.';
  }
}
