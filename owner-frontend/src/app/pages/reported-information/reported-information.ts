import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, map, Observable, of, switchMap, throwError } from 'rxjs';
import {
  OwnerAuth,
  OwnerTenantInfo,
  OwnerTenantPageResponse
} from '../../services/owner-auth';

@Component({
  selector: 'app-reported-information',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reported-information.html',
  styleUrl: './reported-information.css'
})
export class ReportedInformation implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly ownerAuth = inject(OwnerAuth);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly apiUrl = 'http://127.0.0.1:8000/api';

  selectedTargetId: number | null = null;
  tenants: OwnerTenantInfo[] = [];

  categories = [
    'Unpaid Rent or Payment Issue',
    'Leaving Without Notice',
    'Property Damage',
    'Misconduct or Rule Violation',
    'Other'
  ];

  category = '';
  title = '';
  description = '';
  evidenceFiles: File[] = [];

  isLoading = false;
  isSubmitting = false;
  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    this.loadReportTargets();
  }

  loadReportTargets(): void {
    const token = this.getTokenOrRedirect();
    if (!token) return;

    this.isLoading = true;
    this.errorMessage = '';

    this.loadAllTenants(token).subscribe({
      next: (tenants) => {
        this.tenants = tenants.filter(
          (tenant) => Number.isInteger(tenant.id) && !!tenant.full_name
        );

        this.selectFirstTarget();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error: unknown) => {
        this.isLoading = false;

        if (error instanceof HttpErrorResponse) {
          this.handleApiError(error, 'Could not load your tenants.');
        } else {
          this.errorMessage = error instanceof Error
            ? error.message
            : 'Could not load your tenants.';
        }

        this.cdr.detectChanges();
      }
    });
  }

  private loadAllTenants(token: string): Observable<OwnerTenantInfo[]> {
    return this.ownerAuth.getOwnerTenants(token, 1, '').pipe(
      switchMap((first) => {
        if (!this.isTenantPage(first)) {
          return throwError(
            () => new Error('The tenant list response was not valid.')
          );
        }

        const requests = Array.from(
          { length: first.data.last_page - 1 },
          (_value, index) =>
            this.ownerAuth.getOwnerTenants(token, index + 2, '')
        );

        return requests.length
          ? forkJoin(requests).pipe(
              map((remaining) => [first, ...remaining])
            )
          : of([first]);
      }),
      map((pages) => {
        if (pages.some((page) => !this.isTenantPage(page))) {
          throw new Error('A tenant list page was not valid.');
        }

        return pages.flatMap((page) => page.data.data);
      })
    );
  }

  private isTenantPage(
    response: OwnerTenantPageResponse
  ): response is OwnerTenantPageResponse {
    return response?.success === true &&
      Array.isArray(response.data?.data) &&
      Number.isInteger(response.data.last_page) &&
      response.data.last_page >= 1;
  }

  private selectFirstTarget(): void {
    this.selectedTargetId = this.tenants.length
      ? this.tenants[0].id ?? null
      : null;
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);

    this.errorMessage = '';

    if (files.length > 5) {
      this.errorMessage = 'You can upload a maximum of 5 evidence files.';
      input.value = '';
      return;
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'application/pdf'
    ];

    const invalidFile = files.find(
      (file) =>
        !allowedTypes.includes(file.type) ||
        file.size > 5 * 1024 * 1024
    );

    if (invalidFile) {
      this.errorMessage =
        'Only JPG, PNG, and PDF files up to 5 MB each are allowed.';
      input.value = '';
      return;
    }

    this.evidenceFiles = files;
    this.cdr.detectChanges();
  }

  removeEvidence(index: number): void {
    this.evidenceFiles.splice(index, 1);
    this.cdr.detectChanges();
  }

  submitReport(form: NgForm): void {
    if (
      form.invalid ||
      this.selectedTargetId === null ||
      this.isSubmitting
    ) {
      form.control.markAllAsTouched();
      return;
    }

    const token = this.getTokenOrRedirect();
    if (!token) return;

    const formData = new FormData();

    formData.append('target_type', 'tenant');
    formData.append('target_id', String(this.selectedTargetId));
    formData.append('category', this.category);
    formData.append('title', this.title.trim());
    formData.append('description', this.description.trim());

    this.evidenceFiles.forEach((file) => {
      formData.append('evidence[]', file);
    });

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    });

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.http.post<{ success: boolean; message?: string }>(
      `${this.apiUrl}/owner/reported-information`,
      formData,
      { headers }
    ).subscribe({
      next: (response) => {
        this.isSubmitting = false;

        if (!response.success) {
          this.errorMessage =
            response.message || 'The report could not be submitted.';
          this.cdr.detectChanges();
          return;
        }

        this.successMessage =
          response.message || 'Report submitted successfully.';

        this.resetForm(form);
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting = false;
        this.handleApiError(
          error,
          'The report could not be submitted.'
        );
        this.cdr.detectChanges();
      }
    });
  }

  private resetForm(form: NgForm): void {
    this.category = '';
    this.title = '';
    this.description = '';
    this.evidenceFiles = [];

    form.resetForm();
    this.selectFirstTarget();
  }

  private getTokenOrRedirect(): string | null {
    const token = this.ownerAuth.getToken();

    if (!token) {
      void this.router.navigate(['/login'], {
        queryParams: { notice: 'session-expired' }
      });
    }

    return token;
  }

  private handleApiError(
    error: HttpErrorResponse,
    fallback: string
  ): void {
    if (error.status === 401) {
      this.ownerAuth.clearSession();
      this.errorMessage =
        'Your session has expired. Please sign in again.';

      void this.router.navigate(['/login'], {
        queryParams: { notice: 'session-expired' }
      });

      return;
    }

    if (error.error?.errors) {
      const firstError = Object.values(
        error.error.errors as Record<string, unknown>
      )
        .flatMap((messages) =>
          Array.isArray(messages) ? messages : []
        )
        .find(
          (message): message is string =>
            typeof message === 'string'
        );

      if (firstError) {
        this.errorMessage = firstError;
        return;
      }
    }

    this.errorMessage =
      error.error?.message ||
      (error.status === 0
        ? 'Could not connect to the API. Check that Laravel is running.'
        : fallback);
  }
}
