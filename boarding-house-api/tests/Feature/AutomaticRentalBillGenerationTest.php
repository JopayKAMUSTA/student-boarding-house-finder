<?php

namespace Tests\Feature;

use App\Models\Boardinghouse;
use App\Models\RentalBill;
use App\Models\RoomAssignment;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AutomaticRentalBillGenerationTest extends TestCase
{
    use RefreshDatabase;

    public function test_command_generates_bills_for_multiple_eligible_tenants_and_is_idempotent(): void
    {
        Carbon::setTestNow('2026-11-11 20:00:00');
        try {
            $owner = $this->createOwner();
            $first = $this->createAssignment($owner, ['monthly_rent' => '4500.00']);
            $second = $this->createAssignment($owner, ['monthly_rent' => '5200.00']);

            $this->runMonth();
            $this->assertDatabaseCount('rental_bills', 2);
            $this->assertDatabaseHas('rental_bills', [
                'room_assignment_id' => $first->id,
                'amount' => '4500.00',
                'due_date' => '2026-12-10 00:00:00',
            ]);
            $this->assertDatabaseHas('rental_bills', [
                'room_assignment_id' => $second->id,
                'amount' => '5200.00',
                'due_date' => '2026-12-10 00:00:00',
            ]);

            $this->runMonth();
            $this->assertDatabaseCount('rental_bills', 2);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_command_preserves_full_monthly_and_prorated_amount_rules(): void
    {
        Carbon::setTestNow('2026-11-11 20:00:00');
        try {
            $owner = $this->createOwner();
            $fullMonthly = $this->createAssignment($owner, [
                'monthly_rent' => '3000.00',
                'move_in_date' => '2026-11-10',
            ]);
            $prorated = $this->createAssignment(
                $owner,
                [
                    'monthly_rent' => '3000.00',
                    'move_in_date' => '2026-11-10',
                ],
                ['billing_policy' => 'prorated']
            );

            $this->runMonth();

            $this->assertDatabaseHas('rental_bills', [
                'room_assignment_id' => $fullMonthly->id,
                'amount' => '3000.00',
                'billing_policy' => 'full_monthly',
                'billable_days' => 21,
            ]);
            $this->assertDatabaseHas('rental_bills', [
                'room_assignment_id' => $prorated->id,
                'amount' => '2100.00',
                'billing_policy' => 'prorated',
                'billable_days' => 21,
                'days_in_month' => 30,
            ]);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_command_includes_moved_out_assignment_that_overlapped_and_excludes_non_overlaps(): void
    {
        Carbon::setTestNow('2026-11-11 20:00:00');
        try {
            $owner = $this->createOwner();
            $movedOut = $this->createAssignment($owner, [
                'move_in_date' => '2026-11-01',
                'move_out_date' => '2026-11-09',
                'status' => 'moved_out',
            ], ['billing_policy' => 'prorated']);
            $outsideMonth = $this->createAssignment($owner, [
                'move_in_date' => '2026-12-01',
            ]);
            $this->runMonth();

            $this->assertDatabaseHas('rental_bills', [
                'room_assignment_id' => $movedOut->id,
                'amount' => '1500.00',
                'billable_days' => 9,
            ]);
            $this->assertDatabaseMissing('rental_bills', [
                'room_assignment_id' => $outsideMonth->id,
            ]);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_command_generates_both_sides_of_a_transfer_for_their_overlapping_months(): void
    {
        Carbon::setTestNow('2026-11-11 20:00:00');
        try {
            $owner = $this->createOwner();
            $oldAssignment = $this->createAssignment($owner, [
                'move_in_date' => '2026-10-10',
                'move_out_date' => '2026-11-09',
                'status' => 'moved_out',
            ], ['billing_policy' => 'prorated']);
            $newAssignment = $this->createAssignment($owner, [
                'move_in_date' => '2026-11-10',
            ], ['billing_policy' => 'prorated']);

            $this->runMonth();

            $this->assertDatabaseHas('rental_bills', [
                'room_assignment_id' => $oldAssignment->id,
                'amount' => '1500.00',
                'due_date' => '2026-12-10 00:00:00',
            ]);
            $this->assertDatabaseHas('rental_bills', [
                'room_assignment_id' => $newAssignment->id,
                'amount' => '3500.00',
                'due_date' => '2026-12-10 00:00:00',
            ]);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_anniversary_due_date_clamps_to_last_day_of_short_month(): void
    {
        Carbon::setTestNow('2027-01-02 20:00:00');
        try {
            $owner = $this->createOwner();
            $assignment = $this->createAssignment($owner, [
                'move_in_date' => '2026-01-31',
            ]);

            Artisan::call('rental-bills:generate-monthly', ['--month' => '2027-01']);

            $this->assertDatabaseHas('rental_bills', [
                'room_assignment_id' => $assignment->id,
                'due_date' => '2027-02-28 00:00:00',
            ]);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_command_snapshots_policy_rent_and_late_fee_settings_without_changing_existing_bills(): void
    {
        Carbon::setTestNow('2026-11-11 20:00:00');
        try {
            $owner = $this->createOwner();
            $assignmentWithHistory = $this->createAssignment($owner);
            $existingBill = $assignmentWithHistory->rentalBills()->create([
                'amount' => '123.45',
                'rental_period_start' => '2026-11-01',
                'rental_period_end' => '2026-11-30',
                'due_date' => '2026-12-10',
            ]);
            $assignment = $this->createAssignment(
                $owner,
                ['monthly_rent' => '3000.00'],
                [
                    'billing_policy' => 'prorated',
                    'late_payment_fee' => '15.00',
                    'grace_period_days' => 2,
                ]
            );
            $this->runMonth();
            $this->assertDatabaseHas('rental_bills', [
                'id' => $existingBill->id,
                'amount' => '123.45',
                'billing_policy' => null,
            ]);

            $this->runMonth();
            $generated = RentalBill::query()
                ->where('room_assignment_id', $assignment->id)
                ->firstOrFail();
            $this->assertSame('prorated', $generated->billing_policy);
            $this->assertSame('3000.00', $generated->monthly_rent_snapshot);
            $this->assertSame('15.00', $generated->daily_late_fee_snapshot);
            $this->assertSame(2, $generated->grace_period_days_snapshot);
            $this->assertDatabaseHas('rental_bills', [
                'id' => $existingBill->id,
                'amount' => '123.45',
                'billing_policy' => null,
            ]);

            $assignment->update(['monthly_rent' => '4000.00']);
            $assignment->boardingHouseRoom->boardingHouse->update([
                'billing_policy' => 'full_monthly',
                'late_payment_fee' => '0.00',
                'grace_period_days' => 0,
            ]);
            $this->runMonth();
            $generated->refresh();
            $this->assertSame('3000.00', $generated->amount);
            $this->assertSame('prorated', $generated->billing_policy);
            $this->assertSame('3000.00', $generated->monthly_rent_snapshot);
            $this->assertSame('15.00', $generated->daily_late_fee_snapshot);
            $this->assertSame(2, $generated->grace_period_days_snapshot);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_command_rejects_future_months_and_owner_status_is_scoped(): void
    {
        Carbon::setTestNow('2026-11-11 20:00:00');
        try {
            $owner = $this->createOwner();
            $otherOwner = $this->createOwner();
            $this->createAssignment($owner);
            $this->createAssignment($otherOwner);
            $this->assertSame(
                1,
                Artisan::call('rental-bills:generate-monthly', ['--month' => '2026-12'])
            );

            $this->runMonth();
            Sanctum::actingAs($owner);
            $this->getJson('/api/owner/rental-bills/generation-status?month=2026-11')
                ->assertOk()
                ->assertJsonPath('data.eligible_assignments', 1)
                ->assertJsonPath('data.generated_bills', 1)
                ->assertJsonPath('data.missing_bills', 0)
                ->assertJsonPath('data.status', 'complete');
        } finally {
            Carbon::setTestNow();
        }
    }

    private function runMonth(): void
    {
        $this->assertSame(
            0,
            Artisan::call('rental-bills:generate-monthly', ['--month' => '2026-11'])
        );
    }

    private function createOwner(): User
    {
        return User::factory()->create(['role' => 'owner', 'status' => 'active']);
    }

    private function createAssignment(
        User $owner,
        array $assignmentAttributes = [],
        array $houseAttributes = []
    ): RoomAssignment {
        $tenant = Tenant::create([
            'owner_id' => $owner->id,
            'full_name' => 'Automatic Billing Tenant',
            'contact_number' => '09171234567',
        ]);
        $house = Boardinghouse::create([
            'owner_id' => $owner->id,
            'name' => 'Automatic Billing House',
            'city' => 'Tagum City',
            'address' => '1 Test Street',
            'monthly_rent' => '5000.00',
            'available_rooms' => 1,
            'total_rooms' => 1,
            'status' => 'approved',
            'billing_policy' => 'full_monthly',
            ...$houseAttributes,
        ]);
        $room = $house->rooms()->create([
            'room_number' => '101',
            'room_type' => 'Single Room',
            'monthly_rent' => '5000.00',
            'pricing_basis' => 'per_person',
            'max_occupants' => 1,
            'availability_status' => 'available',
        ]);

        return $tenant->assignments()->create([
            'boarding_house_room_id' => $room->id,
            'move_in_date' => '2026-10-10',
            'monthly_rent' => '5000.00',
            'status' => 'active',
            ...$assignmentAttributes,
        ]);
    }
}
