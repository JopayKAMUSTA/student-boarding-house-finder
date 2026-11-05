
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { OwnerAuth } from '../../services/owner-auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  private ownerAuth = inject(OwnerAuth);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  errorMessage = '';
  isSubmitting = false;
  showPassword = false;
  statusMessage = this.getStatusMessage();

  login(form: NgForm) {
    this.errorMessage = '';

    if (form.invalid) {
      this.errorMessage = 'Please enter your email and password.';
      return;
    }

    this.isSubmitting = true;

    this.ownerAuth.loginOwner({
      email: form.value.email,
      password: form.value.password
    }).subscribe({
      next: (response) => {
        const token = response.data?.token;
        if (!token) {
          this.errorMessage =
            'Login succeeded, but no authentication token was returned.';
          this.isSubmitting = false;
          return;
        }

        this.ownerAuth.setSession(token, response.data);
        this.router.navigate(['/dashboard']);
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage =
          error.error?.message ||
          'Login failed. Please check your email and password.';

        this.isSubmitting = false;
      }
    });
  }

  private getStatusMessage(): string {
    switch (this.route.snapshot.queryParamMap.get('notice')) {
      case 'logout-local':
        return 'You are signed out locally, but the server could not confirm token revocation.';
      case 'session-expired':
        return 'Your session is no longer valid. Please sign in again.';
      case 'owner-required':
        return 'This account is not authorized to access owner pages.';
      default:
        return '';
    }
  }
}
