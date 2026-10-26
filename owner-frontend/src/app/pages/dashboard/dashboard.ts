import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { OwnerAuth } from '../../services/owner-auth';

@Component({
  imports: [CommonModule, RouterLink, RouterLinkActive],
  selector: 'app-dashboard',
  styleUrl: './dashboard.css',
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  private ownerAuth = inject(OwnerAuth);
  private router = inject(Router);

  ownerName = '';
  ownerEmail = '';
  ownerRole = '';
  totalBoardingHouses: number | null = null;
  availableRooms: number | null = null;
  occupiedRooms: number | null = null;
  pendingTasks: number | null = null;
  isLoadingSummary = false;
  isLoggingOut = false;
  summaryError = '';

  ngOnInit(): void {
    const owner = this.ownerAuth.getOwner();
    this.ownerName = owner?.name?.trim() ||
      [owner?.first_name, owner?.last_name].filter(Boolean).join(' ');
    this.ownerEmail = owner?.email || '';
    this.ownerRole = owner?.role || '';
    this.loadSummary();
  }

  logout(): void {
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

  private loadSummary(): void {
    const token = this.ownerAuth.getToken();
    if (!token) {
      this.ownerAuth.clearSession();
      void this.router.navigate(['/login'], {
        queryParams: { notice: 'session-expired' }
      });
      return;
    }

    this.isLoadingSummary = true;
    this.ownerAuth.getOwnerBoardingHouses(token).subscribe({
      next: (response) => {
        this.isLoadingSummary = false;
        const page = response?.data;
        if (!response?.success || !page ||
            !Number.isInteger(page.total) || page.total < 0 ||
            !Array.isArray(page.data)) {
          this.summaryError = 'The boarding-house summary response was not valid.';
          return;
        }

        this.totalBoardingHouses = page.total;
        if (page.data.length !== page.total) {
          return;
        }

        const roomCounts = page.data.map((house) => {
          if (typeof house !== 'object' || house === null) {
            return null;
          }
          const total = house.total_rooms;
          const available = house.available_rooms;
          if (!Number.isInteger(total) || total < 0 ||
              !Number.isInteger(available) || available < 0 || available > total) {
            return null;
          }
          return { total, available };
        });

        const validRoomCounts = roomCounts.filter(
          (counts): counts is { total: number; available: number } => counts !== null
        );
        if (validRoomCounts.length !== page.data.length) {
          this.summaryError = 'Room totals are not available for all boarding houses.';
          return;
        }

        this.availableRooms = validRoomCounts.reduce(
          (sum, counts) => sum + counts.available, 0
        );
        this.occupiedRooms = validRoomCounts.reduce(
          (sum, counts) => sum + counts.total - counts.available, 0
        );
      },
      error: (error: HttpErrorResponse) => {
        this.isLoadingSummary = false;
        if (error.status === 401 || error.status === 403) {
          this.ownerAuth.clearSession();
          void this.router.navigate(['/login'], {
            queryParams: {
              notice: error.status === 403 ? 'owner-required' : 'session-expired'
            }
          });
          return;
        }

        this.summaryError =
          typeof error.error?.message === 'string'
            ? error.error.message
            : 'Could not load your boarding-house summary. Please try again later.';
      }
    });
  }

  private finishLogout(serverRevoked: boolean): void {
    this.ownerAuth.clearSession();
    void this.router.navigate(['/login'], {
      queryParams: serverRevoked ? {} : { notice: 'logout-local' }
    });
  }
}
