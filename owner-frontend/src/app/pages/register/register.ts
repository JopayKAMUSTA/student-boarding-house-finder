
import { Component, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { OwnerAuth } from '../../services/owner-auth';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  private ownerAuth = inject(OwnerAuth);

  successMessage = '';
  errorMessage = '';
  isSubmitting = false;

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
      next: (response: any) => {
        this.successMessage =
          response.message || 'Owner account created successfully.';
        form.resetForm();
        this.isSubmitting = false;
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
