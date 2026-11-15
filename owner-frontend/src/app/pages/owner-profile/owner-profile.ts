
import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  OwnerAuth,
  OwnerProfileResponse,
  UpdateOwnerProfileData
} from '../../services/owner-auth';

@Component({
  selector: 'app-owner-profile',
  imports: [CommonModule, FormsModule],
  templateUrl: './owner-profile.html',
  styleUrl: './owner-profile.css',
})
export class OwnerProfile implements OnInit {
  private ownerAuth = inject(OwnerAuth);
  private cdr = inject(ChangeDetectorRef);

  profile: OwnerProfileResponse | null = null;

  get identityVerificationStatus(): string {
    const verificationStatus = this.profile?.profile?.verification_status;
    const hasSavedFront = !!this.profile?.profile?.valid_id_front;
    const hasSavedBack = !!this.profile?.profile?.valid_id_back;

    if (verificationStatus === 'approved') {
      return 'Approved';
    }

    if (verificationStatus === 'pending') {
      return 'Pending';
    }

    if (verificationStatus === 'rejected') {
      return 'Rejected';
    }

    if (hasSavedFront || hasSavedBack) {
      return 'Pending';
    }

    return 'Not Submitted';
  }

  get canSubmitIdentityDocuments(): boolean {
    const status = this.profile?.profile?.verification_status;
    const hasSavedDocuments = !!this.profile?.profile?.valid_id_front && !!this.profile?.profile?.valid_id_back;

    return status !== 'approved' && !(status === 'pending' && hasSavedDocuments) && !this.isSubmittingIdentity;
  }

  passwordForm = {
  current_password: '',
  new_password: '',
  new_password_confirmation: ''
};

isChangingPassword = false;
passwordErrorMessage = '';
passwordSuccessMessage = '';

changePassword(): void {
  const token = this.ownerAuth.getToken();

  if (!token || this.isChangingPassword) {
    return;
  }

  if (!this.passwordForm.current_password) {
    this.passwordErrorMessage = 'Please enter your current password.';
    return;
  }

  if (this.passwordForm.new_password.length < 8) {
    this.passwordErrorMessage = 'Your new password must contain at least 8 characters.';
    return;
  }

  if (
    this.passwordForm.new_password !==
    this.passwordForm.new_password_confirmation
  ) {
    this.passwordErrorMessage = 'New passwords do not match.';
    return;
  }

  this.isChangingPassword = true;
  this.passwordErrorMessage = '';
  this.passwordSuccessMessage = '';
  this.cdr.detectChanges();

  this.ownerAuth.changeOwnerPassword(token, this.passwordForm).subscribe({
    next: (response) => {
      this.passwordSuccessMessage = response.message;
      this.passwordForm = {
        current_password: '',
        new_password: '',
        new_password_confirmation: ''
      };

      this.isChangingPassword = false;
      this.cdr.detectChanges();
    },
    error: (error) => {
      this.passwordErrorMessage =
        error.error?.errors?.new_password?.[0] ||
        error.error?.errors?.current_password?.[0] ||
        error.error?.message ||
        'Unable to change your password. Please try again.';

      this.isChangingPassword = false;
      this.cdr.detectChanges();
    }
  });
}
  form: UpdateOwnerProfileData = {
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    contact_number: '',
    business_name: '',
    business_address: ''
  };

  isLoading = true;
  isSaving = false;
  errorMessage = '';
  successMessage = '';

  frontIdFile: File | null = null;
backIdFile: File | null = null;

frontIdPreview: string | null = null;
backIdPreview: string | null = null;

isSubmittingIdentity = false;
identityErrorMessage = '';
identitySuccessMessage = '';

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    const token = this.ownerAuth.getToken();

