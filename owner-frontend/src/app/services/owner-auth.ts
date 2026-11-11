
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface OwnerInfo {
  id?: number | string;
  name?: string;
  first_name?: string;
  middle_name?: string | null;
  last_name?: string;
  email?: string;
  role?: string;
  status?: string;
}

export type BillingPolicy = 'full_monthly' | 'prorated';

interface OwnerLoginResponse {
  data?: OwnerInfo & {
    token?: string;
  };
}

export interface BoardingHouseRoomInfo {
  id?: number;
  name?: string;
  description?: string | null;
  city?: string;
  barangay?: string | null;
  address?: string;
  monthly_rent?: string | number;
  security_deposit?: string | number;
  advance_payment?: string | number;
  late_payment_fee?: string | number;
  grace_period_days?: number;
  rules?: string | null;
  billing_policy?: BillingPolicy;
  total_rooms: number;
  available_rooms: number;
  room_type?: string | null;
  amenities?: string[] | null;
  status?: string;
  created_at?: string;
}

export interface OwnerBoardingHousePageResponse {
  success: boolean;
  data: {
    data: BoardingHouseRoomInfo[];
    total: number;
    current_page: number;
    last_page: number;
  };
}

export interface CreateBoardingHouseData {
  name: string;
  description?: string;
  city: string;
  barangay?: string;
  address: string;
  monthly_rent: number;
  billing_policy: BillingPolicy;
  security_deposit?: number;
  advance_payment?: number;
  late_payment_fee?: number;
  grace_period_days?: number;
  rules?: string | null;
  available_rooms: number;
  total_rooms: number;
  room_type?: string;
  amenities?: string[];
}

export type RoomType = 'Single Room' | 'Double-Sharing Room' | 'Shared Room';
export type RoomPricingBasis = 'per_person' | 'entire_room';
export type RoomAvailabilityStatus =
  | 'available'
  | 'occupied'
  | 'reserved'
  | 'under_maintenance';

export interface RoomImageInfo {
  id: number;
  image_path: string;
  url: string;
}

export interface ManagedRoomInfo {
  id: number;
  boarding_house_id: number;
  room_number: string;
  room_type: RoomType;
  monthly_rent: string | number;
  pricing_basis: RoomPricingBasis;
  max_occupants: number;
  availability_status: RoomAvailabilityStatus;
  description: string | null;
  amenities: string[] | null;
  images: RoomImageInfo[];
  current_occupant_count?: number;
  current_occupants?: RoomOccupantInfo[];
}

export interface RoomOccupantInfo {
  tenant_id: number;
  full_name: string;
  contact_number: string;
  emergency_contact_name: string | null;
  emergency_contact_number: string | null;
  move_in_date: string;
  monthly_rent: string | number;
  status: string;
}

export interface BoardingHouseLocation {
  id: number;
  name: string;
  address: string;
  barangay: string | null;
  city: string;
  billing_policy?: BillingPolicy;
}

export interface OwnerRoomListResponse {
  success: boolean;
  boarding_house: BoardingHouseLocation;
  data: {
    data: ManagedRoomInfo[];
    total: number;
    current_page: number;
    last_page: number;
  };
}

export interface OwnerRoomResponse {
  success: boolean;
  message?: string;
  data: ManagedRoomInfo;
}

export interface TenantAssignmentInfo {
  id: number;
  boarding_house_room_id: number;
  move_in_date: string;
  move_out_date: string | null;
  monthly_rent: string | number;
  status: string;
  boarding_house_room?: {
    id: number;
    boarding_house_id: number;
    room_number: string;
    boarding_house?: Partial<BoardingHouseLocation>;
  };
}

export interface OwnerTenantInfo {
  id: number;
  owner_id: number;
  user_id: number | null;
  full_name: string;
  contact_number: string;
  emergency_contact_name: string | null;
  emergency_contact_number: string | null;
  current_assignment?: TenantAssignmentInfo | null;
  assignments?: TenantAssignmentInfo[];
}

export interface OwnerTenantPageResponse {
  success: boolean;
  data: {
    data: OwnerTenantInfo[];
    total: number;
    current_page: number;
    last_page: number;
  };
}

export interface OwnerTenantResponse {
  success: boolean;
  message?: string;
  data: OwnerTenantInfo;
}

export interface OwnerTenantActionResponse {
  success: boolean;
  message?: string;
  data?: OwnerTenantInfo | TenantAssignmentInfo;
}

export interface OwnerTenantData {
  full_name: string;
  contact_number: string;
  emergency_contact_name: string | null;
  emergency_contact_number: string | null;
}

