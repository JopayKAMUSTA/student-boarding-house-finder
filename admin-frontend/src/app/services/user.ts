import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth';

export interface OwnerProfileDetails {
  id: number;
  user_id: number;
  contact_number: string | null;
  business_name: string | null;
  business_address: string | null;
  verification_status: 'pending' | 'approved' | 'rejected';
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManagedOwner {
  id: number;
  name: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  email: string;
  role: 'owner';
  status: string;
  created_at: string;
  updated_at: string;
  owner_profile: OwnerProfileDetails | null;
}

export interface OwnerListResponse {
  success: boolean;
  data: {
    data: ManagedOwner[];
    current_page: number;
    last_page: number;
    total: number;
  };
}

export interface OwnerVerificationResponse {
  success: boolean;
  message: string;
  data: ManagedOwner;
}

export type BoardingHouseStatus = 'pending' | 'approved' | 'rejected';

export interface AdminBoardingHouseOwner {
  id: number;
  name: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  email: string;
  role: 'owner';
  status: string;
  owner_profile: Pick<
    OwnerProfileDetails,
    'contact_number' | 'business_name' | 'business_address' | 'verification_status' | 'verified_at'
  > | null;
}

export interface AdminRoomImage {
  id: number;
  boarding_house_room_id: number;
  image_path: string;
  url: string;
}

export interface AdminBoardingHouseRoom {
  id: number;
  boarding_house_id: number;
  room_number: string;
  room_type: string;
  monthly_rent: string | number;
  pricing_basis: string;
  max_occupants: number;
  availability_status: string;
  description: string | null;
  amenities: string[] | null;
  images: AdminRoomImage[];
}

export interface AdminBoardingHouse {
  id: number;
  owner_id: number;
  name: string;
  description: string | null;
  city: string;
  barangay: string | null;
  address: string;
  monthly_rent: string | number;
  security_deposit: string | number;
  advance_payment: string | number;
  available_rooms: number;
  total_rooms: number;
  room_type: string | null;
  amenities: string[] | null;
  status: BoardingHouseStatus;
  created_at: string;
  updated_at: string;
  owner: AdminBoardingHouseOwner;
  rooms?: AdminBoardingHouseRoom[];
}

export interface AdminBoardingHousePageResponse {
  success: boolean;
  data: {
    data: AdminBoardingHouse[];
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
  };
}

export interface AdminBoardingHouseResponse {
  success: boolean;
  data: AdminBoardingHouse;
}

export interface AdminBoardingHouseStatusResponse {
  success: boolean;
  message: string;
  data: AdminBoardingHouse;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private apiUrl = 'http://127.0.0.1:8000/api';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getUsers(
    search: string = '',
    role: string = '',
    status: string = '',
    page: number = 1
  ): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString());

    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    if (role) {
      params = params.set('role', role);
    }

    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<any>(`${this.apiUrl}/users`, {
      headers: this.authorizationHeaders(),
      params
    });
  }

  getOwners(page: number = 1): Observable<OwnerListResponse> {
    return this.http.get<OwnerListResponse>(`${this.apiUrl}/admin/owners`, {
      headers: this.authorizationHeaders(),
      params: new HttpParams().set('page', page.toString())
    });
  }

  updateOwnerVerification(
    ownerId: number,
    verificationStatus: 'approved' | 'rejected'
  ): Observable<OwnerVerificationResponse> {
    return this.http.patch<OwnerVerificationResponse>(
      `${this.apiUrl}/admin/owners/${ownerId}/verification`,
      { verification_status: verificationStatus },
      { headers: this.authorizationHeaders() }
    );
  }

  getAdminBoardingHouses(
    status: BoardingHouseStatus | '',
    page: number = 1
  ): Observable<AdminBoardingHousePageResponse> {
    let params = new HttpParams().set('page', page.toString());
    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<AdminBoardingHousePageResponse>(
      `${this.apiUrl}/admin/boarding-houses`,
      { headers: this.authorizationHeaders(), params }
    );
  }

  getAdminBoardingHouse(
    boardingHouseId: number
  ): Observable<AdminBoardingHouseResponse> {
    return this.http.get<AdminBoardingHouseResponse>(
      `${this.apiUrl}/admin/boarding-houses/${boardingHouseId}`,
      { headers: this.authorizationHeaders() }
    );
  }

  updateAdminBoardingHouseStatus(
    boardingHouseId: number,
    status: 'approved' | 'rejected'
  ): Observable<AdminBoardingHouseStatusResponse> {
    return this.http.patch<AdminBoardingHouseStatusResponse>(
      `${this.apiUrl}/admin/boarding-houses/${boardingHouseId}/status`,
      { status },
      { headers: this.authorizationHeaders() }
    );
  }

  getAdminBoardingHouseImage(imageUrl: string): Observable<Blob> {
    return this.http.get(imageUrl, {
      headers: this.authorizationHeaders(),
      responseType: 'blob'
    });
  }

  private authorizationHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.getToken() ?? ''}`
    });
  }
}
