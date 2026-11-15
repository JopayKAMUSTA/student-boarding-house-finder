import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import {
  BoardingHouseRoomInfo,
  OwnerAuth,
  OwnerBoardingHousePageResponse,
  OwnerProfileResponse,
  OwnerTenantPageResponse,
  RentalBillPageResponse,
  RentalPaymentPageResponse
} from '../../services/owner-auth';

interface DashboardCard {
  label: string;
  value: string;
  helper: string;
}

interface DashboardReminder {
  title: string;
  description: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
  actionLabel?: string;
  actionRoute?: string;
}

interface DashboardActivity {
  title: string;
  detail: string;
  timestamp: string;
  tone: 'info' | 'success' | 'warning';
}

@Component({
  imports: [CommonModule],
  selector: 'app-dashboard',
  styleUrl: './dashboard.css',
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  private ownerAuth = inject(OwnerAuth);
  private router = inject(Router);
  private changeDetector = inject(ChangeDetectorRef);

  totalBoardingHouses: number | null = null;
  totalRooms: number | null = null;
  availableRooms: number | null = null;
  occupiedRooms: number | null = null;
  pendingBoardingHouses: number | null = null;
  totalActiveTenants: number | null = null;
  pendingRentalPayments: number | null = null;
  totalRemainingRentalBalance: number | null = null;
  pendingPaymentReviews: number | null = null;
  profileVerificationStatus: string | null = null;
  isLoadingSummary = false;
  summaryError = '';
  summaryCards: DashboardCard[] = [];
  importantReminders: DashboardReminder[] = [];
  recentActivities: DashboardActivity[] = [];

  ngOnInit(): void {
    this.loadSummary();
  }


private loadSummary(): void {
  const token = this.ownerAuth.getToken();

  if (!token) {
    this.ownerAuth.clearSession();
    void this.router.navigate(['/login'], {
      queryParams: { notice: 'session-expired' }
    });
    return;
  }

  this.isLoadingSummary = true;
  this.summaryError = '';

  this.totalBoardingHouses = null;
  this.totalRooms = null;
  this.availableRooms = null;
  this.occupiedRooms = null;
  this.pendingBoardingHouses = null;
  this.totalActiveTenants = null;
  this.pendingRentalPayments = null;
  this.totalRemainingRentalBalance = null;
  this.pendingPaymentReviews = null;
  this.profileVerificationStatus = null;

  this.summaryCards = [];
  this.importantReminders = [];
  this.recentActivities = [];

  // Load boarding houses first for the main dashboard metrics.
  this.ownerAuth.getOwnerBoardingHouses(token, 1).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 || error.status === 403) {
        this.handleDashboardAuthError(error);
      } else {
        this.summaryError = 'Could not load boarding-house information.';
      }

      return of(null);
    })
  ).subscribe((firstPage) => {
    if (!firstPage) {
      this.isLoadingSummary = false;
      this.changeDetector.markForCheck();
      return;
    }

    const lastPage = Number(firstPage.data?.last_page ?? 1);

    const remainingPageRequests = Array.from(
      { length: Math.max(lastPage - 1, 0) },
      (_, index) => this.ownerAuth.getOwnerBoardingHouses(token, index + 2)
    );

    const housesRequest$ = remainingPageRequests.length
      ? forkJoin(remainingPageRequests).pipe(
          catchError(() => of([]))
        )
      : of([]);

    // Load the main dashboard data independently.
    housesRequest$.subscribe((remainingPages) => {
      const pages = [firstPage, ...remainingPages];

      const houses = pages.flatMap((page) =>
        Array.isArray(page?.data?.data) ? page.data.data : []
      );

      const emptyResponse = {
        data: {
          data: [],
          total: 0
        }
      };

      const mainResponse = {
        firstPage,
        houses,
        profile: null,
        tenants: null,
        bills: null,
        submissions: null
      };

      // Load secondary information in the background.
      forkJoin({
        profile: this.ownerAuth.getOwnerProfile(token).pipe(
          catchError(() => of(null))
        ),
        tenants: this.ownerAuth.getOwnerTenants(token, 1, '', 100).pipe(
          catchError(() => of(null))
        ),
        bills: this.ownerAuth.getOwnerRentalBills(token, 1, 100).pipe(
          catchError(() => of(null))
        ),
        submissions: this.ownerAuth.getOwnerRentalPaymentSubmissions(
          token, 'pending', 1, 25
        ).pipe(
          catchError(() => of(null))
        )
      }).pipe(
        finalize(() => this.changeDetector.markForCheck())
      ).subscribe((secondary) => {
        this.applySummary({
          ...mainResponse,
          ...secondary
        });

        this.changeDetector.markForCheck();
      });

      // Display main metrics without waiting for secondary requests.
      this.applySummary(mainResponse);

      this.isLoadingSummary = false;
      this.changeDetector.markForCheck();
    });
  });
}

