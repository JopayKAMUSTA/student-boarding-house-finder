
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { UserService } from '../../services/user';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class Users implements OnInit {

  private cdr = inject(ChangeDetectorRef);

  users: any[] = [];

  search = '';
  selectedRole = '';
  selectedStatus = '';

  currentPage = 1;
  lastPage = 1;
  totalUsers = 0;

  loading = false;
  errorMessage = '';

  // User Details Modal
  selectedUser: any = null;
  showUserModal = false;

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  // Load users from Laravel API
  loadUsers(page: number = 1): void {

    this.loading = true;
    this.errorMessage = '';

    this.userService.getUsers(
      this.search,
      this.selectedRole,
      this.selectedStatus,
      page
    )
    .pipe(
      finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      })
    )
    .subscribe({

      next: (response) => {

        if (response && response.success) {

          const result = response.data;

          // Support both direct array and paginated API responses
          this.users = Array.isArray(result)
            ? result
            : (result?.data ?? []);

          // Pagination information
          this.currentPage = result?.current_page ?? 1;
          this.lastPage = result?.last_page ?? 1;
          this.totalUsers = result?.total ?? this.users.length;

        } else {

          this.users = [];
          this.totalUsers = 0;
          this.errorMessage = 'Unable to retrieve users.';

        }

      },

      error: (error) => {

        console.error('User loading error:', error);

        this.users = [];
        this.totalUsers = 0;

        this.errorMessage =
          error.error?.message ||
          'Unable to load users. Please check your connection and login again.';

      }

    });

  }

  // Search users
  searchUsers(): void {
    this.loadUsers(1);
  }

  // Filter users by role or status
  filterUsers(): void {
    this.loadUsers(1);
  }

  // Clear all filters
  clearFilters(): void {

    this.search = '';
    this.selectedRole = '';
    this.selectedStatus = '';

    this.loadUsers(1);

  }

  // Change pagination page
  changePage(page: number): void {

    if (page < 1 || page > this.lastPage) {
      return;
    }

    this.loadUsers(page);

  }

  // Get first letter of user's name
  getUserInitial(name: string): string {
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  // Open User Details Modal
  viewUser(user: any): void {

    this.selectedUser = user;
    this.showUserModal = true;

  }

  // Close User Details Modal
  closeUserModal(): void {

    this.selectedUser = null;
    this.showUserModal = false;

  }

}
