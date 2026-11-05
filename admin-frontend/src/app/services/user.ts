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

  private authorizationHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.getToken() ?? ''}`
    });
  }
}