private handleDashboardAuthError(error: HttpErrorResponse): void {
  this.ownerAuth.clearSession();

  void this.router.navigate(['/login'], {
    queryParams: {
      notice: error.status === 403 ? 'owner-required' : 'session-expired'
    }
  });
}

goToOwnerProfile(): void {
  void this.router.navigate(['/owner-profile']);
}

  private applySummary(response: {
    firstPage: OwnerBoardingHousePageResponse | null;
    houses: BoardingHouseRoomInfo[];
    profile: OwnerProfileResponse | null;
    tenants: OwnerTenantPageResponse | null;
    bills: RentalBillPageResponse | null;
    submissions: RentalPaymentPageResponse | null;
  }): void {
    const firstPage = response.firstPage?.data;
    const houseList = response.houses ?? [];
    const housesWithValidRooms = houseList.filter((house) => {
      if (typeof house !== 'object' || house === null) {
        return false;
      }
      const total = Number(house.total_rooms ?? 0);
      const available = Number(house.available_rooms ?? 0);
      return Number.isFinite(total) && Number.isFinite(available) && total >= 0 && available >= 0 && available <= total;
    });

    this.totalBoardingHouses = Number(firstPage?.total ?? housesWithValidRooms.length ?? 0);
    this.totalRooms = housesWithValidRooms.reduce((sum, house) => sum + Number(house.total_rooms ?? 0), 0);
    this.availableRooms = housesWithValidRooms.reduce((sum, house) => sum + Number(house.available_rooms ?? 0), 0);
    this.occupiedRooms = this.totalRooms - this.availableRooms;
    this.pendingBoardingHouses = housesWithValidRooms.filter((house) => house.status === 'pending').length;
    this.totalActiveTenants = response.tenants?.data?.total ?? 0;

    const billList = response.bills?.data?.data ?? [];
    const outstandingBills = billList.filter((bill) => {
      const remainingBalance = Number(bill.remaining_balance ?? bill.balance ?? 0);
      return remainingBalance > 0;
    });
    this.pendingRentalPayments = outstandingBills.length;
    this.totalRemainingRentalBalance = outstandingBills.reduce(
      (sum, bill) => sum + Number(bill.remaining_balance ?? bill.balance ?? 0),
      0
    );

    const submissionList = response.submissions?.data?.data ?? [];
    this.pendingPaymentReviews = response.submissions?.data?.total ?? submissionList.length;

    const profileStatus = response.profile?.profile?.verification_status ?? 'unknown';
    const profileUser = response.profile?.user;
    const profileInfo = response.profile?.profile;
    const hasSubmittedId = !!profileInfo?.valid_id_front && !!profileInfo?.valid_id_back;
    const isProfileComplete = !!profileUser &&
      !!profileUser.first_name?.trim() &&
      !!profileUser.last_name?.trim() &&
      !!profileUser.email?.trim() &&
      !!profileInfo?.contact_number?.trim() &&
      !!profileInfo?.business_name?.trim() &&
      !!profileInfo?.business_address?.trim();
    const isPendingReview = profileStatus === 'pending' && hasSubmittedId;

    this.profileVerificationStatus = profileStatus;

    this.summaryCards = [
      {
        label: 'Total boarding houses',
        value: this.totalBoardingHouses === null ? 'Not available yet' : String(this.totalBoardingHouses),
        helper: 'Active listings'
      },
      {
        label: 'Total rooms',
        value: this.totalRooms === null ? 'Not available yet' : String(this.totalRooms),
        helper: 'Across all houses'
      },
      {
        label: 'Available rooms',
        value: this.availableRooms === null ? 'Not available yet' : String(this.availableRooms),
        helper: 'Ready for tenants'
      },
      {
        label: 'Occupied rooms',
        value: this.occupiedRooms === null ? 'Not available yet' : String(this.occupiedRooms),
        helper: 'Currently assigned'
      },
      {
        label: 'Active tenants',
        value: this.totalActiveTenants === null ? 'Not available yet' : String(this.totalActiveTenants),
        helper: 'In your roster'
      },
      {
        label: 'Pending rental bills',
        value: this.pendingRentalPayments === null ? 'Not available yet' : String(this.pendingRentalPayments),
        helper: 'Still due'
      },
      {
        label: 'Remaining balance',
        value: this.totalRemainingRentalBalance === null ? 'Not available yet' : `₱${this.totalRemainingRentalBalance.toLocaleString()}`,
        helper: 'Outstanding receivables'
      },
      {
        label: 'Pending reviews',
        value: this.pendingPaymentReviews === null ? 'Not available yet' : String(this.pendingPaymentReviews),
        helper: 'Payment proofs to approve'
      }
    ];

    this.importantReminders = ([
      {
        title: 'Complete Your Profile',
        description: 'Your personal and business information is incomplete. Please update your profile before continuing.',
        tone: 'warning' as const,
        actionLabel: 'Complete Profile',
        actionRoute: '/owner-profile'
      },
      {
        title: 'Submit Your Valid ID',
        description: 'Your profile is complete, but no valid ID documents have been submitted yet.',
        tone: 'warning' as const,
        actionLabel: 'Submit Valid ID',
        actionRoute: '/owner-profile'
      },
      {
        title: 'Your ID Is Under Review',
        description: 'Your valid ID has been submitted and is awaiting administrator review.',
        tone: 'info' as const,
      },
      {
        title: 'ID Verification Rejected',
        description: profileInfo?.rejection_reason
          ? `Your ID verification was rejected. Reason: ${profileInfo.rejection_reason}`
          : 'Your ID verification was rejected. Please review the details and resubmit your valid ID.',
        tone: 'danger' as const,
        actionLabel: 'Resubmit ID',
        actionRoute: '/owner-profile'
      },
      {
        title: 'Your Identity Is Verified',
        description: 'Your identity has been verified and you are ready to manage your boarding house.',
        tone: 'success' as const,
      },
      {
        title: 'Boarding-house status',
        description: this.pendingBoardingHouses && this.pendingBoardingHouses > 0
          ? `${this.pendingBoardingHouses} boarding house${this.pendingBoardingHouses > 1 ? 's are' : ' is'} awaiting approval.`
          : 'All boarding houses are approved or active.',
        tone: this.pendingBoardingHouses && this.pendingBoardingHouses > 0 ? 'warning' : 'success'
      },
      {
        title: 'Owner verification',
        description: profileStatus === 'approved'
          ? 'Your owner profile has been verified.'
          : profileStatus === 'pending' && hasSubmittedId
            ? 'Your identity documents are under review.'
            : 'Verification status is still being reviewed or unavailable.',
        tone: profileStatus === 'approved' ? 'success' : 'warning'
      },
      {
        title: 'Rental follow-up',
        description: this.pendingRentalPayments && this.pendingRentalPayments > 0
          ? `${this.pendingRentalPayments} unpaid or incomplete rental bill${this.pendingRentalPayments > 1 ? 's need' : ' needs'} attention.`
          : 'No unpaid rental bills are currently outstanding.',
        tone: this.pendingRentalPayments && this.pendingRentalPayments > 0 ? 'danger' : 'success'
      },
      {
        title: 'Payment proof review',
        description: this.pendingPaymentReviews && this.pendingPaymentReviews > 0
          ? `${this.pendingPaymentReviews} payment submission${this.pendingPaymentReviews > 1 ? 's require' : ' requires'} your review.`
          : 'There are no payment submissions waiting for approval.',
        tone: this.pendingPaymentReviews && this.pendingPaymentReviews > 0 ? 'warning' : 'info'
      }
    ] as DashboardReminder[]).filter((item) => {
      if (item.title === 'Complete Your Profile') {
        return !isProfileComplete;
      }
      if (item.title === 'Submit Your Valid ID') {
        return isProfileComplete && !hasSubmittedId && !isPendingReview && profileStatus !== 'approved' && profileStatus !== 'rejected';
      }
      if (item.title === 'Your ID Is Under Review') {
        return isPendingReview;
      }
      if (item.title === 'ID Verification Rejected') {
        return profileStatus === 'rejected';
      }
      if (item.title === 'Your Identity Is Verified') {
        return profileStatus === 'approved';
      }
      return item.description.length > 0;
    });

    const recentTenantEntries = (response.tenants?.data?.data ?? []).slice(0, 3).map((tenant) => ({
      title: tenant.full_name,
      detail: tenant.current_assignment?.move_in_date
        ? `Moved in ${new Date(tenant.current_assignment.move_in_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
        : 'Tenant profile is available.',
      timestamp: 'Tenant',
      tone: 'info' as const
    }));

    const recentSubmissionEntries = (response.submissions?.data?.data ?? []).slice(0, 3).map((submission) => ({
      title: `Payment submission #${submission.id}`,
      detail: `${submission.amount} submitted for review`,
      timestamp: 'Needs review',
      tone: 'warning' as const
    }));

    const recentBillEntries = (response.bills?.data?.data ?? []).slice(0, 2).map((bill) => ({
      title: `Bill #${bill.id}`,
      detail: `Balance: ₱${Number(bill.remaining_balance ?? bill.balance ?? 0).toLocaleString()}`,
      timestamp: 'Outstanding',
      tone: 'success' as const
    }));

    this.recentActivities = [...recentTenantEntries, ...recentSubmissionEntries, ...recentBillEntries].slice(0, 5);

    if (this.recentActivities.length === 0) {
      this.recentActivities = [{
        title: 'No recent activity yet',
        detail: 'Add a boarding house, tenant, or payment update to start tracking your operations here.',
        timestamp: 'New',
        tone: 'info'
      }];
    }
  }
}

