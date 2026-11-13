
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface GeneralSettings {
  systemName: string;
  contactEmail: string;
  contactNumber: string;
}

interface NotificationSettings {
  newBoardingHouse: boolean;
  ownerVerification: boolean;
  accountRegistration: boolean;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class Settings implements OnInit {

  activeSection = 'general';

  generalSettings: GeneralSettings = {
    systemName: 'TagStay',
    contactEmail: '',
    contactNumber: ''
  };

  notificationSettings: NotificationSettings = {
    newBoardingHouse: true,
    ownerVerification: true,
    accountRegistration: true
  };

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  successMessage = '';
  errorMessage = '';

  isSaving = false;

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    const general = localStorage.getItem('tagstay_general_settings');
    const notifications = localStorage.getItem('tagstay_notification_settings');

    if (general) {
      this.generalSettings = {
        ...this.generalSettings,
        ...JSON.parse(general)
      };
    }

    if (notifications) {
      this.notificationSettings = {
        ...this.notificationSettings,
        ...JSON.parse(notifications)
      };
    }
  }

  setActiveSection(section: string): void {
    this.activeSection = section;
    this.clearMessages();
  }

  saveGeneralSettings(): void {
    this.clearMessages();

    if (!this.generalSettings.systemName.trim()) {
      this.errorMessage = 'Please enter a system name.';
      return;
    }

    if (
      this.generalSettings.contactEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.generalSettings.contactEmail)
    ) {
      this.errorMessage = 'Please enter a valid contact email.';
      return;
    }

    localStorage.setItem(
      'tagstay_general_settings',
      JSON.stringify(this.generalSettings)
    );

    this.successMessage = 'General settings saved successfully.';
  }

  saveNotificationSettings(): void {
    this.clearMessages();

    localStorage.setItem(
      'tagstay_notification_settings',
      JSON.stringify(this.notificationSettings)
    );

    this.successMessage = 'Notification preferences saved successfully.';
  }

  changePassword(): void {
    this.clearMessages();

    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.errorMessage = 'Please complete all password fields.';
      return;
    }

    if (this.newPassword.length < 8) {
      this.errorMessage = 'Your new password must contain at least 8 characters.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'New password and confirmation do not match.';
      return;
    }

    this.errorMessage =
      'Password change is not connected yet. We need to connect this form to your Laravel API before it can securely update your password.';
  }

  clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }

  resetGeneralSettings(): void {
    this.generalSettings = {
      systemName: 'TagStay',
      contactEmail: '',
      contactNumber: ''
    };

    this.saveGeneralSettings();
  }

  resetPasswordForm(): void {
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.clearMessages();
  }
}
