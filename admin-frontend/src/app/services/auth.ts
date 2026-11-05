import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private apiUrl = 'http://127.0.0.1:8000/api';

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/admin/login`, {
      email,
      password
    }).pipe(
      tap(response => {
        if (response.success && response.data.token) {
          sessionStorage.setItem('admin_token', response.data.token);
          sessionStorage.setItem('admin_user', JSON.stringify(response.data));
        }
      })
    );
  }

  logout(): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/logout`,
      {},
      {
        headers: {
          Authorization: `Bearer ${this.getToken() ?? ''}`
        }
      }
    ).pipe(
      tap(() => {
        this.clearSession();
      })
    );
  }

  getToken(): string | null {
    return sessionStorage.getItem('admin_token');
  }

  getAdmin(): any {
    const admin = sessionStorage.getItem('admin_user');
    return admin ? JSON.parse(admin) : null;
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  clearSession(): void {
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_user');
  }
}
