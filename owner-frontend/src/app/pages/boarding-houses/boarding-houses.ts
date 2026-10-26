import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { OwnerAuth, BoardingHouseRoomInfo } from '../../services/owner-auth';

@Component({
  imports: [CommonModule, RouterLink],
  selector: 'app-boarding-houses',
  styleUrl: './boarding-houses.css',
  templateUrl: './boarding-houses.html',
})
export class BoardingHouses implements OnInit {
  private ownerAuth = inject(OwnerAuth);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  boardingHouses: BoardingHouseRoomInfo[] = [];
  currentPage = 1;
  lastPage = 1;
  total = 0;
  isLoading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.loadBoardingHouses();
  }

  loadBoardingHouses(page = this.currentPage): void {
    const token = this.ownerAuth.getToken();
    if (!token) {
      void this.router.navigate(['/login'], {
        queryParams: { notice: 'session-expired' }
      });
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    console.log('BEFORE API REQUEST:', this.isLoading);
    this.ownerAuth.getOwnerBoardingHouses(token, page).subscribe({
next: (response) => {
  console.log('API SUCCESS:', response);

  this.isLoading = false;

  const result = response?.data;

  if (
    !response?.success ||
    !result ||
    !Array.isArray(result.data) ||
    !Number.isInteger(result.total) ||
    !Number.isInteger(result.current_page) ||
    !Number.isInteger(result.last_page)
  ) {
    this.errorMessage = 'The boarding-house list response was not valid.';
    this.cdr.detectChanges();
    return;
  }

  this.boardingHouses = result.data;
  this.currentPage = result.current_page;
  this.lastPage = result.last_page;
  this.total = result.total;

  console.log('BOARDING HOUSES:', this.boardingHouses);
  console.log('FINAL LOADING STATE:', this.isLoading);
  console.log('TOTAL:', this.total);

  this.cdr.detectChanges();
},
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        this.cdr.detectChanges();
        if (error.status === 401 || error.status === 403) {
          this.ownerAuth.clearSession();
          void this.router.navigate(['/login'], {
            queryParams: {
              notice: error.status === 403 ? 'owner-required' : 'session-expired'
            }
          });
          return;
        }

        this.errorMessage = typeof error.error?.message === 'string'
          ? error.error.message
          : error.status === 0
            ? 'Could not connect to the API. Check that Laravel is running and CORS is configured.'
            : 'Could not load your boarding houses. Please try again.';
      }
    });
  }

  previousPage(): void {
    if (!this.isLoading && this.currentPage > 1) {
      this.loadBoardingHouses(this.currentPage - 1);
    }
  }

  nextPage(): void {
    if (!this.isLoading && this.currentPage < this.lastPage) {
      this.loadBoardingHouses(this.currentPage + 1);
    }
  }
}
