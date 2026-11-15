import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  HttpClient,
  HttpHeaders,
  HttpParams
} from '@angular/common/http';

import { finalize } from 'rxjs/operators';
import { AuthService } from '../../services/auth';

interface OwnerProfile {
  contact_number?: string;
  business_name?: string;
  business_address?: string;
  verification_status?: string;
  verified_at?: string | null;
  valid_id_front?: string | null;
  valid_id_back?: string | null;
  rejection_reason?: string | null;
}

interface BoardingHouse {
  id: number;
  owner_id?: number;
  name: string;
  description?: string;
  city: string;
  barangay: string;
  address?: string;
  monthly_rent?: number | string;
  security_deposit?: number | string;
  advance_payment?: number | string;
  available_rooms?: number;
  total_rooms?: number;
  room_type?: string;
  amenities?: string[];
  status: string;
  images?: string[];
  rooms?: BoardingHouseRoom[];
}

interface BoardingHouseRoom {
  id: number;
  room_number?: string;
  room_type?: string;
  monthly_rent?: number | string;
  pricing_basis?: string;
  max_occupants?: number;
  status?: string;
  amenities?: string[];
  images?: string[];
}

interface Owner {
  id: number;
  name?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  owner_profile?: OwnerProfile;
  boarding_houses_count?: number;
  boarding_houses?: BoardingHouse[];
}

@Component({
  selector: 'app-owner-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './owner-management.html',
  styleUrl: './owner-management.css'
})
export class OwnerManagement implements OnInit {

  private apiUrl = 'http://127.0.0.1:8000/api/admin/owners';

  private boardingHouseApiUrl =
    'http://127.0.0.1:8000/api/admin/boarding-houses';

  owners: Owner[] = [];

  selectedOwner: Owner | null = null;
  selectedBoardingHouse: BoardingHouse | null = null;

  showOwnerModal = false;

  frontIdUrl: string | null = null;
  backIdUrl: string | null = null;
  frontIdError = '';
  backIdError = '';
  frontIdLoading = false;
  backIdLoading = false;
  identityDocumentsLoading = false;

  loading = false;
  loadingDetails = false;
  loadingBoardingHouse = false;

  totalOwners = 0;
  currentPage = 1;
  lastPage = 1;

  search = '';
  selectedStatus = '';
  selectedVerification = '';

  updatingOwnerId: number | null = null;

