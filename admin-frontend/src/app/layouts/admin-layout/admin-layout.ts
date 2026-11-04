
import { Component } from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';

import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css'
})
export class AdminLayoutComponent {

  admin: any;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    this.admin = this.authService.getAdmin();
  }

  get adminName(): string {
    if (!this.admin) {
      return 'Administrator';
    }

    return this.admin.name ||
      `${this.admin.first_name || ''} ${this.admin.last_name || ''}`.trim();
  }

  get adminInitial(): string {
    return this.adminName.charAt(0).toUpperCase();
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.finishLogout(),
      error: () => this.finishLogout()
    });
  }

  private finishLogout(): void {
    this.authService.clearSession();
    this.router.navigate(['/login']);
  }
}
