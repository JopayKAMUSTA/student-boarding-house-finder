import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OwnerAuth } from '../services/owner-auth';
import { OwnerSidebar } from '../components/owner-sidebar/owner-sidebar';

@Component({
  selector: 'app-owner-layout',
  standalone: true,
  imports: [CommonModule, OwnerSidebar, RouterOutlet],
  templateUrl: './owner-layout.html',
  styleUrl: './owner-layout.css'
})
export class OwnerLayout implements OnInit {
  private readonly ownerAuth = inject(OwnerAuth);

  ownerName = '';
  ownerEmail = '';
  ownerRole = '';

  ngOnInit(): void {
    const owner = this.ownerAuth.getOwner();
    this.ownerName = owner?.name?.trim() ||
      [owner?.first_name, owner?.last_name].filter(Boolean).join(' ');
    this.ownerEmail = owner?.email || '';
    this.ownerRole = owner?.role || '';
  }
}
