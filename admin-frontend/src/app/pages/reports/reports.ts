
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth';

interface ReportSummary {
  total_users: number;
  total_students: number;
  total_owners: number;
  total_admins: number;
  total_boarding_houses: number;
  total_rooms: number;
  total_tenants: number;
  total_room_assignments: number;
}

interface ReportItem {
  label: string;
  total: number;
}

interface MonthlyTrend {
  month: string;
  label: string;
  users: number;
  boarding_houses: number;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports implements OnInit {

  private apiUrl = 'http://127.0.0.1:8000/api';

  loading = false;
  errorMessage = '';
  today = new Date();

  summary: ReportSummary | null = null;

  usersByRole: ReportItem[] = [];
  housesByStatus: ReportItem[] = [];
  roomsByStatus: ReportItem[] = [];
  monthlyTrends: MonthlyTrend[] = [];

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadReports();
  }

  loadReports(): void {
    this.loading = true;
    this.errorMessage = '';

    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.auth.getToken() ?? ''}`,
      Accept: 'application/json',
    });

    this.http.get<any>(`${this.apiUrl}/admin/reports`, { headers })
      .subscribe({
        next: (response) => {
          if (!response.success) {
            this.errorMessage = 'Unable to load reports.';
            this.loading = false;
            return;
          }

          this.summary = response.summary;

          this.usersByRole = this.toReportItems(
            response.users_by_role
          );

          this.housesByStatus = this.toReportItems(
            response.boarding_houses_by_status
          );

          this.roomsByStatus = this.toReportItems(
            response.rooms_by_status
          );

          this.monthlyTrends = response.monthly_trends ?? [];

          this.loading = false;
        },
        error: (error) => {
          console.error('Reports API error:', error);

          this.errorMessage =
            error.status === 401
              ? 'Your session has expired. Please log in again.'
              : error.error?.message ?? 'Failed to load reports. Please try again.';

          this.loading = false;
        },
      });
  }

  private toReportItems(
    data: Record<string, number> | null
  ): ReportItem[] {
    if (!data) {
      return [];
    }

    return Object.entries(data).map(([label, total]) => ({
      label: this.formatLabel(label),
      total: Number(total),
    }));
  }

  private formatLabel(value: string): string {
    if (!value) {
      return 'Unknown';
    }

    return value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, letter => letter.toUpperCase());
  }

  getBarWidth(value: number, items: ReportItem[]): number {
    const maximum = Math.max(
      ...items.map(item => item.total),
      1
    );

    return (value / maximum) * 100;
  }

  getTrendWidth(
    value: number,
    key: 'users' | 'boarding_houses'
  ): number {
    const maximum = Math.max(
      ...this.monthlyTrends.map(item => item[key]),
      1
    );

    return (value / maximum) * 100;
  }

  printReport(): void {
    window.print();
  }
}
