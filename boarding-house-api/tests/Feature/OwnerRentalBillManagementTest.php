<?php

namespace Tests\Feature;

use App\Models\Boardinghouse;
use App\Models\BoardinghouseRoom;
use App\Models\RentalBill;
use App\Models\RentalPayment;
use App\Models\RoomAssignment;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OwnerRentalBillManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_create_a_full_monthly_bill_from_assignment_rent(): void
    {
        $owner = $this->createOwner();
        $tenant = $this->createTenant($owner);
        $assignment = $this->createAssignment($tenant, ['monthly_rent' => '5100.00']);
        Sanctum::actingAs($owner);

        $response = $this->postJson("/api/owner/tenants/{$tenant->id}/rental-bills", [
            'room_assignment_id' => $assignment->id,
            'amount' => '1.00',
            'rental_period_start' => '2026-11-01',
            'rental_period_end' => '2026-11-30',
            'due_date' => '2026-11-05',
        ])->assertCreated()
            ->assertJsonPath('data.room_assignment_id', $assignment->id)
            ->assertJsonPath('data.amount', '5100.00')
            ->assertJsonPath('data.billing_policy', 'full_monthly')
            ->assertJsonPath('data.monthly_rent_snapshot', '5100.00')
            ->assertJsonPath('data.billable_days', 30)
            ->assertJsonPath('data.days_in_month', 30)
            ->assertJsonPath('data.payment_status', 'overdue')
            ->assertJsonPath('data.balance', '5100.00');

        $this->assertDatabaseHas('rental_bills', [
            'id' => $response->json('data.id'),
            'room_assignment_id' => $assignment->id,
            'amount' => '5100.00',
        ]);
    }

    public function test_prorated_bill_uses_only_the_assignment_days_in_the_month(): void
    {
        $owner = $this->createOwner();
        $tenant = $this->createTenant($owner);
        $assignment = $this->createAssignment(
            $tenant,
            ['move_in_date' => '2026-11-10'],
            ['billing_policy' => 'prorated']
        );
        Sanctum::actingAs($owner);

        $this->postJson("/api/owner/tenants/{$tenant->id}/rental-bills", [
            'room_assignment_id' => $assignment->id,
            'rental_period_start' => '2026-11-01',
            'rental_period_end' => '2026-11-30',
            'due_date' => '2026-11-05',
        ])->assertCreated()
            ->assertJsonPath('data.amount', '3500.00')
            ->assertJsonPath('data.billing_policy', 'prorated')
            ->assertJsonPath('data.monthly_rent_snapshot', '5000.00')
            ->assertJsonPath('data.billable_days', 21)
            ->assertJsonPath('data.days_in_month', 30);
    }

    public function test_prorated_bill_uses_29_days_for_leap_year_february(): void
    {
        $owner = $this->createOwner();
        $tenant = $this->createTenant($owner);
        $assignment = $this->createAssignment(
            $tenant,
            ['monthly_rent' => '3100.00', 'move_in_date' => '2024-02-15'],
            ['billing_policy' => 'prorated']
        );
        Sanctum::actingAs($owner);

        $this->postJson("/api/owner/tenants/{$tenant->id}/rental-bills", [
            'room_assignment_id' => $assignment->id,
            'rental_period_start' => '2024-02-01',
            'rental_period_end' => '2024-02-29',
            'due_date' => '2024-02-05',
        ])->assertCreated()
            ->assertJsonPath('data.amount', '1603.45')
            ->assertJsonPath('data.billable_days', 15)
            ->assertJsonPath('data.days_in_month', 29);
    }

    public function test_prorated_bill_uses_28_days_for_non_leap_year_february(): void
    {
        $owner = $this->createOwner();
        $tenant = $this->createTenant($owner);
        $assignment = $this->createAssignment(
            $tenant,
            ['monthly_rent' => '3100.00', 'move_in_date' => '2025-02-15'],
            ['billing_policy' => 'prorated']
        );
        Sanctum::actingAs($owner);

        $this->postJson("/api/owner/tenants/{$tenant->id}/rental-bills", [
            'room_assignment_id' => $assignment->id,
            'rental_period_start' => '2025-02-01',
            'rental_period_end' => '2025-02-28',
            'due_date' => '2025-02-05',
        ])->assertCreated()
            ->assertJsonPath('data.amount', '1550.00')
            ->assertJsonPath('data.billable_days', 14)
            ->assertJsonPath('data.days_in_month', 28);
    }

    public function test_prorated_bill_uses_31_day_calendar_month_and_half_up_rounding(): void
    {
        $owner = $this->createOwner();
        $tenant = $this->createTenant($owner);
        $assignment = $this->createAssignment(
            $tenant,
            ['move_in_date' => '2027-01-16'],
            ['billing_policy' => 'prorated']
        );
        Sanctum::actingAs($owner);

        $this->postJson("/api/owner/tenants/{$tenant->id}/rental-bills", [
            'room_assignment_id' => $assignment->id,
            'rental_period_start' => '2027-01-01',
            'rental_period_end' => '2027-01-31',
            'due_date' => '2027-01-05',
        ])->assertCreated()
            ->assertJsonPath('data.amount', '2580.65')
            ->assertJsonPath('data.billable_days', 16)
            ->assertJsonPath('data.days_in_month', 31);
    }

    public function test_prorated_bill_counts_a_one_day_assignment_overlap_inclusively(): void
    {
        $owner = $this->createOwner();
        $tenant = $this->createTenant($owner);
        $assignment = $this->createAssignment(
            $tenant,
            ['move_in_date' => '2026-11-30'],
            ['billing_policy' => 'prorated']
        );
        Sanctum::actingAs($owner);

        $this->postJson("/api/owner/tenants/{$tenant->id}/rental-bills", [
            'room_assignment_id' => $assignment->id,
            'rental_period_start' => '2026-11-01',
            'rental_period_end' => '2026-11-30',
            'due_date' => '2026-11-05',
        ])->assertCreated()
            ->assertJsonPath('data.amount', '166.67')
            ->assertJsonPath('data.billable_days', 1)
            ->assertJsonPath('data.days_in_month', 30);
    }

    public function test_assignment_without_month_overlap_is_rejected(): void
    {
        $owner = $this->createOwner();
        $tenant = $this->createTenant($owner);
        $assignment = $this->createAssignment(
            $tenant,
            ['move_in_date' => '2026-12-01'],
            ['billing_policy' => 'prorated']
        );
        Sanctum::actingAs($owner);

        $this->postJson("/api/owner/tenants/{$tenant->id}/rental-bills", [
            'room_assignment_id' => $assignment->id,
            'rental_period_start' => '2026-11-01',
            'rental_period_end' => '2026-11-30',
            'due_date' => '2026-11-05',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['room_assignment_id']);

        $this->assertDatabaseCount('rental_bills', 0);
    }

    public function test_bill_creation_rejects_an_unsupported_boarding_house_policy(): void
    {
        $owner = $this->createOwner();
        $tenant = $this->createTenant($owner);
        $assignment = $this->createAssignment(
            $tenant,
            [],
            ['billing_policy' => 'unsupported']
        );
        Sanctum::actingAs($owner);

        $this->postJson("/api/owner/tenants/{$tenant->id}/rental-bills", [
            'room_assignment_id' => $assignment->id,
            'rental_period_start' => '2026-11-01',
            'rental_period_end' => '2026-11-30',
            'due_date' => '2026-11-05',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['billing_policy']);

        $this->assertDatabaseCount('rental_bills', 0);
    }

    public function test_existing_bill_amount_and_legacy_snapshots_are_not_changed(): void
    {
        $owner = $this->createOwner();
        $tenant = $this->createTenant($owner);
        $assignment = $this->createAssignment($tenant);
        $existingBill = $this->createBill($assignment, [
            'amount' => '4321.09',
            'rental_period_start' => '2026-10-01',
            'rental_period_end' => '2026-10-31',
        ]);
        $assignment->boardingHouseRoom->boardingHouse->update([
            'billing_policy' => 'prorated',
        ]);
        Sanctum::actingAs($owner);

        $this->postJson("/api/owner/tenants/{$tenant->id}/rental-bills", [
            'room_assignment_id' => $assignment->id,
            'rental_period_start' => '2026-11-01',
            'rental_period_end' => '2026-11-30',
            'due_date' => '2026-11-05',
        ])->assertCreated();

        $this->assertDatabaseHas('rental_bills', [
            'id' => $existingBill->id,
            'amount' => '4321.09',
            'billing_policy' => null,
            'monthly_rent_snapshot' => null,
            'billable_days' => null,
            'days_in_month' => null,
        ]);
    }

    public function test_duplicate_bill_for_an_assignment_and_month_is_rejected(): void
    {
        $owner = $this->createOwner();
        $tenant = $this->createTenant($owner);
        $assignment = $this->createAssignment($tenant);
        Sanctum::actingAs($owner);
        $payload = $this->billPayload($assignment);

        $this->postJson("/api/owner/tenants/{$tenant->id}/rental-bills", $payload)
            ->assertCreated();
        $this->postJson("/api/owner/tenants/{$tenant->id}/rental-bills", $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['rental_period_start']);

        $this->assertDatabaseCount('rental_bills', 1);
    }

    public function test_bill_routes_require_an_owner_and_scope_bills_to_their_tenants(): void
    {
        $owner = $this->createOwner();
        $otherOwner = $this->createOwner();
        $tenant = $this->createTenant($otherOwner);
        $assignment = $this->createAssignment($tenant);
        $bill = $this->createBill($assignment);
        $payment = $this->createPayment($owner, $bill);

        $this->getJson('/api/owner/rental-bills')->assertUnauthorized();

        Sanctum::actingAs(User::factory()->create(['role' => 'student']));
        $this->getJson('/api/owner/rental-bills')->assertForbidden();
        $this->getJson("/api/owner/rental-bills/{$bill->id}")->assertForbidden();

        Sanctum::actingAs($owner);
        $this->getJson('/api/owner/rental-bills')
            ->assertOk()
            ->assertJsonPath('data.total', 0);
        $this->getJson("/api/owner/rental-bills/{$bill->id}")->assertNotFound();
        $this->postJson("/api/owner/rental-bills/{$bill->id}/payments", [
            'amount' => '100.00',
            'payment_date' => '2026-11-08',
        ])->assertNotFound();
        $this->patchJson("/api/owner/rental-payments/{$payment->id}/void", [
            'reason' => 'Incorrect entry',
        ])->assertNotFound();
        $this->postJson("/api/owner/tenants/{$tenant->id}/rental-bills", [
            ...$this->billPayload($assignment),
        ])->assertNotFound();
    }

    public function test_partial_and_full_payments_update_the_remaining_balance(): void
    {
        $owner = $this->createOwner();
        $assignment = $this->createAssignment($this->createTenant($owner));
        $bill = $this->createBill($assignment, ['amount' => '5000.00']);
        Sanctum::actingAs($owner);

        $this->postJson("/api/owner/rental-bills/{$bill->id}/payments", [
            'amount' => '1800.00',
            'payment_date' => '2026-11-08',
        ])->assertCreated()
            ->assertJsonPath('data.amount_paid', '1800.00')
            ->assertJsonPath('data.balance', '3200.00')
            ->assertJsonPath('data.payment_status', 'overdue');

        $this->postJson("/api/owner/rental-bills/{$bill->id}/payments", [
            'amount' => '3200.00',
            'payment_date' => '2026-11-08',
        ])->assertCreated()
            ->assertJsonPath('data.amount_paid', '5000.00')
            ->assertJsonPath('data.balance', '0.00')
            ->assertJsonPath('data.payment_status', 'paid');
    }

    public function test_daily_late_fee_respects_zero_fee_and_grace_period(): void
    {
        Carbon::setTestNow('2026-11-10 12:00:00');
        try {
            $owner = $this->createOwner();
            $assignment = $this->createAssignment($this->createTenant($owner));
            $noFee = $this->createBill($assignment, [
                'amount' => '100.00',
                'due_date' => '2026-11-05',
                'daily_late_fee_snapshot' => '0.00',
            ]);
            $graceBill = $this->createBill($assignment, [
                'amount' => '100.00',
                'rental_period_start' => '2026-10-01',
                'rental_period_end' => '2026-10-31',
                'due_date' => '2026-11-05',
                'daily_late_fee_snapshot' => '10.00',
                'grace_period_days_snapshot' => 2,
            ]);
            Sanctum::actingAs($owner);

            $this->getJson("/api/owner/rental-bills/{$noFee->id}")
                ->assertOk()
                ->assertJsonPath('data.overdue_days', 5)
                ->assertJsonPath('data.accumulated_late_fee', '0.00')
                ->assertJsonPath('data.total_outstanding', '100.00');
            $this->getJson("/api/owner/rental-bills/{$graceBill->id}")
                ->assertOk()
                ->assertJsonPath('data.overdue_days', 3)
                ->assertJsonPath('data.accumulated_late_fee', '30.00')
                ->assertJsonPath('data.total_outstanding', '130.00');
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_fee_starts_on_first_chargeable_day_and_accumulates_per_calendar_day(): void
    {
        Carbon::setTestNow('2026-11-08 12:00:00');
        try {
            $owner = $this->createOwner();
            $bill = $this->createBill(
                $this->createAssignment($this->createTenant($owner)),
                [
                    'amount' => '100.00',
                    'due_date' => '2026-11-05',
                    'daily_late_fee_snapshot' => '10.00',
                ]
            );
            Sanctum::actingAs($owner);

            $this->getJson("/api/owner/rental-bills/{$bill->id}")
                ->assertOk()
                ->assertJsonPath('data.overdue_days', 3)
                ->assertJsonPath('data.accumulated_late_fee', '30.00')
                ->assertJsonPath('data.total_outstanding', '130.00');
            $this->getJson("/api/owner/rental-bills/{$bill->id}")
                ->assertOk()
                ->assertJsonPath('data.accumulated_late_fee', '30.00')
                ->assertJsonPath('data.total_outstanding', '130.00');
            $this->assertDatabaseCount('rental_bills', 1);
            $this->assertDatabaseCount('rental_payments', 0);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_same_day_payments_are_applied_after_that_days_fee_and_do_not_stop_fees_while_partial(): void
    {
        Carbon::setTestNow('2026-11-06 12:00:00');
        try {
            $owner = $this->createOwner();
            $bill = $this->createBill(
                $this->createAssignment($this->createTenant($owner)),
                [
                    'amount' => '100.00',
                    'due_date' => '2026-11-05',
                    'daily_late_fee_snapshot' => '10.00',
                ]
            );
            $this->createPayment($owner, $bill, [
                'amount' => '20.00',
                'payment_date' => '2026-11-06',
            ]);
            $this->createPayment($owner, $bill, [
                'amount' => '30.00',
                'payment_date' => '2026-11-06',
            ]);
            Sanctum::actingAs($owner);

            $this->getJson("/api/owner/rental-bills/{$bill->id}")
                ->assertOk()
                ->assertJsonPath('data.total_payments', '50.00')
                ->assertJsonPath('data.overdue_days', 1)
                ->assertJsonPath('data.accumulated_late_fee', '10.00')
                ->assertJsonPath('data.remaining_balance', '50.00')
                ->assertJsonPath('data.total_outstanding', '60.00');

            Carbon::setTestNow('2026-11-08 12:00:00');
            $this->getJson("/api/owner/rental-bills/{$bill->id}")
                ->assertOk()
                ->assertJsonPath('data.overdue_days', 3)
                ->assertJsonPath('data.accumulated_late_fee', '30.00')
                ->assertJsonPath('data.total_outstanding', '80.00');
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_full_payment_including_fees_stops_future_fee_accrual(): void
    {
        Carbon::setTestNow('2026-11-06 12:00:00');
        try {
            $owner = $this->createOwner();
            $bill = $this->createBill(
                $this->createAssignment($this->createTenant($owner)),
                [
                    'amount' => '100.00',
                    'due_date' => '2026-11-05',
                    'daily_late_fee_snapshot' => '10.00',
                ]
            );
            Sanctum::actingAs($owner);

            $this->postJson("/api/owner/rental-bills/{$bill->id}/payments", [
                'amount' => '110.00',
                'payment_date' => '2026-11-06',
            ])->assertCreated()
                ->assertJsonPath('data.total_outstanding', '0.00')
                ->assertJsonPath('data.accumulated_late_fee', '10.00');

            Carbon::setTestNow('2026-11-10 12:00:00');
            $this->getJson("/api/owner/rental-bills/{$bill->id}")
                ->assertOk()
                ->assertJsonPath('data.overdue_days', 1)
                ->assertJsonPath('data.accumulated_late_fee', '10.00')
                ->assertJsonPath('data.total_outstanding', '0.00');
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_payment_on_first_overdue_day_is_capped_by_rent_plus_that_days_fee(): void
    {
        Carbon::setTestNow('2026-11-06 12:00:00');
        try {
            $owner = $this->createOwner();
            $bill = $this->createBill(
                $this->createAssignment($this->createTenant($owner)),
                [
                    'amount' => '100.00',
                    'due_date' => '2026-11-05',
                    'daily_late_fee_snapshot' => '10.00',
                ]
            );
            Sanctum::actingAs($owner);

            $this->postJson("/api/owner/rental-bills/{$bill->id}/payments", [
                'amount' => '111.00',
                'payment_date' => '2026-11-06',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['amount']);
            $this->postJson("/api/owner/rental-bills/{$bill->id}/payments", [
                'amount' => '110.00',
                'payment_date' => '2026-11-06',
            ])->assertCreated()
                ->assertJsonPath('data.total_outstanding', '0.00');
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_voiding_payment_restores_rent_and_fee_outstanding(): void
    {
        Carbon::setTestNow('2026-11-08 12:00:00');
        try {
            $owner = $this->createOwner();
            $bill = $this->createBill(
                $this->createAssignment($this->createTenant($owner)),
                [
                    'amount' => '100.00',
                    'due_date' => '2026-11-05',
                    'daily_late_fee_snapshot' => '10.00',
                ]
            );
            $payment = $this->createPayment($owner, $bill, [
                'amount' => '50.00',
                'payment_date' => '2026-11-06',
            ]);
            Sanctum::actingAs($owner);

            $this->patchJson("/api/owner/rental-payments/{$payment->id}/void", [
                'reason' => 'Incorrect payment.',
            ])->assertOk()
                ->assertJsonPath('bill.total_payments', '0.00')
                ->assertJsonPath('bill.overdue_days', 3)
                ->assertJsonPath('bill.accumulated_late_fee', '30.00')
                ->assertJsonPath('bill.total_outstanding', '130.00');
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_future_dated_partial_payment_is_not_effective_until_its_date(): void
    {
        Carbon::setTestNow('2026-11-06 12:00:00');
        try {
            $owner = $this->createOwner();
            $bill = $this->createBill(
                $this->createAssignment($this->createTenant($owner)),
                [
                    'amount' => '100.00',
                    'due_date' => '2026-11-05',
                    'daily_late_fee_snapshot' => '10.00',
                ]
            );
            Sanctum::actingAs($owner);

            $this->postJson("/api/owner/rental-bills/{$bill->id}/payments", [
                'amount' => '50.00',
                'payment_date' => '2026-11-08',
            ])->assertCreated()
                ->assertJsonPath('payment.is_future_dated', true)
                ->assertJsonPath('data.total_payments', '0.00')
                ->assertJsonPath('data.future_dated_payment_total', '50.00')
                ->assertJsonPath('data.total_outstanding', '110.00');

            Carbon::setTestNow('2026-11-08 12:00:00');
            $this->getJson("/api/owner/rental-bills/{$bill->id}")
                ->assertOk()
                ->assertJsonPath('data.total_payments', '50.00')
                ->assertJsonPath('data.future_dated_payment_total', '0.00')
                ->assertJsonPath('data.overdue_days', 3)
                ->assertJsonPath('data.total_outstanding', '80.00')
                ->assertJsonPath('data.payments.0.is_future_dated', false);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_future_dated_full_settlement_is_effective_on_the_recorded_date(): void
    {
        Carbon::setTestNow('2026-11-06 12:00:00');
        try {
            $owner = $this->createOwner();
            $bill = $this->createBill(
                $this->createAssignment($this->createTenant($owner)),
                [
                    'amount' => '100.00',
                    'due_date' => '2026-11-05',
                    'daily_late_fee_snapshot' => '10.00',
                ]
            );
            Sanctum::actingAs($owner);

            $this->postJson("/api/owner/rental-bills/{$bill->id}/payments", [
                'amount' => '130.00',
                'payment_date' => '2026-11-08',
            ])->assertCreated()
                ->assertJsonPath('data.total_payments', '0.00')
                ->assertJsonPath('data.future_dated_payment_total', '130.00')
                ->assertJsonPath('data.total_outstanding', '110.00');

            Carbon::setTestNow('2026-11-08 12:00:00');
            $this->getJson("/api/owner/rental-bills/{$bill->id}")
                ->assertOk()
                ->assertJsonPath('data.total_payments', '130.00')
                ->assertJsonPath('data.accumulated_late_fee', '30.00')
                ->assertJsonPath('data.total_outstanding', '0.00');

            Carbon::setTestNow('2026-11-10 12:00:00');
            $this->getJson("/api/owner/rental-bills/{$bill->id}")
                ->assertOk()
                ->assertJsonPath('data.overdue_days', 3)
                ->assertJsonPath('data.accumulated_late_fee', '30.00')
                ->assertJsonPath('data.total_outstanding', '0.00');
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_voiding_future_dated_payment_removes_it_from_scheduled_totals(): void
    {
        Carbon::setTestNow('2026-11-06 12:00:00');
        try {
            $owner = $this->createOwner();
            $bill = $this->createBill(
                $this->createAssignment($this->createTenant($owner)),
                [
                    'amount' => '100.00',
                    'due_date' => '2026-11-05',
                    'daily_late_fee_snapshot' => '10.00',
                ]
            );
            $payment = $this->createPayment($owner, $bill, [
                'amount' => '50.00',
                'payment_date' => '2026-11-08',
            ]);
            Sanctum::actingAs($owner);

            $this->patchJson("/api/owner/rental-payments/{$payment->id}/void", [
                'reason' => 'Scheduled in error.',
            ])->assertOk()
                ->assertJsonPath('bill.future_dated_payment_total', '0.00')
                ->assertJsonPath('bill.total_payments', '0.00')
                ->assertJsonPath('bill.total_outstanding', '110.00')
                ->assertJsonPath('data.is_future_dated', true);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_legacy_bill_has_no_retroactive_late_fees_and_new_bill_keeps_snapshots(): void
    {
        Carbon::setTestNow('2026-11-10 12:00:00');
        try {
            $owner = $this->createOwner();
            $assignment = $this->createAssignment(
                $this->createTenant($owner),
                [],
                ['late_payment_fee' => '25.00', 'grace_period_days' => 3]
            );
            $legacyBill = $this->createBill($assignment, [
                'amount' => '100.00',
                'due_date' => '2026-11-05',
            ]);
            Sanctum::actingAs($owner);

            $this->getJson("/api/owner/rental-bills/{$legacyBill->id}")
                ->assertOk()
                ->assertJsonPath('data.daily_late_fee_snapshot', null)
                ->assertJsonPath('data.grace_period_days_snapshot', null)
                ->assertJsonPath('data.accumulated_late_fee', '0.00')
                ->assertJsonPath('data.total_outstanding', '100.00');
            $this->getJson("/api/owner/rental-bills/{$legacyBill->id}")
                ->assertJsonPath('data.overdue_days', 5);

            $assignment->boardingHouseRoom->boardingHouse->update([
                'late_payment_fee' => '99.00',
                'grace_period_days' => 0,
            ]);
            $creation = $this->postJson(
                "/api/owner/tenants/{$assignment->tenant_id}/rental-bills",
                [
                    'room_assignment_id' => $assignment->id,
                    'rental_period_start' => '2026-10-01',
                    'rental_period_end' => '2026-10-31',
                    'due_date' => '2026-11-05',
                ]
            )->assertCreated()
                ->assertJsonPath('data.daily_late_fee_snapshot', '99.00')
                ->assertJsonPath('data.grace_period_days_snapshot', 0);
            $newBillId = $creation->json('data.id');
            $assignment->boardingHouseRoom->boardingHouse->update([
                'late_payment_fee' => '0.00',
                'grace_period_days' => 10,
            ]);

            $this->getJson("/api/owner/rental-bills/{$newBillId}")
                ->assertOk()
                ->assertJsonPath('data.daily_late_fee_snapshot', '99.00')
                ->assertJsonPath('data.grace_period_days_snapshot', 0)
                ->assertJsonPath('data.accumulated_late_fee', '495.00');
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_all_four_payment_statuses_are_calculated_dynamically(): void
    {
        Carbon::setTestNow('2026-11-15 12:00:00');
        try {
            $owner = $this->createOwner();
            $assignment = $this->createAssignment($this->createTenant($owner));
            $overdue = $this->createBill($assignment, [
                'amount' => '1000.00',
                'rental_period_start' => '2026-08-01',
                'rental_period_end' => '2026-08-31',
                'due_date' => '2026-09-05',
            ]);
            $paid = $this->createBill($assignment, [
                'amount' => '1000.00',
                'rental_period_start' => '2026-09-01',
                'rental_period_end' => '2026-09-30',
                'due_date' => '2026-10-05',
            ]);
            $partial = $this->createBill($assignment, [
                'amount' => '1000.00',
                'rental_period_start' => '2026-10-01',
                'rental_period_end' => '2026-10-31',
                'due_date' => '2026-11-30',
            ]);
            $unpaid = $this->createBill($assignment, [
                'amount' => '1000.00',
                'rental_period_start' => '2026-11-01',
                'rental_period_end' => '2026-11-30',
                'due_date' => '2026-12-05',
            ]);
            $this->createPayment($owner, $paid, ['amount' => '1000.00']);
            $this->createPayment($owner, $partial, ['amount' => '250.00']);
            Sanctum::actingAs($owner);

            $statuses = $this->getJson('/api/owner/rental-bills?per_page=100')
                ->assertOk()
                ->json('data.data');

            $this->assertSame('overdue', $this->statusFor($statuses, $overdue->id));
            $this->assertSame('paid', $this->statusFor($statuses, $paid->id));
            $this->assertSame('partially_paid', $this->statusFor($statuses, $partial->id));
            $this->assertSame('unpaid', $this->statusFor($statuses, $unpaid->id));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_payment_cannot_exceed_balance_or_be_recorded_after_full_payment(): void
    {
        $owner = $this->createOwner();
        $bill = $this->createBill($this->createAssignment($this->createTenant($owner)), [
            'amount' => '100.00',
        ]);
        Sanctum::actingAs($owner);

        $this->postJson("/api/owner/rental-bills/{$bill->id}/payments", [
            'amount' => '100.01',
            'payment_date' => '2026-11-08',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['amount']);

        $this->postJson("/api/owner/rental-bills/{$bill->id}/payments", [
            'amount' => '100.00',
            'payment_date' => '2026-11-08',
        ])->assertCreated();
        $this->postJson("/api/owner/rental-bills/{$bill->id}/payments", [
            'amount' => '0.01',
            'payment_date' => '2026-11-08',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['bill']);
    }

    public function test_voiding_payment_preserves_its_audit_and_restores_the_bill_balance(): void
    {
        $owner = $this->createOwner();
        $bill = $this->createBill($this->createAssignment($this->createTenant($owner)), [
            'amount' => '1000.00',
            'due_date' => '2026-12-05',
        ]);
        $payment = $this->createPayment($owner, $bill, ['amount' => '600.00']);
        Sanctum::actingAs($owner);

        $this->patchJson("/api/owner/rental-payments/{$payment->id}/void", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['reason']);

        $this->patchJson("/api/owner/rental-payments/{$payment->id}/void", [
            'reason' => 'Entered against the wrong tenant.',
        ])->assertOk()
            ->assertJsonPath('data.id', $payment->id)
            ->assertJsonPath('data.void_reason', 'Entered against the wrong tenant.')
            ->assertJsonPath('bill.amount_paid', '0.00')
            ->assertJsonPath('bill.balance', '1000.00')
            ->assertJsonPath('bill.payment_status', 'unpaid');

        $this->assertDatabaseHas('rental_payments', [
            'id' => $payment->id,
            'amount' => '600.00',
            'void_reason' => 'Entered against the wrong tenant.',
            'voided_by' => $owner->id,
        ]);
        $this->patchJson("/api/owner/rental-payments/{$payment->id}/void", [
            'reason' => 'Second attempt.',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['payment']);
    }

    public function test_historical_bill_remains_attached_to_original_assignment_after_transfer_and_move_out(): void
    {
        $owner = $this->createOwner();
        $tenant = $this->createTenant($owner);
        $assignment = $this->createAssignment($tenant);
        $bill = $this->createBill($assignment, [
            'rental_period_start' => '2026-11-01',
            'rental_period_end' => '2026-11-30',
        ]);
        $destination = $this->createRoom($assignment->boardingHouseRoom->boardingHouse, '102');
        Sanctum::actingAs($owner);

        $this->postJson("/api/owner/tenants/{$tenant->id}/transfer", [
            'boarding_house_room_id' => $destination->id,
            'move_in_date' => '2026-11-10',
        ])->assertCreated();
        $this->patchJson("/api/owner/tenants/{$tenant->id}/move-out")
            ->assertOk();

        $this->getJson("/api/owner/rental-bills/{$bill->id}")
            ->assertOk()
            ->assertJsonPath('data.room_assignment_id', $assignment->id)
            ->assertJsonPath('data.room_assignment.status', 'moved_out')
            ->assertJsonPath(
                'data.room_assignment.boarding_house_room.room_number',
                '101'
            );
        $this->assertDatabaseHas('rental_bills', [
            'id' => $bill->id,
            'room_assignment_id' => $assignment->id,
        ]);
    }

    public function test_transfer_date_is_counted_only_for_the_new_assignment_in_prorated_bills(): void
    {
        $owner = $this->createOwner();
        $tenant = $this->createTenant($owner);
        $assignment = $this->createAssignment(
            $tenant,
            ['move_in_date' => '2026-10-01'],
            ['billing_policy' => 'prorated']
        );
        $destination = $this->createRoom(
            $assignment->boardingHouseRoom->boardingHouse,
            '102'
        );
        Sanctum::actingAs($owner);

        $transferResponse = $this->postJson("/api/owner/tenants/{$tenant->id}/transfer", [
            'boarding_house_room_id' => $destination->id,
            'move_in_date' => '2026-11-15',
        ])->assertCreated();
        $newAssignmentId = $transferResponse->json('data.id');

        $this->postJson("/api/owner/tenants/{$tenant->id}/rental-bills", [
            'room_assignment_id' => $assignment->id,
            'rental_period_start' => '2026-11-01',
            'rental_period_end' => '2026-11-30',
            'due_date' => '2026-11-05',
        ])->assertCreated()
            ->assertJsonPath('data.amount', '2333.33')
            ->assertJsonPath('data.billable_days', 14);

        $this->postJson("/api/owner/tenants/{$tenant->id}/rental-bills", [
            'room_assignment_id' => $newAssignmentId,
            'rental_period_start' => '2026-11-01',
            'rental_period_end' => '2026-11-30',
            'due_date' => '2026-11-05',
        ])->assertCreated()
            ->assertJsonPath('data.amount', '2666.67')
            ->assertJsonPath('data.billable_days', 16);
    }

    public function test_invalid_amount_period_and_assignment_are_rejected(): void
    {
        $owner = $this->createOwner();
        $tenant = $this->createTenant($owner);
        $assignment = $this->createAssignment($tenant);
        $bill = $this->createBill($assignment);
        Sanctum::actingAs($owner);

        $this->postJson("/api/owner/tenants/{$tenant->id}/rental-bills", [
            ...$this->billPayload($assignment),
            'rental_period_start' => '2026-11-02',
            'rental_period_end' => '2026-11-30',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['rental_period_start']);
        $this->postJson("/api/owner/tenants/{$tenant->id}/rental-bills", [
            ...$this->billPayload($assignment),
            'room_assignment_id' => 999999,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['room_assignment_id']);
        $this->postJson("/api/owner/rental-bills/{$bill->id}/payments", [
            'amount' => '-1.00',
            'payment_date' => 'not-a-date',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['amount', 'payment_date']);
    }

    public function test_payments_are_rejected_for_a_voided_bill(): void
    {
        $owner = $this->createOwner();
        $bill = $this->createBill(
            $this->createAssignment($this->createTenant($owner)),
            ['amount' => '100.00']
        );
        $bill->forceFill([
            'voided_at' => now(),
            'void_reason' => 'Bill created in error.',
            'voided_by' => $owner->id,
        ])->save();
        Sanctum::actingAs($owner);

        $this->postJson("/api/owner/rental-bills/{$bill->id}/payments", [
            'amount' => '10.00',
            'payment_date' => '2026-11-08',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['bill']);

        $this->assertDatabaseCount('rental_payments', 0);
    }

    private function createOwner(): User
    {
        return User::factory()->create(['role' => 'owner', 'status' => 'active']);
    }

    private function createTenant(User $owner): Tenant
    {
        return Tenant::create([
            'owner_id' => $owner->id,
            'full_name' => 'Rental Test Tenant',
            'contact_number' => '09171234567',
        ]);
    }

    private function createAssignment(
        Tenant $tenant,
        array $attributes = [],
        array $boardingHouseAttributes = []
    ): RoomAssignment
    {
        $house = Boardinghouse::create([
            'owner_id' => $tenant->owner_id,
            'name' => 'Rental Test House',
            'city' => 'Tagum City',
            'address' => '1 Test Street',
            'monthly_rent' => 5000,
            'available_rooms' => 1,
            'total_rooms' => 1,
            'status' => 'approved',
            ...$boardingHouseAttributes,
        ]);
        $room = $this->createRoom($house);

        return $tenant->assignments()->create([
            'boarding_house_room_id' => $room->id,
            'move_in_date' => '2026-01-01',
            'monthly_rent' => '5000.00',
            'status' => 'active',
            ...$attributes,
        ]);
    }

    private function createRoom(Boardinghouse $house, string $roomNumber = '101'): BoardinghouseRoom
    {
        return $house->rooms()->create([
            'room_number' => $roomNumber,
            'room_type' => 'Single Room',
            'monthly_rent' => '5000.00',
            'pricing_basis' => 'per_person',
            'max_occupants' => 1,
            'availability_status' => 'available',
        ]);
    }

    private function createBill(RoomAssignment $assignment, array $attributes = []): RentalBill
    {
        return $assignment->rentalBills()->create([
            'amount' => '5000.00',
            ...$this->billPayload($assignment),
            ...$attributes,
        ]);
    }

    private function billPayload(RoomAssignment $assignment): array
    {
        return [
            'room_assignment_id' => $assignment->id,
            'rental_period_start' => '2026-11-01',
            'rental_period_end' => '2026-11-30',
            'due_date' => '2026-11-05',
        ];
    }

    private function createPayment(
        User $owner,
        RentalBill $bill,
        array $attributes = []
    ): RentalPayment {
        return $bill->payments()->create([
            'amount' => '100.00',
            'payment_date' => '2026-11-08',
            'recorded_by' => $owner->id,
            ...$attributes,
        ]);
    }

    private function statusFor(array $bills, int $billId): ?string
    {
        foreach ($bills as $bill) {
            if ($bill['id'] === $billId) {
                return $bill['payment_status'];
            }
        }

        return null;
    }
}
