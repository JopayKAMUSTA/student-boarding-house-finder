
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, map, Observable, of, switchMap, throwError } from 'rxjs';

import {
  BoardingHouseRoomInfo,
  ManagedRoomInfo,
  OwnerAuth,
  OwnerStudentOption,
  OwnerTenantAssignmentData,
  OwnerTenantContactData,
  OwnerTenantData,
  OwnerTenantInfo,
  OwnerTenantPageResponse,
  OwnerRoomListResponse
} from '../../services/owner-auth';

type AssignmentMode = 'assign' | 'transfer';

@Component({
  selector: 'app-tenant-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tenant-management.html',
  styleUrl: './tenant-management.css'
})
export class TenantManagement implements OnInit {
  private readonly ownerAuth = inject(OwnerAuth);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  tenants: OwnerTenantInfo[] = [];
  currentPage = 1;
  lastPage = 1;
  total = 0;
  searchText = '';
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  // Registered student accounts with server-side search and pagination
  students: OwnerStudentOption[] = [];
  isLoadingStudents = false;
  studentSearch = '';
  studentCurrentPage = 1;
  studentLastPage = 1;
  studentTotal = 0;
  private studentSearchTimeout: ReturnType<typeof setTimeout> | null = null;

  get selectedStudent(): OwnerStudentOption | undefined {
    return this.students.find(
      student => student.id === Number(this.tenantForm.user_id)
    );
  }

  // Add tenant
  isAddFormOpen = false;
  isCreatingTenant = false;
  tenantForm: OwnerTenantData = this.emptyTenantForm();

  // Tenant details
  isDetailsOpen = false;
  isLoadingDetails = false;
  isSavingContact = false;
  detailsError = '';
  selectedTenant: OwnerTenantInfo | null = null;
  contactForm: OwnerTenantContactData = this.emptyContactForm();

  // Room assignment
  assignmentMode: AssignmentMode | null = null;
  boardingHouses: BoardingHouseRoomInfo[] = [];
  rooms: ManagedRoomInfo[] = [];
  selectedBoardingHouseId: number | null = null;
  selectedRoomId: number | null = null;
  moveInDate = this.today();
  isLoadingBoardingHouses = false;
  isLoadingRooms = false;
  isSavingAssignment = false;
  isMovingOut = false;
  assignmentError = '';

  ngOnInit(): void {
    this.loadTenants();
  }

  // Load tenant records
  loadTenants(page = this.currentPage): void {
    const token = this.getTokenOrRedirect();
    if (!token) return;

    this.isLoading = true;
    this.errorMessage = '';

    this.ownerAuth.getOwnerTenants(token, page, this.searchText).subscribe({
      next: (response) => {
        this.isLoading = false;

        if (!this.isTenantPageResponse(response)) {
          this.errorMessage = 'The tenant list response was not valid.';
          this.cdr.detectChanges();
          return;
        }

        this.tenants = response.data.data;
        this.currentPage = response.data.current_page;
        this.lastPage = response.data.last_page;
        this.total = response.data.total;

        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        this.handleApiError(error, 'Could not load tenants.');
        this.cdr.detectChanges();
      }
    });
  }

  searchTenants(): void {
    this.successMessage = '';
    this.loadTenants(1);
  }

  previousPage(): void {
    if (!this.isLoading && this.currentPage > 1) {
      this.loadTenants(this.currentPage - 1);
    }
  }

  nextPage(): void {
    if (!this.isLoading && this.currentPage < this.lastPage) {
      this.loadTenants(this.currentPage + 1);
    }
  }

  // Open add form
  openAddForm(): void {
    this.tenantForm = this.emptyTenantForm();
    this.students = [];
    this.studentSearch = '';
    this.studentCurrentPage = 1;
    this.studentLastPage = 1;
    this.studentTotal = 0;

    this.isAddFormOpen = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.loadStudents('', 1);
  }

