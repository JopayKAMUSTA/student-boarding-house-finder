import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { OwnerAuth } from '../../services/owner-auth';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  private ownerAuth = inject(OwnerAuth);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

isSendingCode = false;
isVerifying = false;
codeSent = false;
emailVerified = false;
verificationCode = '';
verificationEmail = '';


onEmailChange(): void {
  this.emailVerified = false;
  this.codeSent = false;
  this.verificationCode = '';
  this.verificationEmail = '';
}

sendVerificationCode(form: NgForm): void {
  const email = String(form.value.email || '').trim().toLowerCase();

  if (!email || form.controls['email']?.invalid) {
    this.errorMessage = 'Please enter a valid email address first.';
    return;
  }

  this.errorMessage = '';
  this.successMessage = '';
  this.isSendingCode = true;

this.ownerAuth.sendRegistrationVerificationCode(email).subscribe({
  next: (response) => {
    this.successMessage = response.message;
    this.verificationEmail = email;
    this.codeSent = true;
    this.isSendingCode = false;
    this.cdr.detectChanges();
  },
  error: (error: HttpErrorResponse) => {
    this.errorMessage =
      error.error?.message ||
      error.error?.errors?.email?.[0] ||
      'Could not send verification code. Please try again.';

    this.isSendingCode = false;
    this.cdr.detectChanges();
  }
});
}


verifyEmail(): void {
  if (!this.verificationEmail || this.verificationCode.length !== 6) {
    return;
  }

  this.errorMessage = '';
  this.successMessage = '';
  this.isVerifying = true;

  this.ownerAuth.verifyRegistrationEmail(
    this.verificationEmail,
    this.verificationCode
  ).subscribe({
    next: (response) => {
      this.emailVerified = true;
      this.successMessage = response.message;
      this.isVerifying = false;
      this.cdr.detectChanges();
    },
    error: (error: HttpErrorResponse) => {
      this.errorMessage =
        error.error?.message || 'Invalid verification code.';
      this.isVerifying = false;
      this.cdr.detectChanges();
    }
  });
}



  successMessage = '';
  errorMessage = '';
  isSubmitting = false;
  showPassword = false;
  showPasswordConfirmation = false;

  createAccount(form: NgForm) {
    this.successMessage = '';
    this.errorMessage = '';

    if (form.invalid) {
      this.errorMessage = 'Please complete all required fields.';
      return;
    }

    const data = form.value;

    if (data.password !== data.password_confirmation) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    this.isSubmitting = true;

    this.ownerAuth.registerOwner(data).subscribe({
      next: response => {
        this.successMessage = response.message || 'Owner account created successfully.';
        this.isSubmitting = false;

        this.emailVerified = false;
        this.codeSent = false;
        this.verificationCode = '';
        this.verificationEmail = '';

        this.router.navigate(['/login']);
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 422) {
          const errors = error.error?.errors;

          this.errorMessage = errors
            ? Object.values(errors).flat().join(' ')
            : error.error?.message || 'Please check your information.';
        } else if (error.status === 0) {
          this.errorMessage =
            'Could not connect to Laravel. Check the server and CORS settings.';
        } else {
          this.errorMessage =
            error.error?.message || 'Registration failed. Please try again.';
        }

        this.isSubmitting = false;
      }
    });
  }
}
