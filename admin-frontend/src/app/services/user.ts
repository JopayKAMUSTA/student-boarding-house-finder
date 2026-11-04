
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private apiUrl = 'http://127.0.0.1:8000/api/users';

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

    const token = this.authService.getToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

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

    return this.http.get<any>(this.apiUrl, {
      headers,
      params
    });
  }
}
