import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth';

interface ReportEvidence {
  id: number;
  original_name: string;
  file_type: string;
  created_at: string;
}

interface Report {
  id: number;
  title: string;
  description: string;
  reporter_name: string;
  reporter_role: string;
  target_type: string;
  target_id: number;
  target_name: string;
  category: string;
  status: string;
  admin_notes: string | null;
  evidence_count?: number;
  evidence?: ReportEvidence[];
  created_at: string;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports implements OnInit {
  private apiUrl = 'http://127.0.0.1:8000/api';

  loading = false;
  detailsLoading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';

  reports: Report[] = [];
  selectedReport: Report | null = null;

  searchTerm = '';
  selectedStatus = '';

  reviewStatus = '';
  adminNotes = '';

constructor(
  private http: HttpClient,
  private auth: AuthService,
  private cdr: ChangeDetectorRef
) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.auth.getToken() ?? ''}`,
      Accept: 'application/json',
    });
  }

  ngOnInit(): void {
    this.loadReports();
  }

loadReports(): void {
  this.loading = true;
  this.errorMessage = '';
  this.cdr.detectChanges();

  this.http.get<any>(
    `${this.apiUrl}/admin/reported-information`,
    { headers: this.getHeaders() }
  ).subscribe({
    next: (response) => {
      console.log('Reports response:', response);

      this.reports = response.data ?? [];
      this.loading = false;

      this.cdr.detectChanges();
    },
    error: (error) => {
      console.error('Reports API error:', error);

      this.errorMessage = error.error?.message ??
        'Failed to load reported information.';

      this.loading = false;
      this.cdr.detectChanges();
    },
  });
}

  get filteredReports(): Report[] {
    const search = this.searchTerm.trim().toLowerCase();

    return this.reports.filter(report => {
      const matchesSearch =
        !search ||
        report.title?.toLowerCase().includes(search) ||
        report.reporter_name?.toLowerCase().includes(search) ||
        report.category?.toLowerCase().includes(search) ||
        report.description?.toLowerCase().includes(search);

      const matchesStatus =
        !this.selectedStatus ||
        report.status === this.selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }

  get totalReports(): number {
    return this.reports.length;
  }

  get submittedReports(): number {
    return this.countByStatus('submitted');
  }

  get underReviewReports(): number {
    return this.countByStatus('under_review');
  }

  get resolvedReports(): number {
    return this.countByStatus('resolved');
  }

  get dismissedReports(): number {
    return this.countByStatus('dismissed');
  }

  private countByStatus(status: string): number {
    return this.reports.filter(report => report.status === status).length;
  }

viewReport(report: Report): void {
  this.detailsLoading = true;
  this.selectedReport = null;
  this.errorMessage = '';
  this.successMessage = '';

  this.cdr.detectChanges();

  this.http.get<any>(
    `${this.apiUrl}/admin/reported-information/${report.id}`,
    { headers: this.getHeaders() }
  ).subscribe({
    next: (response) => {
      console.log('Report details response:', response);

      this.selectedReport = response.data;
      this.reviewStatus = response.data.status;
      this.adminNotes = response.data.admin_notes ?? '';

      this.detailsLoading = false;
      this.cdr.detectChanges();
    },
    error: (error) => {
      console.error('Report details API error:', error);

      this.errorMessage = error.error?.message ??
        'Failed to load report details.';

      this.detailsLoading = false;
      this.cdr.detectChanges();
    },
  });
}

closeDetails(): void {
  this.selectedReport = null;
  this.detailsLoading = false;
  this.successMessage = '';
  this.errorMessage = '';
  this.cdr.detectChanges();
}

  updateReport(): void {
    if (!this.selectedReport || this.saving) {
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.http.patch<any>(
      `${this.apiUrl}/admin/reported-information/${this.selectedReport.id}`,
      {
        status: this.reviewStatus,
        admin_notes: this.adminNotes,
      },
      { headers: this.getHeaders() }
    ).subscribe({
      next: (response) => {
        this.successMessage = response.message ??
          'Report updated successfully.';

        this.selectedReport = {
          ...this.selectedReport!,
          status: response.data.status,
          admin_notes: response.data.admin_notes,
        };

        this.saving = false;
        this.loadReports();
      },
      error: (error) => {
        console.error(error);
        this.errorMessage = error.error?.message ??
          'Failed to update report.';
        this.saving = false;
      },
    });
  }
}
