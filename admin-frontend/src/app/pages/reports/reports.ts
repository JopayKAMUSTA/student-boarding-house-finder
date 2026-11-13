
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { finalize } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface ReportsData {
  users: {
    total: number;
    students: number;
    owners: number;
    admins: number;
    active: number;
  };

  boarding_houses: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };

  monthly_reports: {
    month: string;
    users: number;
    boarding_houses: number;
  }[];

  year: number;
}

interface ReportsResponse {
  success: boolean;
  data: ReportsData;
  message?: string;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports implements OnInit {

  private cdr = inject(ChangeDetectorRef);

  private readonly apiUrl = 'http://127.0.0.1:8000/api/admin/reports';

  reports: ReportsData | null = null;

  loading = false;
  errorMessage = '';

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.loadReports();
  }

  loadReports(): void {

    this.loading = true;
    this.errorMessage = '';

    const token = sessionStorage.getItem('admin_token');

    if (!token) {
      this.loading = false;
      this.errorMessage = 'Admin session not found. Please log in again.';
      this.cdr.detectChanges();
      return;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    });

    this.http.get<ReportsResponse>(this.apiUrl, { headers })
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();

          console.log('Reports loading completed.');
        })
      )
      .subscribe({

        next: (response) => {

          console.log('Reports response:', response);

          if (
            response.success &&
            response.data &&
            response.data.users &&
            response.data.boarding_houses
          ) {
            this.reports = response.data;
            this.errorMessage = '';
          } else {
            this.errorMessage = 'The reports response was not valid.';
          }

          this.cdr.detectChanges();
        },

        error: (error: HttpErrorResponse) => {

          console.error('Reports error:', error);

          this.errorMessage =
            error.error?.message ||
            'Unable to load reports. Please try again.';

          this.cdr.detectChanges();
        }

      });
  }

  getBarHeight(value: number): number {

    if (!this.reports?.monthly_reports?.length) {
      return 0;
    }

    const maximum = Math.max(
      ...this.reports.monthly_reports.map(item =>
        Math.max(item.users, item.boarding_houses)
      ),
      1
    );

    return (value / maximum) * 100;
  }
}
