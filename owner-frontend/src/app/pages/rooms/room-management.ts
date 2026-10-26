import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  BoardingHouseLocation,
  ManagedRoomInfo,
  OwnerAuth
} from '../../services/owner-auth';

@Component({
  selector: 'app-room-management',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './room-management.html',
  styleUrl: './room-management.css'
})
export class RoomManagement implements OnInit, OnDestroy {
  private readonly ownerAuth = inject(OwnerAuth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);

  boardingHouseId = 0;
  boardingHouse: BoardingHouseLocation | null = null;
  rooms: ManagedRoomInfo[] = [];
  currentPage = 1;
  lastPage = 1;
  total = 0;
  isLoading = false;
  deletingRoomId: number | null = null;
  errorMessage = '';
  photoError = '';
  imageUrls: Record<number, string> = {};

  ngOnDestroy(): void {
    this.clearImageUrls();
  }

  ngOnInit(): void {
    this.boardingHouseId = Number(this.route.snapshot.paramMap.get('boardingHouseId'));
    if (!Number.isInteger(this.boardingHouseId) || this.boardingHouseId < 1) {
      this.errorMessage = 'The boarding house ID is invalid.';
      return;
    }
    this.loadRooms();
  }

  loadRooms(page = this.currentPage): void {
    const token = this.ownerAuth.getToken();
    if (!token) {
      void this.router.navigate(['/login'], {
        queryParams: { notice: 'session-expired' }
      });
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.photoError = '';
    this.clearImageUrls();
this.ownerAuth.getOwnerRooms(
  token,
  this.boardingHouseId,
  page
).subscribe({
  next: (response) => {
    this.isLoading = false;

    const result = response?.data;

    if (
      !response?.success ||
      !response.boarding_house ||
      !result ||
      !Array.isArray(result.data) ||
      !Number.isInteger(result.total) ||
      !Number.isInteger(result.current_page) ||
      !Number.isInteger(result.last_page)
    ) {
      this.errorMessage = 'The room list response was not valid.';
      this.cdr.detectChanges();
      return;
    }

    this.boardingHouse = response.boarding_house;
    this.rooms = result.data;
    this.currentPage = result.current_page;
    this.lastPage = result.last_page;
    this.total = result.total;

    this.loadRoomImages(result.data);

    this.cdr.detectChanges();
  },

  error: (error: HttpErrorResponse) => {
    this.isLoading = false;
    this.handleApiError(error);
    this.cdr.detectChanges();
  }
});
  }

  deleteRoom(room: ManagedRoomInfo): void {
    if (!window.confirm(`Delete room "${room.room_number}" and its photos?`)) {
      return;
    }

    const token = this.ownerAuth.getToken();
    if (!token) {
      void this.router.navigate(['/login'], {
        queryParams: { notice: 'session-expired' }
      });
      return;
    }

    this.deletingRoomId = room.id;
    this.errorMessage = '';
    this.ownerAuth.deleteOwnerRoom(token, this.boardingHouseId, room.id).subscribe({
      next: (response) => {
        this.deletingRoomId = null;
        if (!response.success) {
          this.errorMessage = response.message || 'The room could not be deleted.';
          return;
        }

        this.rooms = this.rooms.filter((item) => item.id !== room.id);
        room.images.forEach((image) => this.revokeImageUrl(image.id));
        this.total = Math.max(0, this.total - 1);
        if (this.rooms.length === 0 && this.currentPage > 1) {
          this.loadRooms(this.currentPage - 1);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.deletingRoomId = null;
        this.handleApiError(error);
      }
    });
  }

  previousPage(): void {
    if (!this.isLoading && this.currentPage > 1) {
      this.loadRooms(this.currentPage - 1);
    }
  }

  nextPage(): void {
    if (!this.isLoading && this.currentPage < this.lastPage) {
      this.loadRooms(this.currentPage + 1);
    }
  }

  formatPricingBasis(basis: string): string {
    return basis === 'per_person' ? 'per person' : 'entire room';
  }

  formatAvailability(status: string): string {
    return status.replaceAll('_', ' ');
  }

  private handleApiError(error: HttpErrorResponse): void {
    if (error.status === 401 || error.status === 403) {
      if (error.status === 401) {
        this.ownerAuth.clearSession();
        void this.router.navigate(['/login'], {
          queryParams: { notice: 'session-expired' }
        });
      } else {
        this.errorMessage = 'You are not authorized to manage rooms for this boarding house.';
      }
      return;
    }

    this.errorMessage = typeof error.error?.message === 'string'
      ? error.error.message
      : error.status === 0
        ? 'Could not connect to the API. Check that Laravel is running and CORS is configured.'
        : 'Could not complete the room request. Please try again.';
  }

  private loadRoomImages(rooms: ManagedRoomInfo[]): void {
    const token = this.ownerAuth.getToken();
    if (!token) {
      return;
    }

    rooms.forEach((room) => room.images.forEach((image) => {
      this.ownerAuth.getOwnerRoomImage(
        token,
        this.boardingHouseId,
        room.id,
        image.id
      ).subscribe({
        next: (blob) => {
          this.imageUrls[image.id] = URL.createObjectURL(blob);
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 401 || error.status === 403) {
            this.handleApiError(error);
          } else {
            this.photoError = 'One or more room photos could not be loaded.';
          }
        }
      });
    }));
  }

  private clearImageUrls(): void {
    Object.values(this.imageUrls).forEach((url) => URL.revokeObjectURL(url));
    this.imageUrls = {};
  }

  private revokeImageUrl(imageId: number): void {
    const url = this.imageUrls[imageId];
    if (url) {
      URL.revokeObjectURL(url);
      delete this.imageUrls[imageId];
    }
  }
}
