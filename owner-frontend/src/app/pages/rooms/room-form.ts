import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ManagedRoomInfo,
  OwnerAuth,
  RoomAvailabilityStatus,
  RoomImageInfo,
  RoomPricingBasis,
  RoomType
} from '../../services/owner-auth';

interface ImagePreview {
  file: File;
  url: string;
}

@Component({
  selector: 'app-room-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './room-form.html',
  styleUrl: './room-form.css'
})
export class RoomForm implements OnInit, OnDestroy {
  private readonly ownerAuth = inject(OwnerAuth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  readonly roomTypes: RoomType[] = [
    'Single Room',
    'Double-Sharing Room',
    'Shared Room'
  ];
  readonly pricingBases: { value: RoomPricingBasis; label: string }[] = [
    { value: 'per_person', label: 'Per person' },
    { value: 'entire_room', label: 'Entire room' }
  ];
  readonly availabilityStatuses: { value: RoomAvailabilityStatus; label: string }[] = [
    { value: 'available', label: 'Available' },
    { value: 'occupied', label: 'Occupied' },
    { value: 'reserved', label: 'Reserved' },
    { value: 'under_maintenance', label: 'Under Maintenance' }
  ];
  readonly amenityOptions = [
    'Bed',
    'Mattress',
    'Study table',
    'Electric fan',
    'Air conditioning',
    'Cabinet',
    'Private bathroom'
  ];

  boardingHouseId = 0;
  roomId: number | null = null;
  isLoading = false;
  isSubmitting = false;
  deletingImageId: number | null = null;
  errorMessage = '';
  amenities = new Set<string>();
  otherAmenities: string[] = [];
  newAmenity = '';
  selectedImages: ImagePreview[] = [];
  savedImages: RoomImageInfo[] = [];
  savedImageUrls: Record<number, string> = {};
  formModel = this.createEmptyForm();

  ngOnInit(): void {
    this.boardingHouseId = Number(this.route.snapshot.paramMap.get('boardingHouseId'));
    const roomParam = this.route.snapshot.paramMap.get('roomId');
    this.roomId = roomParam === null ? null : Number(roomParam);

    if (!Number.isInteger(this.boardingHouseId) || this.boardingHouseId < 1 ||
        (this.roomId !== null && (!Number.isInteger(this.roomId) || this.roomId < 1))) {
      this.errorMessage = 'The boarding house or room ID is invalid.';
      return;
    }

    if (this.roomId !== null) {
      this.loadRoom();
    }
  }

  ngOnDestroy(): void {
    this.clearSelectedImages();
    Object.values(this.savedImageUrls).forEach((url) => URL.revokeObjectURL(url));
  }

  toggleAmenity(amenity: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.amenities.add(amenity);
    } else {
      this.amenities.delete(amenity);
    }
  }

  isAmenitySelected(amenity: string): boolean {
    return this.amenities.has(amenity);
  }

  addOtherAmenity(): void {
    const amenity = this.newAmenity.trim();
    if (amenity && !this.otherAmenities.includes(amenity)) {
      this.otherAmenities.push(amenity);
    }
    this.newAmenity = '';
  }

  removeOtherAmenity(index: number): void {
    this.otherAmenities.splice(index, 1);
  }

  selectImages(event: Event): void {
    this.errorMessage = '';
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const validFiles = files.every((file) =>
      acceptedTypes.includes(file.type) && file.size <= 5 * 1024 * 1024
    );

    if (!validFiles) {
      this.errorMessage = 'Choose JPEG, PNG, or WebP images no larger than 5 MB each.';
      input.value = '';
      return;
    }
    if (files.length + this.selectedImages.length > 10) {
      this.errorMessage = 'You can upload up to 10 room photos at a time.';
      input.value = '';
      return;
    }

    for (const file of files) {
      this.selectedImages.push({
        file,
        url: URL.createObjectURL(file)
      });
    }
    input.value = '';
  }

  removeSelectedImage(index: number): void {
    const [preview] = this.selectedImages.splice(index, 1);
    if (preview) {
      URL.revokeObjectURL(preview.url);
    }
  }

  removeSavedImage(image: RoomImageInfo): void {
    if (!window.confirm('Remove this room photo?')) {
      return;
    }
    const token = this.ownerAuth.getToken();
    if (!token || this.roomId === null) {
      void this.router.navigate(['/login'], {
        queryParams: { notice: 'session-expired' }
      });
      return;
    }

    this.deletingImageId = image.id;
    this.ownerAuth.deleteOwnerRoomImage(
      token,
      this.boardingHouseId,
      this.roomId,
      image.id
    ).subscribe({
      next: (response) => {
        this.deletingImageId = null;
        if (!response.success) {
          this.errorMessage = response.message || 'The photo could not be removed.';
          return;
        }
        this.savedImages = this.savedImages.filter((saved) => saved.id !== image.id);
        this.revokeSavedImageUrl(image.id);
      },
      error: (error: HttpErrorResponse) => {
        this.deletingImageId = null;
        this.handleApiError(error);
      }
    });
  }

