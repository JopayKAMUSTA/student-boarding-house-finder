
import {
  Component,
  OnInit,
  ChangeDetectorRef,
  inject,
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';

interface DashboardStats {
  total_users: number;
  total_boarding_houses: number;
  approved_listings: number;
  pending_approvals: number;
}

interface BoardingHouse {
  id: number;
  name: string;
  city: string;
  address: string;
  monthly_rent: number;
  status: string;
  created_at: string;
}

interface DashboardResponse {
  success: boolean;
  data: {
    stats: DashboardStats;
    recent_submissions: BoardingHouse[];
  };
  message?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly apiUrl =
    'http://127.0.0.1:8000/api/admin/dashboard';

  stats: DashboardStats = {
    total_users: 0,
    total_boarding_houses: 0,
    approved_listings: 0,
    pending_approvals: 0,
  };

  recentSubmissions: BoardingHouse[] = [];

  isLoading = false;
  hasLoaded = false;
  errorMessage = '';
  lastUpdated: Date | null = null;

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    // Support either storage location so existing login behavior is preserved.
    const token =
      sessionStorage.getItem('admin_token') ||
      localStorage.getItem('admin_token');

    if (!token) {
      this.isLoading = false;
      this.errorMessage =
        'Admin authentication token not found. Please log in again.';
      this.cdr.detectChanges();
      return;
    }

    const headers = new HttpHeaders({
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    });

    this.http
      .get<DashboardResponse>(this.apiUrl, { headers })
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.hasLoaded = true;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          if (response?.success && response.data) {
            this.stats = {
              total_users: Number(
                response.data.stats?.total_users ?? 0
              ),
              total_boarding_houses: Number(
                response.data.stats?.total_boarding_houses ?? 0
              ),
              approved_listings: Number(
                response.data.stats?.approved_listings ?? 0
              ),
              pending_approvals: Number(
                response.data.stats?.pending_approvals ?? 0
              ),
            };

            this.recentSubmissions =
              response.data.recent_submissions ?? [];

            this.lastUpdated = new Date();
            this.errorMessage = '';
          } else {
            this.errorMessage =
              response?.message ||
              'The dashboard returned an invalid response.';
          }

          this.cdr.detectChanges();
        },

        error: (error: HttpErrorResponse) => {
          console.error('Dashboard loading error:', error);

          this.errorMessage =
            error.error?.message ||
            'Unable to load dashboard information. Please try again.';

          this.cdr.detectChanges();
        },
      });
  }

  refreshDashboard(): void {
    this.loadDashboard();
  }

  getStatusClass(status: string): string {
    switch ((status || '').toLowerCase()) {
      case 'approved':
        return 'status-approved';

      case 'pending':
        return 'status-pending';

      case 'rejected':
        return 'status-rejected';

      default:
        return 'status-default';
    }
  }

  get approvedPercentage(): number {
    if (this.stats.total_boarding_houses === 0) {
      return 0;
    }

    return Math.min(
      100,
      (this.stats.approved_listings /
        this.stats.total_boarding_houses) * 100
    );
  }

  get pendingPercentage(): number {
    if (this.stats.total_boarding_houses === 0) {
      return 0;
    }

    return Math.min(
      100,
      (this.stats.pending_approvals /
        this.stats.total_boarding_houses) * 100
    );
  }
}