  successMessage = '';
  errorMessage = '';
  boardingHouseError = '';

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Automatically load owners when this page opens.
    this.loadOwners();
  }

  // AUTHENTICATION HEADERS
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.getToken() ?? ''}`,
      Accept: 'application/json'
    });
  }

  // OWNER FULL NAME
  ownerName(owner: Owner): string {
    const fullName = [
      owner.first_name,
      owner.middle_name,
      owner.last_name
    ].filter(Boolean).join(' ');

    return owner.name || fullName || 'Unnamed Owner';
  }

  verificationStatusClass(status?: string | null): string {
    const normalized = (status ?? '').toLowerCase();

    if (normalized === 'approved') {
      return 'approved';
    }

    if (normalized === 'rejected') {
      return 'rejected';
    }

    if (normalized === 'pending') {
      return 'pending';
    }

    return 'missing';
  }

  verificationStatusLabel(status?: string | null): string {
    const normalized = (status ?? '').toLowerCase();

    if (normalized === 'approved') {
      return 'Approved';
    }

    if (normalized === 'rejected') {
      return 'Rejected';
    }

    if (normalized === 'pending') {
      return 'Pending';
    }

    return 'Not Submitted';
  }

  // LOAD OWNER LIST
  loadOwners(): void {
    if (this.loading) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.cdr.detectChanges();

    let params = new HttpParams()
      .set('page', this.currentPage.toString());

    if (this.search.trim()) {
      params = params.set('search', this.search.trim());
    }

    if (this.selectedStatus) {
      params = params.set('status', this.selectedStatus);
    }

    if (this.selectedVerification) {
      params = params.set(
        'verification_status',
        this.selectedVerification
      );
    }

    this.http.get<any>(this.apiUrl, {
      headers: this.getHeaders(),
      params
    }).pipe(
      finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({

      next: (response) => {
        console.log('Owners API response:', response);

        const pagination = response?.data?.data
          ? response.data
          : response;

        this.owners = Array.isArray(pagination?.data)
          ? pagination.data
          : [];

        this.totalOwners =
          pagination?.total ?? this.owners.length;

        this.currentPage =
          pagination?.current_page ?? this.currentPage;

        this.lastPage =
          pagination?.last_page ?? 1;

        console.log('Loaded owners:', this.owners);

        // Explicitly update the displayed owner list.
        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error('Error loading owners:', error);

        this.owners = [];
        this.totalOwners = 0;

        this.errorMessage =
          error.error?.message ||
          'Failed to load owner accounts.';

        this.cdr.detectChanges();
      }

    });
  }

  // SEARCH OWNERS
  onSearchChange(): void {
    this.currentPage = 1;
    this.loadOwners();
  }

  // APPLY FILTERS
  applyFilters(): void {
    this.currentPage = 1;
    this.loadOwners();
  }

  // CHANGE PAGE
  changePage(page: number): void {
    if (page < 1 || page > this.lastPage) {
      return;
    }

    this.currentPage = page;
    this.loadOwners();
  }

  // OPEN OWNER DETAILS MODAL
  viewOwner(ownerId: number): void {
    console.log('Opening owner modal:', ownerId);

    this.showOwnerModal = true;
    this.selectedOwner = null;
    this.loadingDetails = true;
    this.errorMessage = '';
    this.revokeIdentityDocumentUrls();
    this.frontIdError = '';
    this.backIdError = '';

    this.cdr.detectChanges();

    this.http.get<any>(`${this.apiUrl}/${ownerId}`, {
      headers: this.getHeaders()
    }).pipe(
      finalize(() => {
        this.loadingDetails = false;
        this.cdr.detectChanges();
      })
    ).subscribe({

      next: (response) => {
        console.log('Owner response:', response);

        const owner: Owner | null =
          response?.data?.data ??
          response?.data?.owner ??
          response?.data ??
          response?.owner ??
          null;

        if (owner?.id) {
          this.selectedOwner = owner;
          this.loadIdentityDocuments(owner.id);

          console.log('Owner details loaded:', this.selectedOwner);
        } else {
          console.error('Invalid owner response:', response);
        }

        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error('Error loading owner details:', error);

        this.errorMessage =
          error.error?.message ||
          'Failed to load owner details.';

        this.cdr.detectChanges();
      }

    });
  }

  private revokeIdentityDocumentUrls(): void {
    if (this.frontIdUrl) {
      URL.revokeObjectURL(this.frontIdUrl);
      this.frontIdUrl = null;
    }

    if (this.backIdUrl) {
      URL.revokeObjectURL(this.backIdUrl);
      this.backIdUrl = null;
    }
  }

  private loadIdentityDocuments(ownerId: number): void {
    this.revokeIdentityDocumentUrls();
    this.frontIdLoading = true;
    this.backIdLoading = true;
    this.identityDocumentsLoading = true;
    this.frontIdError = '';
    this.backIdError = '';
    this.cdr.detectChanges();

    this.loadIdentityDocument(ownerId, 'front');
    this.loadIdentityDocument(ownerId, 'back');
  }

  private loadIdentityDocument(
    ownerId: number,
    side: 'front' | 'back'
  ): void {
    const sideLabel = side === 'front' ? 'front' : 'back';

    this.http.get(
      `${this.apiUrl}/${ownerId}/identity-documents/${side}`,
      {
        headers: this.getHeaders(),
        responseType: 'blob'
      }
    ).pipe(
      finalize(() => {
        if (side === 'front') {
          this.frontIdLoading = false;
        } else {
          this.backIdLoading = false;
        }

        if (!this.frontIdLoading && !this.backIdLoading) {
          this.identityDocumentsLoading = false;
        }

        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (blob: Blob) => {
        if (!blob || blob.size === 0) {
          this.setDocumentError(side, `${sideLabel} ID is empty.`);
          return;
        }

        const objectUrl = URL.createObjectURL(blob);

        if (side === 'front') {
          this.frontIdUrl = objectUrl;
        } else {
          this.backIdUrl = objectUrl;
        }

        this.cdr.detectChanges();
      },
      error: (error) => {
        if (error?.status === 404) {
          this.setDocumentError(
            side,
            `${side === 'front' ? 'Front' : 'Back'} valid ID not uploaded.`
          );
          return;
        }

        this.setDocumentError(
          side,
          `Could not load the ${side === 'front' ? 'front' : 'back'} valid ID.`
        );
      }
    });
  }

  private setDocumentError(side: 'front' | 'back', message: string): void {
    if (side === 'front') {
      this.frontIdError = message;
      this.frontIdUrl = null;
    } else {
      this.backIdError = message;
      this.backIdUrl = null;
    }

    this.cdr.detectChanges();
  }

  // CLOSE OWNER DETAILS MODAL
  closeOwnerModal(): void {
    this.showOwnerModal = false;
    this.selectedOwner = null;
    this.loadingDetails = false;
    this.revokeIdentityDocumentUrls();
    this.frontIdError = '';
    this.backIdError = '';
    this.frontIdLoading = false;
    this.backIdLoading = false;
    this.identityDocumentsLoading = false;

    this.cdr.detectChanges();
  }

  // OPEN BOARDING-HOUSE DETAILS
  viewBoardingHouse(house: BoardingHouse): void {
    this.selectedBoardingHouse = house;
    this.loadingBoardingHouse = true;
    this.boardingHouseError = '';

    this.cdr.detectChanges();

    this.http.get<any>(
      `${this.boardingHouseApiUrl}/${house.id}`,
      {
        headers: this.getHeaders()
      }
    ).pipe(
      finalize(() => {
        this.loadingBoardingHouse = false;
        this.cdr.detectChanges();
      })
    ).subscribe({

      next: (response) => {
        this.selectedBoardingHouse =
          response?.data?.boarding_house ??
          response?.data ??
          response?.boarding_house ??
          response?.house ??
          house;

        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error(
          'Error loading boarding-house details:',
          error
        );

        this.boardingHouseError =
          error.error?.message ||
          'Could not load complete boarding-house details.';

        this.selectedBoardingHouse = house;

        this.cdr.detectChanges();
      }

    });
  }

  // CLOSE BOARDING-HOUSE MODAL
  closeBoardingHouseDetails(): void {
    this.selectedBoardingHouse = null;
    this.boardingHouseError = '';

    this.cdr.detectChanges();
  }

  // APPROVE OR REJECT OWNER VERIFICATION
  updateVerification(
    owner: Owner,
    verificationStatus: 'approved' | 'rejected'
  ): void {
    if (!owner.owner_profile || this.updatingOwnerId !== null) {
      return;
    }

    const action = verificationStatus === 'approved'
      ? 'approve'
      : 'reject';

    if (!confirm(
      `Are you sure you want to ${action} this owner's verification?`
    )) {
      return;
    }

    this.updatingOwnerId = owner.id;
    this.successMessage = '';
    this.errorMessage = '';

    this.cdr.detectChanges();

    this.http.patch<any>(
      `${this.apiUrl}/${owner.id}/verification`,
      {
        verification_status: verificationStatus
      },
      {
        headers: this.getHeaders()
      }
    ).pipe(
      finalize(() => {
        this.updatingOwnerId = null;
        this.cdr.detectChanges();
      })
    ).subscribe({

      next: (response) => {
        this.updateOwnerLocally(owner.id, {
          verification_status: verificationStatus,
          verified_at: verificationStatus === 'approved'
            ? new Date().toISOString()
            : null
        });

        this.successMessage =
          response.message ||
          `Owner verification ${verificationStatus} successfully.`;

        this.loadOwners();

        if (
          this.showOwnerModal &&
          this.selectedOwner?.id === owner.id
        ) {
          this.viewOwner(owner.id);
        }

        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error('Error updating verification:', error);

        this.errorMessage =
          error.error?.message ||
          'Failed to update owner verification.';

        this.cdr.detectChanges();
      }

    });
  }

  // ACTIVATE OR SUSPEND OWNER ACCOUNT
  updateStatus(
    owner: Owner,
    status: 'active' | 'suspended'
  ): void {
    if (this.updatingOwnerId !== null) {
      return;
    }

    const action = status === 'active'
      ? 'activate'
      : 'suspend';

    if (!confirm(
      `Are you sure you want to ${action} this owner account?`
    )) {
      return;
    }

    this.updatingOwnerId = owner.id;
    this.successMessage = '';
    this.errorMessage = '';

    this.cdr.detectChanges();

    this.http.patch<any>(
      `${this.apiUrl}/${owner.id}/status`,
      { status },
      { headers: this.getHeaders() }
    ).pipe(
      finalize(() => {
        this.updatingOwnerId = null;
        this.cdr.detectChanges();
      })
    ).subscribe({

      next: (response) => {
        this.updateOwnerLocally(owner.id, { status });

        this.successMessage =
          response.message ||
          `Owner account ${status} successfully.`;

        this.loadOwners();

        if (
          this.showOwnerModal &&
          this.selectedOwner?.id === owner.id
        ) {
          this.viewOwner(owner.id);
        }

        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error('Error updating owner status:', error);

        this.errorMessage =
          error.error?.message ||
          'Failed to update owner account status.';

        this.cdr.detectChanges();
      }

    });
  }

  // UPDATE OWNER DATA LOCALLY
  private updateOwnerLocally(
    ownerId: number,
    changes: Partial<Owner> | OwnerProfile
  ): void {
    this.owners = this.owners.map(owner => {
      if (owner.id !== ownerId) {
        return owner;
      }

      const updatedOwner = { ...owner };

      if ('verification_status' in changes) {
        updatedOwner.owner_profile = {
          ...updatedOwner.owner_profile,
          ...changes
        };
      } else {
        Object.assign(updatedOwner, changes);
      }

      return updatedOwner;
    });

    if (this.selectedOwner?.id === ownerId) {
      const updatedOwner = this.owners.find(
        owner => owner.id === ownerId
      );

      if (updatedOwner) {
        this.selectedOwner = { ...updatedOwner };
      }
    }

    this.cdr.detectChanges();
  }
}