  // Load one page of available registered students
  loadStudents(search = this.studentSearch, page = 1): void {
    const token = this.getTokenOrRedirect();
    if (!token) return;

    this.isLoadingStudents = true;
    this.errorMessage = '';

    this.ownerAuth.getOwnerStudents(token, search, page, 15).subscribe({
      next: (response) => {
        this.isLoadingStudents = false;

        if (
          !response.success ||
          !response.data ||
          !Array.isArray(response.data.data)
        ) {
          this.students = [];
          this.studentTotal = 0;
          this.studentCurrentPage = 1;
          this.studentLastPage = 1;
          this.errorMessage = 'The student list response was not valid.';
          this.cdr.detectChanges();
          return;
        }

        this.students = response.data.data;
        this.studentCurrentPage = response.data.current_page;
        this.studentLastPage = response.data.last_page;
        this.studentTotal = response.data.total;

        if (this.students.length === 0) {
          this.errorMessage = search.trim()
            ? 'No students matched your search.'
            : 'No available active student accounts were found.';
        }

        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.isLoadingStudents = false;
        this.students = [];
        this.handleApiError(error, 'Could not load student accounts.');
        this.cdr.detectChanges();
      }
    });
  }

  // Search students with a short delay
  searchStudents(search: string): void {
    this.studentSearch = search;

    if (this.studentSearchTimeout) {
      clearTimeout(this.studentSearchTimeout);
    }

    this.studentSearchTimeout = setTimeout(() => {
      this.tenantForm.user_id = null;
      this.loadStudents(this.studentSearch, 1);
    }, 300);
  }

  // Select a student account
  selectStudent(student: OwnerStudentOption): void {
    this.tenantForm.user_id = student.id;
    this.errorMessage = '';
  }

  previousStudentPage(): void {
    if (
      !this.isLoadingStudents &&
      this.studentCurrentPage > 1
    ) {
      this.loadStudents(
        this.studentSearch,
        this.studentCurrentPage - 1
      );
    }
  }

  nextStudentPage(): void {
    if (
      !this.isLoadingStudents &&
      this.studentCurrentPage < this.studentLastPage
    ) {
      this.loadStudents(
        this.studentSearch,
        this.studentCurrentPage + 1
      );
    }
  }

  closeAddForm(): void {
    if (!this.isCreatingTenant) {
      this.isAddFormOpen = false;

      if (this.studentSearchTimeout) {
        clearTimeout(this.studentSearchTimeout);
        this.studentSearchTimeout = null;
      }
    }
  }

  // Create tenant linked to an existing student account
  createTenant(form: NgForm): void {
    if (
      form.invalid ||
      !this.tenantForm.user_id ||
      this.isCreatingTenant
    ) {
      form.control.markAllAsTouched();
      return;
    }

    const token = this.getTokenOrRedirect();
    if (!token) return;

    const payload: OwnerTenantData = {
      user_id: Number(this.tenantForm.user_id),
      contact_number: this.tenantForm.contact_number,
      emergency_contact_name:
        this.tenantForm.emergency_contact_name || null,
      emergency_contact_number:
        this.tenantForm.emergency_contact_number || null
    };

    this.isCreatingTenant = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.ownerAuth.createOwnerTenant(token, payload).subscribe({
      next: (response) => {
        this.isCreatingTenant = false;

        if (!response.success) {
          this.errorMessage =
            response.message || 'The tenant could not be added.';
          this.cdr.detectChanges();
          return;
        }

        this.isAddFormOpen = false;
        this.tenantForm = this.emptyTenantForm();
        this.successMessage =
          response.message || 'Tenant registered successfully.';

        this.loadTenants(1);
      },
      error: (error: HttpErrorResponse) => {
        this.isCreatingTenant = false;
        this.handleApiError(error, 'The tenant could not be added.');
        this.cdr.detectChanges();
      }
    });
  }

  // Open tenant details
  openDetails(tenant: OwnerTenantInfo): void {
    const token = this.getTokenOrRedirect();
    if (!token) return;

    this.isDetailsOpen = true;
    this.isLoadingDetails = true;
    this.selectedTenant = null;
    this.detailsError = '';
    this.assignmentMode = null;

    this.ownerAuth.getOwnerTenant(token, tenant.id).subscribe({
      next: (response) => {
        this.isLoadingDetails = false;

        if (!response.success || !response.data) {
          this.detailsError =
            response.message || 'Tenant details could not be loaded.';
          this.cdr.detectChanges();
          return;
        }

        this.selectedTenant = response.data;

        this.contactForm = {
          contact_number: response.data.contact_number,
          emergency_contact_name:
            response.data.emergency_contact_name ?? '',
          emergency_contact_number:
            response.data.emergency_contact_number ?? ''
        };

        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.isLoadingDetails = false;
        this.detailsError = this.getApiErrorMessage(
          error,
          'Could not load tenant details.'
        );
        this.handleUnauthorized(error);
        this.cdr.detectChanges();
      }
    });
  }

