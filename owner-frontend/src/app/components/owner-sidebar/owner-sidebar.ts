import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { OwnerAuth } from '../../services/owner-auth';

@Component({
  selector: 'app-owner-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './owner-sidebar.html',
  styleUrl: './owner-sidebar.css'
})
export class OwnerSidebar {
  private readonly ownerAuth = inject(OwnerAuth);
  private readonly router = inject(Router);

  isLoggingOut = false;

  get roomManagementLink(): string[] {
    const match = this.router.url.match(
      /^\/owner\/boarding-houses\/(\d+)\/rooms(?:\/|$)/
    );
    return match
      ? ['/owner', 'boarding-houses', match[1], 'rooms']
      : ['/boarding-houses'];
  }

  isRoomManagementActive(): boolean {
    return /^\/owner\/boarding-houses\/\d+\/rooms(?:\/|$)/.test(this.router.url);
  }

  logout(): void {
    if (this.isLoggingOut) {
      return;
    }

    const token = this.ownerAuth.getToken();
    if (!token) {
      this.finishLogout(false);
      return;
    }

    this.isLoggingOut = true;
    this.ownerAuth.logoutOwner(token).subscribe({
      next: (response) => this.finishLogout(response.success),
      error: () => this.finishLogout(false)
    });
  }

  private finishLogout(serverRevoked: boolean): void {
    this.ownerAuth.clearSession();
    void this.router.navigate(['/login'], {
      queryParams: serverRevoked ? {} : { notice: 'logout-local' }
    });
  }
}
