import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ManagedRoomInfo,
  OwnerAuth,
  RoomImageInfo
} from '../../services/owner-auth';

@Component({
  selector: 'app-room-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './room-details.html',
  styleUrl: './room-details.css'
})
export class RoomDetails implements OnInit, OnDestroy {
  private readonly ownerAuth = inject(OwnerAuth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);

  boardingHouseId = 0;
  roomId = 0;
  room: ManagedRoomInfo | null = null;
  isLoading = false;
  errorMessage = '';
  photoError = '';
  imageUrls: Record<number, string> = {};

  ngOnInit(): void {
    this.boardingHouseId = Number(this.route.snapshot.paramMap.get('boardingHouseId'));
    this.roomId = Number(this.route.snapshot.paramMap.get('roomId'));
    if (!Number.isInteger(this.boardingHouseId) || this.boardingHouseId < 1 ||
        !Number.isInteger(this.roomId) || this.roomId < 1) {
      this.errorMessage = 'The boarding house or room ID is invalid.';
      return;
    }

    this.loadRoom();
  }

  ngOnDestroy(): void {
    this.clearImageUrls();
  }

  formatAvailability(status: string): string {
    return status.replaceAll('_', ' ');
  }

  formatPricingBasis(basis: string): string {
    return basis === 'per_person' ? 'Per person' : 'Entire room';
  }

  trackImage(_index: number, image: RoomImageInfo): number {
    return image.id;
  }

  loadRoom(): void {
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
    this.ownerAuth.getOwnerRoom(token, this.boardingHouseId, this.roomId).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (!response?.success || !response.data) {
          this.errorMessage = response?.message || 'The room could not be loaded.';
          this.cdr.detectChanges();
          return;
        }

        this.room = response.data;
        this.loadRoomImages(response.data.images ?? []);
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        this.handleApiError(error);
        this.cdr.detectChanges();
      }
    });
  }

  private loadRoomImages(images: RoomImageInfo[]): void {
    const token = this.ownerAuth.getToken();
    if (!token) {
      return;
    }

    images.forEach((image) => {
      this.ownerAuth.getOwnerRoomImage(
        token,
        this.boardingHouseId,
        this.roomId,
        image.id
      ).subscribe({
        next: (blob) => {
          this.imageUrls[image.id] = URL.createObjectURL(blob);
          this.cdr.detectChanges();
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 401 || error.status === 403) {
            this.handleApiError(error);
          } else {
            this.photoError = 'One or more room photos could not be loaded.';
          }
          this.cdr.detectChanges();
        }
      });
    });
  }

  private handleApiError(error: HttpErrorResponse): void {
    if (error.status === 401) {
      this.ownerAuth.clearSession();
      void this.router.navigate(['/login'], {
        queryParams: { notice: 'session-expired' }
      });
      return;
    }
    if (error.status === 403) {
      this.errorMessage = 'You are not authorized to view this room.';
      return;
    }

    this.errorMessage = typeof error.error?.message === 'string'
      ? error.error.message
      : error.status === 0
        ? 'Could not connect to the API. Check that Laravel is running and CORS is configured.'
        : 'Could not load the room details. Please try again.';
  }

  private clearImageUrls(): void {
    Object.values(this.imageUrls).forEach((url) => URL.revokeObjectURL(url));
    this.imageUrls = {};
  }
}