  closeDetails(): void {
    if (
      this.isSavingContact ||
      this.isSavingAssignment ||
      this.isMovingOut
    ) {
      return;
    }

    this.isDetailsOpen = false;
    this.selectedTenant = null;
    this.assignmentMode = null;
  }

  // Update tenant contact information
  updateContact(form: NgForm): void {
    if (
      form.invalid ||
      !this.selectedTenant ||
      this.isSavingContact
    ) {
      form.control.markAllAsTouched();
      return;
    }

    const token = this.getTokenOrRedirect();
    if (!token) return;

    this.isSavingContact = true;
    this.detailsError = '';
    this.successMessage = '';

    this.ownerAuth.updateOwnerTenant(
      token,
      this.selectedTenant.id,
      this.contactForm
    ).subscribe({
      next: (response) => {
        this.isSavingContact = false;

        if (!response.success) {
          this.detailsError =
            response.message ||
            'Contact information could not be updated.';
          this.cdr.detectChanges();
          return;
        }

        this.selectedTenant = {
          ...this.selectedTenant!,
          ...response.data
        };

        this.loadTenants();
        this.successMessage =
          response.message || 'Contact information updated.';

        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.isSavingContact = false;
        this.detailsError = this.getApiErrorMessage(
          error,
          'Contact information could not be updated.'
        );
        this.handleUnauthorized(error);
        this.cdr.detectChanges();
      }
    });
  }

  // Assign or transfer tenant to a room
  openAssignment(mode: AssignmentMode): void {
    if (!this.selectedTenant || this.isSavingAssignment) return;

    this.assignmentMode = mode;
    this.assignmentError = '';
    this.rooms = [];
    this.selectedRoomId = null;
    this.selectedBoardingHouseId = null;
    this.moveInDate = this.today();

    const token = this.getTokenOrRedirect();
    if (!token) return;

    if (mode === 'assign') {
      this.isLoadingBoardingHouses = true;

      this.loadAllBoardingHouses(token).subscribe({
        next: (houses) => {
          this.isLoadingBoardingHouses = false;

          this.boardingHouses = houses.filter(
            house =>
              house.status === 'approved' &&
              Number.isInteger(house.id)
          );

          if (this.boardingHouses.length === 0) {
            this.assignmentError =
              'No approved boarding houses are available for assignment.';
          }

          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.isLoadingBoardingHouses = false;
          this.handleAssignmentLoadError(
            error,
            'Could not load your boarding houses.'
          );
        }
      });

      return;
    }

    const room =
      this.selectedTenant.current_assignment?.boarding_house_room;

    const houseId =
      room?.boarding_house_id ?? room?.boarding_house?.id;

    if (!houseId) {
      this.assignmentError =
        'The current boarding house could not be identified.';
      return;
    }

    this.selectedBoardingHouseId = houseId;
    this.isLoadingRooms = true;
    this.loadAvailableRooms(token, houseId);
  }

  selectBoardingHouse(boardingHouseId: number | null): void {
    this.selectedBoardingHouseId = boardingHouseId;
    this.rooms = [];
    this.selectedRoomId = null;
    this.assignmentError = '';

    if (!this.selectedBoardingHouseId) return;

    const token = this.getTokenOrRedirect();
    if (!token) return;

    this.isLoadingRooms = true;

    this.loadAvailableRooms(
      token,
      this.selectedBoardingHouseId
    );
  }

