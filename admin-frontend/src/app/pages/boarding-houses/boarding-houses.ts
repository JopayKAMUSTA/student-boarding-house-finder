
import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  HttpClient,
  HttpHeaders,
  HttpParams
} from '@angular/common/http';

import { finalize } from 'rxjs/operators';
import { AuthService } from '../../services/auth';

interface BoardingHouse {
  id: number;
  owner_id: number;
  name: string;
  description: string;
  city: string;
  barangay: string;
  address: string;
  monthly_rent: string | number;
  security_deposit: string | number;
  advance_payment: string | number;
  available_rooms: number;
  total_rooms: number;
  room_type: string;
  amenities: string[];
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  owner?: {
    id: number;
    name: string;
    email: string;
  };
  rooms?: any[];
}

type ListingStatus = 'pending' | 'approved' | 'rejected';

@Component({
  selector: 'app-boarding-houses',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './boarding-houses.html',
  styleUrl: './boarding-houses.css',
})
export class BoardingHouses implements OnInit {

  private apiUrl = 'http://127.0.0.1:8000/api/admin/boarding-houses';

  boardingHouses: BoardingHouse[] = [];

  activeStatus: ListingStatus = 'pending';

  loading = false;
  loadingDetails = false;

  actionLoadingId: number | null = null;

  selectedHouse: BoardingHouse | null = null;

  successMessage = '';
  errorMessage = '';

  totalItems = 0;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadBoardingHouses();
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Accept: 'application/json',
      Authorization: `Bearer ${this.authService.getToken()}`
    });
  }

  loadBoardingHouses(): void {
    this.loading = true;
    this.errorMessage = '';

    this.cdr.detectChanges();

    const params = new HttpParams()
      .set('status', this.activeStatus);

    this.http.get<any>(this.apiUrl, {
      headers: this.getHeaders(),
      params
    })
    .pipe(
      finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      })
    )
    .subscribe({
      next: (response) => {
        this.boardingHouses = response.data?.data ?? [];

        this.totalItems =
          response.data?.total ?? this.boardingHouses.length;

        this.cdr.detectChanges();
      },
      error: (error) => {
        this.boardingHouses = [];
        this.totalItems = 0;

        this.errorMessage =
          error.error?.message ||
          'Unable to load boarding houses. Please check your API connection.';

        this.cdr.detectChanges();
      }
    });
  }

  changeStatus(status: ListingStatus): void {
    this.activeStatus = status;
    this.selectedHouse = null;
    this.successMessage = '';
    this.errorMessage = '';

    this.loadBoardingHouses();
  }

  viewDetails(id: number): void {
    this.loadingDetails = true;
    this.selectedHouse = null;
    this.errorMessage = '';

    this.cdr.detectChanges();

    this.http.get<any>(`${this.apiUrl}/${id}`, {
      headers: this.getHeaders()
    })
    .pipe(
      finalize(() => {
        this.loadingDetails = false;
        this.cdr.detectChanges();
      })
    )
    .subscribe({
      next: (response) => {
        this.selectedHouse = response.data;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.errorMessage =
          error.error?.message || 'Unable to load boarding-house details.';

        this.cdr.detectChanges();
      }
    });
  }

  closeDetails(): void {
    this.selectedHouse = null;
  }

  approveHouse(house: BoardingHouse): void {
    const confirmed = window.confirm(
      `Are you sure you want to approve "${house.name}"?`
    );

    if (confirmed) {
      this.updateStatus(house, 'approved');
    }
  }

  rejectHouse(house: BoardingHouse): void {
    const confirmed = window.confirm(
      `Are you sure you want to reject "${house.name}"?`
    );

    if (confirmed) {
      this.updateStatus(house, 'rejected');
    }
  }

  private updateStatus(
    house: BoardingHouse,
    status: 'approved' | 'rejected'
  ): void {
    this.actionLoadingId = house.id;
    this.successMessage = '';
    this.errorMessage = '';

    this.cdr.detectChanges();

    this.http.patch<any>(
      `${this.apiUrl}/${house.id}/status`,
      { status },
      {
        headers: this.getHeaders()
      }
    )
    .pipe(
      finalize(() => {
        this.actionLoadingId = null;
        this.cdr.detectChanges();
      })
    )
    .subscribe({
      next: (response) => {
        this.successMessage =
          response.message ||
          `Boarding house ${status} successfully.`;

        this.selectedHouse = null;
        this.loadBoardingHouses();

        this.cdr.detectChanges();
      },
      error: (error) => {
        this.errorMessage =
          error.error?.message ||
          `Unable to ${status} this boarding house.`;

        this.cdr.detectChanges();
      }
    });
  }

  getStatusLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }
}