  submit(form: NgForm): void {
    this.errorMessage = '';
    if (form.invalid) {
      form.control.markAllAsTouched();
      this.errorMessage = 'Complete all required fields with valid values.';
      return;
    }

    const monthlyRent = this.formModel.monthly_rent;
    if (monthlyRent === null ||
        !Number.isFinite(monthlyRent) ||
        monthlyRent <= 0 ||
        !Number.isInteger(this.formModel.max_occupants) ||
        this.formModel.max_occupants < 1) {
      this.errorMessage = 'Rent must be positive and maximum occupants a positive whole number.';
      return;
    }

    const token = this.ownerAuth.getToken();
    if (!token) {
      void this.router.navigate(['/login'], {
        queryParams: { notice: 'session-expired' }
      });
      return;
    }

    const payload = this.toFormData();
    this.isSubmitting = true;
    const request = this.roomId === null
      ? this.ownerAuth.createOwnerRoom(token, this.boardingHouseId, payload)
      : this.ownerAuth.updateOwnerRoom(token, this.boardingHouseId, this.roomId, payload);

    request.subscribe({
      next: (response) => {
        this.isSubmitting = false;
        if (!response.success) {
          this.errorMessage = response.message || 'The room could not be saved.';
          return;
        }
        void this.router.navigate([
          '/owner/boarding-houses',
          this.boardingHouseId,
          'rooms'
        ]);
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting = false;
        this.handleApiError(error);
      }
    });
  }

private loadRoom(): void {
  const token = this.ownerAuth.getToken();

  if (!token || this.roomId === null) {
    void this.router.navigate(['/login'], {
      queryParams: { notice: 'session-expired' }
    });
    return;
  }

  this.isLoading = true;
  this.errorMessage = '';

  this.ownerAuth.getOwnerRoom(
    token,
    this.boardingHouseId,
    this.roomId
  ).subscribe({
    next: (response) => {
      if (!response.success || !response.data) {
        this.errorMessage =
          response.message || 'The room could not be loaded.';
      } else {
        this.setRoom(response.data);
      }

      this.isLoading = false;
      this.cdr.detectChanges();
    },
    error: (error: HttpErrorResponse) => {
      this.isLoading = false;
      this.handleApiError(error);
      this.cdr.detectChanges();
    }
  });
}

  private setRoom(room: ManagedRoomInfo): void {
    this.formModel = {
      room_number: room.room_number,
      room_type: room.room_type,
      monthly_rent: Number(room.monthly_rent),
      pricing_basis: room.pricing_basis,
      max_occupants: room.max_occupants,
      availability_status: room.availability_status,
      description: room.description ?? ''
    };
    this.savedImages = room.images ?? [];
    this.loadSavedImages(this.savedImages);
    this.amenities = new Set(
      (room.amenities ?? []).filter((amenity) => this.amenityOptions.includes(amenity))
    );
    this.otherAmenities = (room.amenities ?? [])
      .filter((amenity) => !this.amenityOptions.includes(amenity))
      .slice();
  }

  private toFormData(): FormData {
    const data = new FormData();
    data.append('room_number', this.formModel.room_number.trim());
    data.append('room_type', this.formModel.room_type);
    data.append('monthly_rent', String(this.formModel.monthly_rent));
    data.append('pricing_basis', this.formModel.pricing_basis);
    data.append('max_occupants', String(this.formModel.max_occupants));
    data.append('availability_status', this.formModel.availability_status);
    if (this.formModel.description.trim()) {
      data.append('description', this.formModel.description.trim());
    }

    const amenities = [
      ...this.amenities,
      ...this.otherAmenities
    ];
    amenities.forEach((amenity, index) => data.append(`amenities[${index}]`, amenity));
    this.selectedImages.forEach(({ file }) => data.append('images[]', file));
    if (this.roomId !== null) {
      data.append('_method', 'PUT');
    }
    return data;
  }

  private createEmptyForm() {
    return {
      room_number: '',
      room_type: '' as RoomType | '',
      monthly_rent: null as number | null,
      pricing_basis: 'per_person' as RoomPricingBasis,
      max_occupants: 1,
      availability_status: 'available' as RoomAvailabilityStatus,
      description: ''
    };
  }

  private clearSelectedImages(): void {
    this.selectedImages.forEach(({ url }) => URL.revokeObjectURL(url));
    this.selectedImages = [];
  }

  private loadSavedImages(images: RoomImageInfo[]): void {
    const token = this.ownerAuth.getToken();
    const roomId = this.roomId;
    if (!token || roomId === null) {
      return;
    }
    images.forEach((image) => {
      this.ownerAuth.getOwnerRoomImage(
        token,
        this.boardingHouseId,
        roomId,
        image.id
      ).subscribe({
        next: (blob) => {
          this.savedImageUrls[image.id] = URL.createObjectURL(blob);
        },
        error: (error: HttpErrorResponse) => this.handleApiError(error)
      });
    });
  }

  private revokeSavedImageUrl(imageId: number): void {
    const url = this.savedImageUrls[imageId];
    if (url) {
      URL.revokeObjectURL(url);
      delete this.savedImageUrls[imageId];
    }
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
      this.errorMessage = 'You are not authorized to manage rooms for this boarding house.';
      return;
    }

    const validationErrors = error.error?.errors;
    if (validationErrors && typeof validationErrors === 'object') {
      const messages = Object.values(validationErrors as Record<string, unknown>)
        .flatMap((messages) => Array.isArray(messages) ? messages : [])
        .filter((message): message is string => typeof message === 'string');
      if (messages.length > 0) {
        this.errorMessage = messages.join(' ');
        return;
      }
    }

    this.errorMessage = typeof error.error?.message === 'string'
      ? error.error.message
      : error.status === 0
        ? 'Could not connect to the API. Check that Laravel is running and CORS is configured.'
        : 'Could not complete the room request. Please try again.';
  }
}
