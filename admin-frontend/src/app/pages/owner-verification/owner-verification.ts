import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { finalize } from 'rxjs';
import { ManagedOwner, UserService } from '../../services/user';

@Component({
  selector: 'app-owner-verification',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './owner-verification.html',
  styleUrl: './owner-verification.css'
})
export class OwnerVerification implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  owners: ManagedOwner[] = [];
  currentPage = 1;
  lastPage = 1;
  totalOwners = 0;
  loading = false;
  updatingOwnerId: number | null = null;
  errorMessage = '';
  successMessage = '';
  selectedOwner: ManagedOwner | null = null;

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.loadOwners();
  }

  loadOwners(page = 1): void {
    this.loading = true;
    this.errorMessage = '';

    this.userService.getOwners(page)
.pipe(finalize(() => {
  this.loading = false;
  this.cdr.detectChanges();
}))
      .subscribe({
        next: (response) => {
          if (
            !response.success ||
            !response.data ||
            !Array.isArray(response.data.data)
          ) {
            this.errorMessage = 'The owner list response was not valid.';
            return;
          }

          this.owners = response.data.data;
          this.currentPage = response.data.current_page;
          this.lastPage = response.data.last_page;
          this.totalOwners = response.data.total;
        },
        error: (error) => {
          this.errorMessage = error.error?.message ||
            'Unable to load owners. Please check your connection and try again.';
        }
      });
  }

  updateVerification(
    owner: ManagedOwner,
    verificationStatus: 'approved' | 'rejected'
  ): void {
    if (!owner.owner_profile || this.updatingOwnerId !== null) {
      return;
    }

    this.updatingOwnerId = owner.id;
    this.errorMessage = '';
    this.successMessage = '';

    this.userService.updateOwnerVerification(owner.id, verificationStatus)
.pipe(finalize(() => {
  this.updatingOwnerId = null;
  this.cdr.detectChanges();
}))
      .subscribe({
        next: (response) => {
          if (!response.success || !response.data.owner_profile) {
            this.errorMessage = 'The owner verification update was not completed.';
            return;
          }

          this.owners = this.owners.map((currentOwner) =>
            currentOwner.id === owner.id ? response.data : currentOwner
          );
          if (this.selectedOwner?.id === owner.id) {
            this.selectedOwner = response.data;
          }
          this.successMessage = response.message;
        },
        error: (error) => {
          this.errorMessage = error.error?.message ||
            'Unable to update owner verification. Please try again.';
        }
      });
  }

  ownerName(owner: ManagedOwner): string {
    return owner.name ||
      [owner.first_name, owner.middle_name, owner.last_name]
        .filter((part): part is string => !!part)
        .join(' ');
  }

  changePage(page: number): void {
    if (!this.loading && page >= 1 && page <= this.lastPage) {
      this.loadOwners(page);
    }
  }
}
