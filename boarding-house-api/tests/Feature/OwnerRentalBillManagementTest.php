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

    public function test_owner_can_create_a_monthly_bill_with_an_assignment_rent_snapshot(): void
    {
        $owner = $this->createOwner();
        $tenant = $this->createTenant($owner);
        $assignment = $this->createAssignment($tenant, ['monthly_rent' => '5100.00']);
        Sanctum::actingAs($owner);

        $response = $this->postJson("/api/owner/tenants/{$tenant->id}/rental-bills", [
            'room_assignment_id' => $assignment->id,
            'amount' => '5100.00',
            'rental_period_start' => '2026-11-01',
            'rental_period_end' => '2026-11-30',
            'due_date' => '2026-11-05',
        ])->assertCreated()
            ->assertJsonPath('data.room_assignment_id', $assignment->id)
            ->assertJsonPath('data.amount', '5100.00')
            ->assertJsonPath('data.payment_status', 'overdue')
            ->assertJsonPath('data.balance', '5100.00');

        $this->assertDatabaseHas('rental_bills', [
            'id' => $response->json('data.id'),
            'room_assignment_id' => $assignment->id,
            'amount' => '5100.00',
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

    public function test_invalid_amount_period_and_assignment_are_rejected(): void
    {
        $owner = $this->createOwner();
        $tenant = $this->createTenant($owner);
        $assignment = $this->createAssignment($tenant);
        $bill = $this->createBill($assignment);
        Sanctum::actingAs($owner);

        $this->postJson("/api/owner/tenants/{$tenant->id}/rental-bills", [
            ...$this->billPayload($assignment),
            'amount' => '0',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['amount']);
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

    private function createAssignment(Tenant $tenant, array $attributes = []): RoomAssignment
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
            ...$this->billPayload($assignment),
            ...$attributes,
        ]);
    }

    private function billPayload(RoomAssignment $assignment): array
    {
        return [
            'room_assignment_id' => $assignment->id,
            'amount' => '5000.00',
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
