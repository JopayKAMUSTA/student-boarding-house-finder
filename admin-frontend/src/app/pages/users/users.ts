
import { Component, OnInit } from '@angular/core';
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
      })
    )
    .subscribe({

      next: (response) => {

        if (response.success) {
          this.users = response.data.data;
          this.currentPage = response.data.current_page;
          this.lastPage = response.data.last_page;
          this.totalUsers = response.data.total;
        } else {
          this.errorMessage = 'Unable to retrieve users.';
        }

      },

      error: (error) => {

        console.error('User loading error:', error);

        this.errorMessage =
          error.error?.message ||
          'Unable to load users. Please check your connection and login again.';

      }

    });

  }

  searchUsers(): void {
    this.loadUsers(1);
  }

  filterUsers(): void {
    this.loadUsers(1);
  }

  clearFilters(): void {
    this.search = '';
    this.selectedRole = '';
    this.selectedStatus = '';
    this.loadUsers(1);
  }

  changePage(page: number): void {

    if (page < 1 || page > this.lastPage) {
      return;
    }

    this.loadUsers(page);

  }

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