  submitAssignment(form: NgForm): void {
    if (
      form.invalid ||
      !this.selectedTenant ||
      this.selectedRoomId === null ||
      this.isSavingAssignment
    ) {
      form.control.markAllAsTouched();
      return;
    }

    const token = this.getTokenOrRedirect();
    if (!token) return;

    const payload: OwnerTenantAssignmentData = {
      boarding_house_room_id: this.selectedRoomId,
      move_in_date: this.moveInDate
    };

    this.isSavingAssignment = true;
    this.assignmentError = '';
    this.successMessage = '';

    const request = this.assignmentMode === 'transfer'
      ? this.ownerAuth.transferOwnerTenant(
          token,
          this.selectedTenant.id,
          payload
        )
      : this.ownerAuth.assignOwnerTenant(
          token,
          this.selectedTenant.id,
          payload
        );

    request.subscribe({
      next: (response) => {
        this.isSavingAssignment = false;

        if (!response.success) {
          this.assignmentError =
            response.message ||
            'The room assignment could not be saved.';
          this.cdr.detectChanges();
          return;
        }

        this.assignmentMode = null;
        this.refreshSelectedTenant();

        this.successMessage =
          response.message || 'Room assignment saved successfully.';
      },
      error: (error: HttpErrorResponse) => {
        this.isSavingAssignment = false;
        this.assignmentError = this.getApiErrorMessage(
          error,
          'The room assignment could not be saved.'
        );
        this.handleUnauthorized(error);
        this.cdr.detectChanges();
      }
    });
  }

  // Move tenant out of current room
  moveOut(): void {
    if (!this.selectedTenant || this.isMovingOut) return;

    if (
      !window.confirm(
        `Move ${this.selectedTenant.full_name} out of the current room?`
      )
    ) {
      return;
    }

    const token = this.getTokenOrRedirect();
    if (!token) return;

    this.isMovingOut = true;
    this.detailsError = '';
    this.successMessage = '';

    this.ownerAuth.moveOutOwnerTenant(
      token,
      this.selectedTenant.id
    ).subscribe({
      next: (response) => {
        this.isMovingOut = false;

        if (!response.success) {
          this.detailsError =
            response.message || 'The tenant could not be moved out.';
          this.cdr.detectChanges();
          return;
        }

        this.refreshSelectedTenant();

        this.successMessage =
          response.message || 'Tenant moved out successfully.';
      },
      error: (error: HttpErrorResponse) => {
        this.isMovingOut = false;
        this.detailsError = this.getApiErrorMessage(
          error,
          'The tenant could not be moved out.'
        );
        this.handleUnauthorized(error);
        this.cdr.detectChanges();
      }
    });
  }

  formatAssignmentStatus(tenant: OwnerTenantInfo): string {
    return tenant.current_assignment?.status ?? 'Unassigned';
  }

  isAssigned(): boolean {
    return this.selectedTenant?.current_assignment !== null &&
      this.selectedTenant?.current_assignment !== undefined;
  }

  trackTenant(_index: number, tenant: OwnerTenantInfo): number {
    return tenant.id;
  }

  // Load available rooms
  private loadAvailableRooms(
    token: string,
    boardingHouseId: number
  ): void {
    this.loadAllRooms(token, boardingHouseId).subscribe({
      next: (rooms) => {
        this.isLoadingRooms = false;

        const currentRoomId =
          this.assignmentMode === 'transfer'
            ? this.selectedTenant?.current_assignment
                ?.boarding_house_room?.id
            : null;

        this.rooms = rooms.filter(
          room =>
            room.availability_status === 'available' &&
            room.id !== currentRoomId
        );

        if (this.rooms.length === 0) {
          this.assignmentError =
            'No available rooms were found in this boarding house.';
        }

        this.cdr.detectChanges();
      },
      error: (error: unknown) => {
        this.isLoadingRooms = false;
        this.handleAssignmentLoadError(
          error,
          'Could not load available rooms.'
        );
      }
    });
  }

  // Load all boarding-house pages
  private loadAllBoardingHouses(
    token: string
  ): Observable<BoardingHouseRoomInfo[]> {
    return this.ownerAuth.getOwnerBoardingHouses(token, 1).pipe(
      switchMap((first) => {
        if (!this.isBoardingHousePage(first)) {
          return throwError(
            () => new Error(
              'The boarding-house list response was not valid.'
            )
          );
        }

        const requests = Array.from(
          { length: first.data.last_page - 1 },
          (_value, index) =>
            this.ownerAuth.getOwnerBoardingHouses(
              token,
              index + 2
            )
        );

        return requests.length
          ? forkJoin(requests).pipe(
              map(remaining => [first, ...remaining])
            )
          : of([first]);
      }),
      map((pages) => {
        if (pages.some(page => !this.isBoardingHousePage(page))) {
          throw new Error(
            'A boarding-house page response was not valid.'
          );
        }

        return pages.flatMap(page => page.data.data);
      })
    );
  }