    if (!token) {
      this.isLoading = false;
      this.errorMessage = 'Your session has expired. Please log in again.';
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.ownerAuth.getOwnerProfile(token).subscribe({
      next: (response) => {
        this.profile = response;

        this.form = {
          first_name: response.user.first_name ?? '',
          middle_name: response.user.middle_name ?? '',
          last_name: response.user.last_name ?? '',
          email: response.user.email ?? '',
          contact_number: response.profile.contact_number ?? '',
          business_name: response.profile.business_name ?? '',
          business_address: response.profile.business_address ?? ''
        };

        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Unable to load your profile. Please try again.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onContactNumberChange(value: string): void {
  this.form.contact_number = (value || '')
    .replace(/\D/g, '')
    .slice(0, 11);
}

saveProfile(): void {
  const token = this.ownerAuth.getToken();

  if (!token || this.isSaving) {
    return;
  }

  const email = this.form.email.trim();
  const phone = (this.form.contact_number ?? '').trim();

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const phonePattern = /^09\d{9}$/;

  if (!emailPattern.test(email)) {
    this.errorMessage = 'Please enter a valid email address.';
    this.successMessage = '';
    return;
  }

  if (phone && !phonePattern.test(phone)) {
    this.errorMessage = 'Contact number must contain exactly 11 digits and start with 09.';
    this.successMessage = '';
    return;
  }

  this.form.email = email;
  this.form.first_name = this.form.first_name.trim();
  this.form.middle_name = this.form.middle_name?.trim() ?? '';
  this.form.last_name = this.form.last_name.trim();
  this.form.contact_number = phone;

  if (!this.form.first_name || !this.form.last_name) {
    this.errorMessage = 'First name and last name are required.';
    return;
  }

  this.isSaving = true;
  this.errorMessage = '';
  this.successMessage = '';
  this.cdr.detectChanges();

  this.ownerAuth.updateOwnerProfile(token, this.form).subscribe({
    next: () => {
      this.successMessage = 'Your profile has been updated successfully.';
      this.isSaving = false;
      this.loadProfile();
      this.cdr.detectChanges();
    },
    error: (error) => {
      this.errorMessage =
        error.error?.errors?.email?.[0] ||
        error.error?.errors?.contact_number?.[0] ||
        error.error?.message ||
        'Unable to update your profile. Please try again.';

      this.isSaving = false;
      this.cdr.detectChanges();
    }
  });
}
onIdentityFileSelected(
  event: Event,
  side: 'front' | 'back'
): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  if (!allowedTypes.includes(file.type)) {
  this.identityErrorMessage = 'Please select a JPG, JPEG, PNG, or WEBP image.';
    input.value = '';
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    this.identityErrorMessage = 'Each ID image must not exceed 5 MB.';
    input.value = '';
    return;
  }

const status = this.profile?.profile?.verification_status;
const hasSavedDocuments = !!this.profile?.profile?.valid_id_front && !!this.profile?.profile?.valid_id_back;

if (status === 'approved' || (status === 'pending' && hasSavedDocuments)) {
  this.identityErrorMessage = 'Your ID has already been approved and cannot be replaced.';
  input.value = '';
  return;
}

  this.identityErrorMessage = '';
  this.identitySuccessMessage = '';

  const previewUrl = URL.createObjectURL(file);

  if (side === 'front') {
    if (this.frontIdPreview) {
      URL.revokeObjectURL(this.frontIdPreview);
    }

    this.frontIdFile = file;
    this.frontIdPreview = previewUrl;
  } else {
    if (this.backIdPreview) {
      URL.revokeObjectURL(this.backIdPreview);
    }

    this.backIdFile = file;
    this.backIdPreview = previewUrl;
  }
}

submitIdentityDocuments(): void {
  const token = this.ownerAuth.getToken();

  if (!token || this.isSubmittingIdentity) {
    return;
  }

const status = this.profile?.profile?.verification_status;
const hasSavedDocuments = !!this.profile?.profile?.valid_id_front && !!this.profile?.profile?.valid_id_back;

if (status === 'approved' || (status === 'pending' && hasSavedDocuments)) {
  this.identityErrorMessage = 'Your ID has already been approved and cannot be replaced.';
  return;
}

  if (!this.frontIdFile || !this.backIdFile) {
    this.identityErrorMessage = 'Please select both the front and back images of your valid ID.';
    return;
  }

  this.isSubmittingIdentity = true;
  this.identityErrorMessage = '';
  this.identitySuccessMessage = '';
  this.cdr.detectChanges();

  const formData = new FormData();
  formData.append('valid_id_front', this.frontIdFile);
  formData.append('valid_id_back', this.backIdFile);

  this.ownerAuth.submitOwnerIdentityDocuments(token, formData).subscribe({
    next: (response) => {
      this.identitySuccessMessage =
        response.message || 'Your ID documents have been submitted successfully.';

      this.frontIdFile = null;
      this.backIdFile = null;

      if (this.frontIdPreview) {
        URL.revokeObjectURL(this.frontIdPreview);
        this.frontIdPreview = null;
      }

      if (this.backIdPreview) {
        URL.revokeObjectURL(this.backIdPreview);
        this.backIdPreview = null;
      }

      this.isSubmittingIdentity = false;
      this.loadProfile();
      this.cdr.detectChanges();
    },
    error: (error) => {
      this.identityErrorMessage =
        error.error?.errors?.valid_id_front?.[0] ||
        error.error?.errors?.valid_id_back?.[0] ||
        error.error?.message ||
        'Unable to submit your ID documents. Please try again.';

      this.isSubmittingIdentity = false;
      this.cdr.detectChanges();
    }
  });
}
}
