import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {

  email = '';
  password = '';

  showPassword = false;
  rememberMe = false;

  errorMessage = '';
  isLoading = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  login(): void {

    this.errorMessage = '';

    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter your email and password.';
      return;
    }

    this.isLoading = true;

    this.authService.login(this.email, this.password).subscribe({

      next: (response) => {

        this.isLoading = false;

        if (response.success && response.data.role === 'admin') {
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage = 'You are not authorized to access the admin dashboard.';
          this.authService.clearSession();
        }

      },

      error: (error) => {

        this.isLoading = false;

        this.errorMessage =
          error.error?.message || 'Login failed. Please check your credentials.';

      }

    });

  }

}