  // Load all room pages
  private loadAllRooms(
    token: string,
    boardingHouseId: number
  ): Observable<ManagedRoomInfo[]> {
    return this.ownerAuth.getOwnerRooms(
      token,
      boardingHouseId,
      1
    ).pipe(
      switchMap((first) => {
        if (!this.isRoomPage(first)) {
          return throwError(
            () => new Error('The room list response was not valid.')
          );
        }

        const requests = Array.from(
          { length: first.data.last_page - 1 },
          (_value, index) =>
            this.ownerAuth.getOwnerRooms(
              token,
              boardingHouseId,
              index + 2
            )
        );

        return requests.length
          ? forkJoin(requests).pipe(
              map(remaining => [first, ...remaining])
            )
          : of([first]);
      }),
      map((pages) => {
        if (pages.some(page => !this.isRoomPage(page))) {
          throw new Error('A room page response was not valid.');
        }

        return pages.flatMap(page => page.data.data);
      })
    );
  }

  private refreshSelectedTenant(): void {
    const tenant = this.selectedTenant;

    if (tenant) {
      this.openDetails(tenant);
      this.loadTenants();
    }
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

  private handleAssignmentLoadError(
    error: unknown,
    fallback: string
  ): void {
    if (error instanceof HttpErrorResponse) {
      this.assignmentError = this.getApiErrorMessage(
        error,
        fallback
      );
      this.handleUnauthorized(error);
    } else {
      this.assignmentError =
        error instanceof Error ? error.message : fallback;
    }

    this.cdr.detectChanges();
  }

  private handleApiError(
    error: HttpErrorResponse,
    fallback: string
  ): void {
    this.errorMessage = this.getApiErrorMessage(error, fallback);
    this.handleUnauthorized(error);
  }

  private handleUnauthorized(error: HttpErrorResponse): void {
    if (error.status === 401) {
      this.ownerAuth.clearSession();

      void this.router.navigate(['/login'], {
        queryParams: { notice: 'session-expired' }
      });
    }
  }

  private getApiErrorMessage(
    error: HttpErrorResponse,
    fallback: string
  ): string {
    if (error.status === 401) {
      return 'Your session has expired. Please sign in again.';
    }

    if (error.status === 403) {
      return 'You are not authorized to manage this tenant or room.';
    }

    const validationErrors = error.error?.errors;

    if (
      validationErrors &&
      typeof validationErrors === 'object'
    ) {
      const firstError = Object.values(
        validationErrors as Record<string, unknown>
      )
        .flatMap(messages =>
          Array.isArray(messages) ? messages : []
        )
        .find(
          (message): message is string =>
            typeof message === 'string'
        );

      if (firstError) return firstError;
    }

    if (typeof error.error?.message === 'string') {
      return error.error.message;
    }

    return error.status === 0
      ? 'Could not connect to the API. Check that Laravel is running and CORS is configured.'
      : fallback;
  }

  private isTenantPageResponse(
    response: OwnerTenantPageResponse
  ): response is OwnerTenantPageResponse {
    return response?.success === true &&
      Array.isArray(response.data?.data) &&
      Number.isInteger(response.data.total) &&
      Number.isInteger(response.data.current_page) &&
      Number.isInteger(response.data.last_page);
  }

  private isBoardingHousePage(response: {
    success: boolean;
    data: {
      data: BoardingHouseRoomInfo[];
      last_page: number;
    } | undefined;
  }): response is {
    success: true;
    data: {
      data: BoardingHouseRoomInfo[];
      last_page: number;
    };
  } {
    return response?.success === true &&
      Array.isArray(response.data?.data) &&
      Number.isInteger(response.data.last_page) &&
      response.data.last_page >= 1;
  }

  private isRoomPage(
    response: OwnerRoomListResponse
  ): response is OwnerRoomListResponse {
    return response?.success === true &&
      Array.isArray(response.data?.data) &&
      Number.isInteger(response.data.last_page) &&
      response.data.last_page >= 1;
  }

  private emptyTenantForm(): OwnerTenantData {
    return {
      user_id: null,
      contact_number: '',
      emergency_contact_name: '',
      emergency_contact_number: ''
    };
  }

  private emptyContactForm(): OwnerTenantContactData {
    return {
      contact_number: '',
      emergency_contact_name: '',
      emergency_contact_number: ''
    };
  }

  private today(): string {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${date.getFullYear()}-${month}-${day}`;
  }
}