export interface OwnerTenantContactData {
  contact_number: string;
  emergency_contact_name: string | null;
  emergency_contact_number: string | null;
}

export interface OwnerTenantAssignmentData {
  boarding_house_room_id: number;
  move_in_date: string;
}

export interface RentalPaymentInfo {
  id: number;
  rental_bill_id: number;
  amount: string | number;
  payment_date: string;
  status?: 'pending' | 'approved' | 'rejected';
  submitted_amount?: string | number | null;
  submitted_payment_date?: string | null;
  proof_url?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: number | { id: number; name: string } | null;
  rejection_reason?: string | null;
  amount_adjustment_reason?: string | null;
  notes: string | null;
  recorded_by?: number | { id: number; name: string };
  voided_at: string | null;
  void_reason: string | null;
  voided_by: number | { id: number; name: string } | null;
  is_future_dated?: boolean;
  bill?: RentalBillInfo;
}

export interface RentalPaymentPageResponse {
  success: boolean;
  data: {
    data: RentalPaymentInfo[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface RentalBillGenerationStatusResponse {
  success: boolean;
  data: {
    month: string;
    period_start: string;
    period_end: string;
    eligible_assignments: number;
    generated_bills: number;
    missing_bills: number;
    status: 'complete' | 'pending_generation' | 'no_assignments';
    scheduled_time: string;
    timezone: string;
  };
}

export interface RentalBillInfo {
  id: number;
  room_assignment_id: number;
  amount: string | number;
  billing_policy: BillingPolicy | null;
  monthly_rent_snapshot: string | number | null;
  billable_days: number | null;
  days_in_month: number | null;
  rental_period_start: string;
  rental_period_end: string;
  due_date: string;
  amount_paid: string | number;
  balance: string | number;
  daily_late_fee_snapshot: string | number | null;
  grace_period_days_snapshot: number | null;
  original_amount: string | number;
  total_payments: string | number;
  remaining_balance: string | number;
  overdue_days: number;
  accumulated_late_fee: string | number;
  remaining_late_fee: string | number;
  total_outstanding: string | number;
  future_dated_payment_total: string | number;
  payment_status: string;
  is_voided: boolean;
  voided_at: string | null;
  void_reason: string | null;
  voided_by: { id: number; name: string } | null;
  room_assignment: TenantAssignmentInfo & {
    tenant: OwnerTenantInfo;
    boarding_house_room: {
      id: number;
      boarding_house_id: number;
      room_number: string;
      boarding_house: Partial<BoardingHouseLocation>;
    };
  };
  payments: RentalPaymentInfo[];
}

export interface RentalBillPageResponse {
  success: boolean;
  data: {
    data: RentalBillInfo[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface RentalBillResponse {
  success: boolean;
  message?: string;
  data: RentalBillInfo;
}

export interface RecordRentalPaymentResponse {
  success: boolean;
  message?: string;
  data: RentalBillInfo;
  payment: RentalPaymentInfo;
}

export interface VoidRentalPaymentResponse {
  success: boolean;
  message?: string;
  data: RentalPaymentInfo;
  bill: RentalBillInfo;
}

export interface ReviewRentalPaymentResponse {
  success: boolean;
  message?: string;
  data: RentalPaymentInfo;
  bill: RentalBillInfo;
}

export interface CreateRentalBillData {
  room_assignment_id: number;
  rental_period_start: string;
  rental_period_end: string;
  due_date: string;
}

export interface RecordRentalPaymentData {
  amount: number;
  payment_date: string;
  notes?: string;
}

interface OwnerRoomMutationResponse {
  success: boolean;
  message: string;
}

interface CreateBoardingHouseResponse {
  success: boolean;
  message: string;
  data: BoardingHouseRoomInfo;
}

export interface UpdateBoardingHouseBillingPolicyResponse {
  success: boolean;
  message?: string;
  data: BoardingHouseRoomInfo & { billing_policy: BillingPolicy };
}

export interface BoardingHouseSettingsData {
  late_payment_fee: number;
  grace_period_days: number;
  rules: string | null;
}

export interface UpdateBoardingHouseSettingsResponse {
  success: boolean;
  message?: string;
  data: BoardingHouseRoomInfo & {
    late_payment_fee: string | number;
    grace_period_days: number;
    rules: string | null;
  };
}

interface OwnerLogoutResponse {
  success: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class OwnerAuth {
  private http = inject(HttpClient);

  private readonly apiUrl = 'http://127.0.0.1:8000/api';
  private readonly tokenKey = 'owner_token';
  private readonly ownerKey = 'owner_user';

  registerOwner(data: {
    first_name: string;
    middle_name?: string;
    last_name: string;
    email: string;
    password: string;
    password_confirmation: string;
    contact_number?: string;
    business_name?: string;
    business_address?: string;
  }): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/owner/register`,
      data
    );
  }

  loginOwner(data: {
    email: string;
    password: string;
  }): Observable<OwnerLoginResponse> {
    return this.http.post<OwnerLoginResponse>(`${this.apiUrl}/login`, data);
  }

  setSession(token: string, owner?: OwnerInfo): void {
    localStorage.setItem(this.tokenKey, token);

    if (owner) {
      const { id, name, first_name, middle_name, last_name, email, role, status } = owner;
      localStorage.setItem(this.ownerKey, JSON.stringify({
        id,
        name,
        first_name,
        middle_name,
        last_name,
        email,
        role,
        status
      }));
    } else {
      localStorage.removeItem(this.ownerKey);
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getOwner(): OwnerInfo | null {
    const storedOwner = localStorage.getItem(this.ownerKey);
    if (!storedOwner) {
      return null;
    }

    try {
      const owner: unknown = JSON.parse(storedOwner);
      if (typeof owner !== 'object' || owner === null || Array.isArray(owner)) {
        localStorage.removeItem(this.ownerKey);
        return null;
      }

      const record = owner as Record<string, unknown>;
      const stringFields = ['name', 'first_name', 'last_name', 'email', 'role', 'status'];
      const hasInvalidString = stringFields.some((field) =>
        record[field] !== undefined && typeof record[field] !== 'string'
      );
      const hasInvalidId = record['id'] !== undefined &&
        typeof record['id'] !== 'string' &&
        typeof record['id'] !== 'number';
      const hasInvalidMiddleName = record['middle_name'] !== undefined &&
        record['middle_name'] !== null &&
        typeof record['middle_name'] !== 'string';
      if (hasInvalidString || hasInvalidId || hasInvalidMiddleName) {
        localStorage.removeItem(this.ownerKey);
        return null;
      }

      return owner as OwnerInfo;
    } catch {
      localStorage.removeItem(this.ownerKey);
      return null;
    }
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  clearSession(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.ownerKey);
  }

  getOwnerBoardingHouses(
    token: string,
    page = 1
  ): Observable<OwnerBoardingHousePageResponse> {
    return this.http.get<OwnerBoardingHousePageResponse>(
      `${this.apiUrl}/owner/boarding-houses?page=${page}`,
      { headers: this.authorizationHeaders(token) }
    );
  }

  createOwnerBoardingHouse(
    token: string,
    data: CreateBoardingHouseData
  ): Observable<CreateBoardingHouseResponse> {
    return this.http.post<CreateBoardingHouseResponse>(
      `${this.apiUrl}/owner/boarding-houses`,
      data,
      { headers: this.authorizationHeaders(token) }
    );
  }

  updateOwnerBoardingHouseBillingPolicy(
    token: string,
    boardingHouseId: number,
    billingPolicy: BillingPolicy
  ): Observable<UpdateBoardingHouseBillingPolicyResponse> {
    return this.http.patch<UpdateBoardingHouseBillingPolicyResponse>(
      `${this.apiUrl}/owner/boarding-houses/${boardingHouseId}/billing-policy`,
      { billing_policy: billingPolicy },
      { headers: this.authorizationHeaders(token) }
    );
  }

  updateOwnerBoardingHouseSettings(
    token: string,
    boardingHouseId: number,
    data: BoardingHouseSettingsData
  ): Observable<UpdateBoardingHouseSettingsResponse> {
    return this.http.patch<UpdateBoardingHouseSettingsResponse>(
      `${this.apiUrl}/owner/boarding-houses/${boardingHouseId}/settings`,
      data,
      { headers: this.authorizationHeaders(token) }
    );
  }

  getOwnerRooms(
    token: string,
    boardingHouseId: number,
    page = 1
  ): Observable<OwnerRoomListResponse> {
    return this.http.get<OwnerRoomListResponse>(
      `${this.apiUrl}/owner/boarding-houses/${boardingHouseId}/rooms?page=${page}`,
      { headers: this.authorizationHeaders(token) }
    );
  }

  getOwnerTenants(
    token: string,
    page = 1,
    search = '',
    perPage = 10
  ): Observable<OwnerTenantPageResponse> {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage)
    });
    if (search.trim()) {
      params.set('search', search.trim());
    }

    return this.http.get<OwnerTenantPageResponse>(
      `${this.apiUrl}/owner/tenants?${params.toString()}`,
      { headers: this.authorizationHeaders(token) }
    );
  }

  getOwnerRentalBills(
    token: string,
    page = 1,
    perPage = 15,
    month?: string
  ): Observable<RentalBillPageResponse> {
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (month) {
      params.set('month', month);
    }
    return this.http.get<RentalBillPageResponse>(
      `${this.apiUrl}/owner/rental-bills?${params.toString()}`,
      { headers: this.authorizationHeaders(token) }
    );
  }

  getOwnerRentalBillGenerationStatus(
    token: string,
    month: string
  ): Observable<RentalBillGenerationStatusResponse> {
    const params = new URLSearchParams({ month });
    return this.http.get<RentalBillGenerationStatusResponse>(
      `${this.apiUrl}/owner/rental-bills/generation-status?${params.toString()}`,
      { headers: this.authorizationHeaders(token) }
    );
  }

  getOwnerRentalPaymentSubmissions(
    token: string,
    status: 'pending' | 'approved' | 'rejected' = 'pending',
    page = 1,
    perPage = 15
  ): Observable<RentalPaymentPageResponse> {
    const params = new URLSearchParams({
      status,
      page: String(page),
      per_page: String(perPage)
    });
    return this.http.get<RentalPaymentPageResponse>(
      `${this.apiUrl}/owner/rental-payment-submissions?${params.toString()}`,
      { headers: this.authorizationHeaders(token) }
    );
  }

  approveOwnerRentalPayment(
    token: string,
    paymentId: number,
    data: { amount: number; payment_date: string; amount_adjustment_reason?: string }
  ): Observable<ReviewRentalPaymentResponse> {
    return this.http.patch<ReviewRentalPaymentResponse>(
      `${this.apiUrl}/owner/rental-payments/${paymentId}/approve`,
      data,
      { headers: this.authorizationHeaders(token) }
    );
  }

  rejectOwnerRentalPayment(
    token: string,
    paymentId: number,
    reason: string
  ): Observable<ReviewRentalPaymentResponse> {
    return this.http.patch<ReviewRentalPaymentResponse>(
      `${this.apiUrl}/owner/rental-payments/${paymentId}/reject`,
      { reason },
      { headers: this.authorizationHeaders(token) }
    );
  }

  getOwnerRentalPaymentProof(token: string, paymentId: number): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/rental-payments/${paymentId}/proof`,
      {
        headers: this.authorizationHeaders(token),
        responseType: 'blob'
      }
    );
  }

  createOwnerRentalBill(
    token: string,
    tenantId: number,
    data: CreateRentalBillData
  ): Observable<RentalBillResponse> {
    return this.http.post<RentalBillResponse>(
      `${this.apiUrl}/owner/tenants/${tenantId}/rental-bills`,
      data,
      { headers: this.authorizationHeaders(token) }
    );
  }

  getOwnerRentalBill(
    token: string,
    billId: number
  ): Observable<RentalBillResponse> {
    return this.http.get<RentalBillResponse>(
      `${this.apiUrl}/owner/rental-bills/${billId}`,
      { headers: this.authorizationHeaders(token) }
    );
  }

  recordOwnerRentalPayment(
    token: string,
    billId: number,
    data: RecordRentalPaymentData
  ): Observable<RecordRentalPaymentResponse> {
    return this.http.post<RecordRentalPaymentResponse>(
      `${this.apiUrl}/owner/rental-bills/${billId}/payments`,
      data,
      { headers: this.authorizationHeaders(token) }
    );
  }

  voidOwnerRentalPayment(
    token: string,
    paymentId: number,
    reason: string
  ): Observable<VoidRentalPaymentResponse> {
    return this.http.patch<VoidRentalPaymentResponse>(
      `${this.apiUrl}/owner/rental-payments/${paymentId}/void`,
      { reason },
      { headers: this.authorizationHeaders(token) }
    );
  }

  createOwnerTenant(
    token: string,
    data: OwnerTenantData
  ): Observable<OwnerTenantResponse> {
    return this.http.post<OwnerTenantResponse>(
      `${this.apiUrl}/owner/tenants`,
      data,
      { headers: this.authorizationHeaders(token) }
    );
  }

  getOwnerTenant(token: string, tenantId: number): Observable<OwnerTenantResponse> {
    return this.http.get<OwnerTenantResponse>(
      `${this.apiUrl}/owner/tenants/${tenantId}`,
      { headers: this.authorizationHeaders(token) }
    );
  }

  updateOwnerTenant(
    token: string,
    tenantId: number,
    data: OwnerTenantContactData
  ): Observable<OwnerTenantResponse> {
    return this.http.put<OwnerTenantResponse>(
      `${this.apiUrl}/owner/tenants/${tenantId}`,
      data,
      { headers: this.authorizationHeaders(token) }
    );
  }

  assignOwnerTenant(
    token: string,
    tenantId: number,
    data: OwnerTenantAssignmentData
  ): Observable<OwnerTenantActionResponse> {
    return this.http.post<OwnerTenantActionResponse>(
      `${this.apiUrl}/owner/tenants/${tenantId}/assignments`,
      data,
      { headers: this.authorizationHeaders(token) }
    );
  }

  transferOwnerTenant(
    token: string,
    tenantId: number,
    data: OwnerTenantAssignmentData
  ): Observable<OwnerTenantActionResponse> {
    return this.http.post<OwnerTenantActionResponse>(
      `${this.apiUrl}/owner/tenants/${tenantId}/transfer`,
      data,
      { headers: this.authorizationHeaders(token) }
    );
  }

  moveOutOwnerTenant(
    token: string,
    tenantId: number
  ): Observable<OwnerTenantActionResponse> {
    return this.http.patch<OwnerTenantActionResponse>(
      `${this.apiUrl}/owner/tenants/${tenantId}/move-out`,
      {},
      { headers: this.authorizationHeaders(token) }
    );
  }

  getOwnerRoom(
    token: string,
    boardingHouseId: number,
    roomId: number
  ): Observable<OwnerRoomResponse> {
    return this.http.get<OwnerRoomResponse>(
      `${this.apiUrl}/owner/boarding-houses/${boardingHouseId}/rooms/${roomId}`,
      { headers: this.authorizationHeaders(token) }
    );
  }

  createOwnerRoom(
    token: string,
    boardingHouseId: number,
    data: FormData
  ): Observable<OwnerRoomResponse> {
    return this.http.post<OwnerRoomResponse>(
      `${this.apiUrl}/owner/boarding-houses/${boardingHouseId}/rooms`,
      data,
      { headers: this.authorizationHeaders(token) }
    );
  }

  updateOwnerRoom(
    token: string,
    boardingHouseId: number,
    roomId: number,
    data: FormData
  ): Observable<OwnerRoomResponse> {
    return this.http.post<OwnerRoomResponse>(
      `${this.apiUrl}/owner/boarding-houses/${boardingHouseId}/rooms/${roomId}`,
      data,
      { headers: this.authorizationHeaders(token) }
    );
  }

  deleteOwnerRoom(
    token: string,
    boardingHouseId: number,
    roomId: number
  ): Observable<OwnerRoomMutationResponse> {
    return this.http.delete<OwnerRoomMutationResponse>(
      `${this.apiUrl}/owner/boarding-houses/${boardingHouseId}/rooms/${roomId}`,
      { headers: this.authorizationHeaders(token) }
    );
  }

  uploadOwnerRoomImages(
    token: string,
    boardingHouseId: number,
    roomId: number,
    data: FormData
  ): Observable<OwnerRoomResponse> {
    return this.http.post<OwnerRoomResponse>(
      `${this.apiUrl}/owner/boarding-houses/${boardingHouseId}/rooms/${roomId}/images`,
      data,
      { headers: this.authorizationHeaders(token) }
    );
  }

  getOwnerRoomImage(
    token: string,
    boardingHouseId: number,
    roomId: number,
    imageId: number
  ): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/owner/boarding-houses/${boardingHouseId}/rooms/${roomId}/images/${imageId}`,
      {
        headers: this.authorizationHeaders(token),
        responseType: 'blob'
      }
    );
  }

  deleteOwnerRoomImage(
    token: string,
    boardingHouseId: number,
    roomId: number,
    imageId: number
  ): Observable<OwnerRoomMutationResponse> {
    return this.http.delete<OwnerRoomMutationResponse>(
      `${this.apiUrl}/owner/boarding-houses/${boardingHouseId}/rooms/${roomId}/images/${imageId}`,
      { headers: this.authorizationHeaders(token) }
    );
  }

  logoutOwner(token: string): Observable<OwnerLogoutResponse> {
    return this.http.post<OwnerLogoutResponse>(
      `${this.apiUrl}/logout`,
      {},
      { headers: this.authorizationHeaders(token) }
    );
  }

  private authorizationHeaders(token: string): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
