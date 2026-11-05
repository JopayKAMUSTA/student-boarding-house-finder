import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import {
  AdminBoardingHouse,
  AdminBoardingHousePageResponse,
  BoardingHouseStatus,
  UserService
} from '../../services/user';

@Component({
  selector: 'app-boarding-houses',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './boarding-houses.html',
  styleUrl: './boarding-houses.css'
})
export class BoardingHouses implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef)
  readonly statuses: { value: BoardingHouseStatus | ''; label: string }[] = [
    { value: '', label: 'All statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' }
  ];

  boardingHouses: AdminBoardingHouse[] = [];
  selectedBoardingHouse: AdminBoardingHouse | null = null;
  statusFilter: BoardingHouseStatus | '' = '';
  currentPage = 1;
  lastPage = 1;
  total = 0;
  boardingHouseId: number | null = null;
  detailMode = false;
  isLoading = false;
  isDetailLoading = false;
  actionLoadingId: number | null = null;
  errorMessage = '';
  successMessage = '';
  imageUrls = new Map<number, string>();
  imageLoading = new Set<number>();
  imageErrors = new Map<number, string>();

  private readonly subscriptions = new Subscription();
  private readonly imageSubscriptions = new Map<number, Subscription>();
  private listRequest: Subscription | null = null;
  private detailRequest: Subscription | null = null;

  constructor(
    private readonly userService: UserService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.route.paramMap.subscribe((params) => this.handleRoute(params))
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.clearImagePreviews();
  }

  handleRoute(params: ParamMap): void {
    const id = params.get('boardingHouseId');
    this.detailMode = id !== null;
    this.errorMessage = '';
    this.successMessage = '';

    if (id === null) {
      this.detailRequest?.unsubscribe();
      this.clearImagePreviews();
      this.boardingHouseId = null;
      this.selectedBoardingHouse = null;
      this.loadBoardingHouses();
      return;
    }

    this.listRequest?.unsubscribe();
    const boardingHouseId = Number(id);
    if (!Number.isInteger(boardingHouseId) || boardingHouseId < 1) {
      this.detailRequest?.unsubscribe();
      this.clearImagePreviews();
      this.boardingHouseId = null;
      this.selectedBoardingHouse = null;
      this.errorMessage = 'The boarding house ID is invalid.';
      return;
    }

    this.boardingHouseId = boardingHouseId;
    this.loadDetails(boardingHouseId);
  }

  retryDetails(): void {
    if (this.boardingHouseId !== null) {
      this.loadDetails(this.boardingHouseId);
    }
  }

  loadBoardingHouses(page = 1): void {
    this.listRequest?.unsubscribe();
    this.isLoading = true;
    this.errorMessage = '';

    this.listRequest = this.userService.getAdminBoardingHouses(this.statusFilter, page)
        .pipe(finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }))
        .subscribe({
          next: (response: AdminBoardingHousePageResponse) => {
            if (
              !response.success ||
              !response.data ||
              !Array.isArray(response.data.data)
            ) {
              this.errorMessage = 'The boarding-house list response was not valid.';
              return;
            }

            this.boardingHouses = response.data.data;
            this.currentPage = response.data.current_page;
            this.lastPage = response.data.last_page;
            this.total = response.data.total;
          },
          error: (error: HttpErrorResponse) => {
            this.errorMessage = this.getErrorMessage(
              error,
              'Unable to load boarding houses. Please try again.'
            );
          }
        });
    this.subscriptions.add(this.listRequest);
  }

  filterByStatus(status: BoardingHouseStatus | ''): void {
    this.statusFilter = status;
    this.loadBoardingHouses(1);
  }

  onStatusFilterChange(event: Event): void {
    const status = (event.target as HTMLSelectElement).value;
    if (status === '' || status === 'pending' || status === 'approved' || status === 'rejected') {
      this.filterByStatus(status);
    }
  }

  changePage(page: number): void {
    if (!this.isLoading && page >= 1 && page <= this.lastPage) {
      this.loadBoardingHouses(page);
    }
  }

  viewDetails(boardingHouse: AdminBoardingHouse): void {
    void this.router.navigate(['/boarding-houses', boardingHouse.id]);
  }

  backToList(): void {
    void this.router.navigate(['/boarding-houses']);
  }

  loadDetails(boardingHouseId: number): void {
    this.detailRequest?.unsubscribe();
    this.isDetailLoading = true;
    this.errorMessage = '';
    this.selectedBoardingHouse = null;
    this.clearImagePreviews();

    this.detailRequest = this.userService.getAdminBoardingHouse(boardingHouseId)
        .pipe(finalize(() => {
          this.isDetailLoading = false;
          this.cdr.detectChanges();

        }))
        .subscribe({
          next: (response) => {
            if (!response.success || !response.data) {
              this.errorMessage = 'The boarding-house details response was not valid.';
              return;
            }

            this.selectedBoardingHouse = response.data;
            for (const room of response.data.rooms ?? []) {
              for (const image of room.images ?? []) {
                this.loadImage(image.id, image.url);
              }
            }
          },
          error: (error: HttpErrorResponse) => {
            this.errorMessage = this.getErrorMessage(
              error,
              'Unable to load boarding-house details. Please try again.'
            );
          }
        });
    this.subscriptions.add(this.detailRequest);
  }

  decideStatus(
    boardingHouse: AdminBoardingHouse,
    status: 'approved' | 'rejected'
  ): void {
    if (boardingHouse.status !== 'pending' || this.actionLoadingId !== null) {
      return;
    }

    const action = status === 'approved' ? 'approve' : 'reject';
    if (!window.confirm(`Are you sure you want to ${action} this boarding house?`)) {
      return;
    }

    this.actionLoadingId = boardingHouse.id;
    this.errorMessage = '';
    this.successMessage = '';

    this.subscriptions.add(
      this.userService.updateAdminBoardingHouseStatus(boardingHouse.id, status)
        .pipe(finalize(() => {
          this.actionLoadingId = null;
          this.cdr.detectChanges();

        }))
        .subscribe({
          next: (response) => {
            if (!response.success) {
              this.errorMessage = 'The listing status was not updated.';
              return;
            }

            this.successMessage = response.message;
            this.loadBoardingHouses(this.currentPage);
            if (this.detailMode) {
              this.loadDetails(boardingHouse.id);
            }
          },
          error: (error: HttpErrorResponse) => {
            this.errorMessage = this.getErrorMessage(
              error,
              'Unable to update the listing status. Please try again.'
            );
          }
        })
    );
  }

  ownerName(boardingHouse: AdminBoardingHouse): string {
    const owner = boardingHouse.owner;
    return owner?.name ||
      [owner?.first_name, owner?.middle_name, owner?.last_name]
        .filter((part): part is string => !!part)
        .join(' ') ||
      'Unknown owner';
  }

  formatStatus(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  formatLabel(value: string): string {
    return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private loadImage(imageId: number, imageUrl: string): void {
    this.imageLoading.add(imageId);
    this.imageErrors.delete(imageId);

    const imageSubscription = new Subscription();
    this.imageSubscriptions.set(imageId, imageSubscription);
    imageSubscription.add(this.userService.getAdminBoardingHouseImage(imageUrl)
      .pipe(finalize(() => {
        this.imageLoading.delete(imageId);
        this.cdr.detectChanges();

        if (this.imageSubscriptions.get(imageId) === imageSubscription) {
          this.imageSubscriptions.delete(imageId);
        }
      }))
      .subscribe({
        next: (blob) => {
          this.revokeImageUrl(imageId);
          this.imageUrls.set(imageId, URL.createObjectURL(blob));
        },
        error: () => {
          this.imageErrors.set(imageId, 'Image could not be loaded.');
        }
      }));

    this.subscriptions.add(imageSubscription);
  }

  private clearImagePreviews(): void {
    for (const subscription of this.imageSubscriptions.values()) {
      subscription.unsubscribe();
    }
    this.imageSubscriptions.clear();
    this.imageLoading.clear();
    this.imageErrors.clear();

    for (const imageId of this.imageUrls.keys()) {
      this.revokeImageUrl(imageId);
    }
    this.imageUrls.clear();
  }

  private revokeImageUrl(imageId: number): void {
    const url = this.imageUrls.get(imageId);
    if (url) {
      URL.revokeObjectURL(url);
      this.imageUrls.delete(imageId);
    }
  }

  private getErrorMessage(error: HttpErrorResponse, fallback: string): string {
    if (typeof error.error?.message === 'string') {
      return error.error.message;
    }

    return error.status === 0
      ? 'Could not connect to the API. Check that Laravel is running and CORS is configured.'
      : fallback;
  }
}
