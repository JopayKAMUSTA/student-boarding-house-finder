<?php

namespace Tests\Feature;

use App\Models\Boardinghouse;
use App\Models\RentalBill;
use App\Models\RentalPayment;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TenantRentalPaymentReviewTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_submission_is_pending_and_does_not_reduce_bill_balance(): void
    {
        Storage::fake('local');
        $owner = $this->createOwner();
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        [$tenant, $bill] = $this->createBillForStudent($owner, $student);
        Sanctum::actingAs($student);

        $this->post("/api/student/rental-bills/{$bill->id}/payment-submissions", [
            'amount' => '400.00',
            'payment_date' => '2026-11-08',
            'notes' => 'Bank transfer',
            'proof' => UploadedFile::fake()->createWithContent('receipt.pdf', '%PDF-1.4 test proof'),
        ])->assertCreated()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.amount', '400.00')
            ->assertJsonPath('data.submitted_amount', '400.00')
            ->assertJsonPath('data.submitted_payment_date', '2026-11-08')
            ->assertJsonPath('data.payment_date', '2026-11-08')
            ->assertJsonPath('data.recorded_by.id', $student->id);

        $this->assertSame('5000.00', $bill->fresh()->balance);
        $payment = RentalPayment::query()->firstOrFail();
        Storage::disk('local')->assertExists($payment->proof_path);
        $this->getJson("/api/owner/rental-bills/{$bill->id}")
            ->assertForbidden();
    }

    public function test_owner_approves_corrected_amount_with_reason_and_verified_date(): void
    {
        Storage::fake('local');
        $owner = $this->createOwner();
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        [, $bill] = $this->createBillForStudent($owner, $student);
        $payment = $this->submitPayment($student, $bill, '500.00', '2026-11-07');
        Sanctum::actingAs($owner);

        $this->patchJson("/api/owner/rental-payments/{$payment->id}/approve", [
            'amount' => '450.00',
            'payment_date' => '2026-11-08',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['amount_adjustment_reason']);

        Carbon::setTestNow('2026-11-08 12:00:00');
        try {
            $this->patchJson("/api/owner/rental-payments/{$payment->id}/approve", [
                'amount' => '450.00',
                'payment_date' => '2026-11-08',
                'amount_adjustment_reason' => 'Verified receipt was short by ₱50.',
            ])->assertOk()
                ->assertJsonPath('data.status', 'approved')
                ->assertJsonPath('data.amount', '450.00')
                ->assertJsonPath('data.submitted_amount', '500.00')
                ->assertJsonPath('data.submitted_payment_date', '2026-11-07')
                ->assertJsonPath('data.payment_date', '2026-11-08')
                ->assertJsonPath('data.amount_adjustment_reason', 'Verified receipt was short by ₱50.')
                ->assertJsonPath('data.reviewed_by.id', $owner->id)
                ->assertJsonPath('bill.total_payments', '450.00')
                ->assertJsonPath('bill.remaining_balance', '4550.00');
        } finally {
            Carbon::setTestNow();
        }

        $this->assertDatabaseHas('rental_payments', [
            'id' => $payment->id,
            'status' => 'approved',
            'amount' => '450.00',
            'submitted_amount' => '500.00',
            'submitted_payment_date' => '2026-11-07',
            'payment_date' => '2026-11-08',
            'reviewed_by' => $owner->id,
            'amount_adjustment_reason' => 'Verified receipt was short by ₱50.',
        ]);
        $this->patchJson("/api/owner/rental-payments/{$payment->id}/approve", [
            'amount' => '450.00',
            'payment_date' => '2026-11-08',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['payment']);
    }

    public function test_rejected_submission_requires_reason_and_never_counts_as_payment(): void
    {
        $owner = $this->createOwner();
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        [, $bill] = $this->createBillForStudent($owner, $student);
        Storage::fake('local');
        $payment = $this->submitPayment($student, $bill);
        Sanctum::actingAs($owner);

        $this->patchJson("/api/owner/rental-payments/{$payment->id}/reject", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['reason']);

        $this->patchJson("/api/owner/rental-payments/{$payment->id}/reject", [
            'reason' => 'The receipt does not match the transaction.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'rejected')
            ->assertJsonPath('data.rejection_reason', 'The receipt does not match the transaction.')
            ->assertJsonPath('data.reviewed_by.id', $owner->id)
            ->assertJsonPath('bill.total_payments', '0.00')
            ->assertJsonPath('bill.balance', '5000.00');

        $this->getJson('/api/owner/rental-payment-submissions?status=pending')
            ->assertOk()
            ->assertJsonPath('data.total', 0);
    }

    public function test_approval_is_rejected_if_verified_amount_exceeds_dated_balance(): void
    {
        Carbon::setTestNow('2026-11-08 12:00:00');
        try {
            $owner = $this->createOwner();
            $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
            Storage::fake('local');
            [, $bill] = $this->createBillForStudent($owner, $student, [
                'amount' => '100.00',
                'due_date' => '2026-11-05',
                'daily_late_fee_snapshot' => '10.00',
            ]);
            $payment = $this->submitPayment($student, $bill, '100.00', '2026-11-08');
            Sanctum::actingAs($owner);

            $this->patchJson("/api/owner/rental-payments/{$payment->id}/approve", [
                'amount' => '131.00',
                'payment_date' => '2026-11-08',
                'amount_adjustment_reason' => 'Verified receipt amount.',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['amount']);

            $this->assertDatabaseHas('rental_payments', [
                'id' => $payment->id,
                'status' => 'pending',
                'submitted_amount' => '100.00',
            ]);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_pending_submission_does_not_reduce_balance_or_stop_late_fees_until_approved(): void
    {
        Carbon::setTestNow('2026-11-06 12:00:00');
        Storage::fake('local');
        try {
            $owner = $this->createOwner();
            $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
            [, $bill] = $this->createBillForStudent($owner, $student, [
                'amount' => '100.00',
                'due_date' => '2026-11-05',
                'daily_late_fee_snapshot' => '10.00',
            ]);
            $payment = $this->submitPayment($student, $bill, '110.00', '2026-11-06');
            Sanctum::actingAs($owner);

            $this->getJson("/api/owner/rental-bills/{$bill->id}")
                ->assertOk()
                ->assertJsonPath('data.total_payments', '0.00')
                ->assertJsonPath('data.overdue_days', 1)
                ->assertJsonPath('data.accumulated_late_fee', '10.00')
                ->assertJsonPath('data.total_outstanding', '110.00');

            $this->patchJson("/api/owner/rental-payments/{$payment->id}/approve", [
                'amount' => '110.00',
                'payment_date' => '2026-11-06',
            ])->assertOk()
                ->assertJsonPath('bill.total_payments', '110.00')
                ->assertJsonPath('bill.overdue_days', 1)
                ->assertJsonPath('bill.accumulated_late_fee', '10.00')
                ->assertJsonPath('bill.total_outstanding', '0.00');

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

    public function test_pending_submissions_are_owner_scoped_and_proof_is_private(): void
    {
        Storage::fake('local');
        $owner = $this->createOwner();
        $otherOwner = $this->createOwner();
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        [, $bill] = $this->createBillForStudent($owner, $student);
        $payment = $this->submitPayment($student, $bill);
        Sanctum::actingAs($otherOwner);

        $this->getJson('/api/owner/rental-payment-submissions?status=pending')
            ->assertOk()
            ->assertJsonPath('data.total', 0);
        $this->patchJson("/api/owner/rental-payments/{$payment->id}/reject", [
            'reason' => 'Not my tenant.',
        ])->assertNotFound();
        $this->get("/api/rental-payments/{$payment->id}/proof")->assertNotFound();

        Sanctum::actingAs($owner);
        $this->getJson('/api/owner/rental-payment-submissions?status=pending')
            ->assertOk()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.status', 'pending')
            ->assertJsonPath('data.data.0.bill.id', $bill->id);
        $this->get("/api/rental-payments/{$payment->id}/proof")->assertOk();
    }

    public function test_direct_owner_payment_remains_immediately_approved_and_void_audit_works(): void
    {
        $owner = $this->createOwner();
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        [, $bill] = $this->createBillForStudent($owner, $student);
        Sanctum::actingAs($owner);

        $response = $this->postJson("/api/owner/rental-bills/{$bill->id}/payments", [
            'amount' => '300.00',
            'payment_date' => '2026-11-08',
            'notes' => 'Verified cash payment.',
        ])->assertCreated()
            ->assertJsonPath('payment.status', 'approved')
            ->assertJsonPath('data.total_payments', '300.00');
        $paymentId = $response->json('payment.id');

        $this->patchJson("/api/owner/rental-payments/{$paymentId}/void", [
            'reason' => 'Recorded against the wrong bill.',
        ])->assertOk()
            ->assertJsonPath('data.void_reason', 'Recorded against the wrong bill.')
            ->assertJsonPath('bill.total_payments', '0.00');
    }

    private function createOwner(): User
    {
        return User::factory()->create(['role' => 'owner', 'status' => 'active']);
    }

    /**
     * @return array{Tenant, RentalBill}
     */
    private function createBillForStudent(
        User $owner,
        User $student,
        array $billAttributes = []
    ): array {
        $tenant = Tenant::create([
            'owner_id' => $owner->id,
            'user_id' => $student->id,
            'full_name' => 'Payment Test Tenant',
            'contact_number' => '09171234567',
        ]);
        $house = Boardinghouse::create([
            'owner_id' => $owner->id,
            'name' => 'Payment Test House',
            'city' => 'Tagum City',
            'address' => '1 Test Street',
            'monthly_rent' => '5000.00',
            'available_rooms' => 1,
            'total_rooms' => 1,
            'status' => 'approved',
            'billing_policy' => 'full_monthly',
            'late_payment_fee' => '0.00',
            'grace_period_days' => 0,
        ]);
        $room = $house->rooms()->create([
            'room_number' => '101',
            'room_type' => 'Single Room',
            'monthly_rent' => '5000.00',
            'pricing_basis' => 'per_person',
            'max_occupants' => 1,
            'availability_status' => 'available',
        ]);
        $assignment = $tenant->assignments()->create([
            'boarding_house_room_id' => $room->id,
            'move_in_date' => '2026-01-01',
            'monthly_rent' => '5000.00',
            'status' => 'active',
        ]);
        $bill = $assignment->rentalBills()->create([
            'amount' => '5000.00',
            'rental_period_start' => '2026-11-01',
            'rental_period_end' => '2026-11-30',
            'due_date' => '2026-12-05',
            ...$billAttributes,
        ]);

        return [$tenant, $bill];
    }

    private function submitPayment(
        User $student,
        RentalBill $bill,
        string $amount = '400.00',
        string $paymentDate = '2026-11-08'
    ): RentalPayment {
        Sanctum::actingAs($student);
        $response = $this->post("/api/student/rental-bills/{$bill->id}/payment-submissions", [
            'amount' => $amount,
            'payment_date' => $paymentDate,
            'proof' => UploadedFile::fake()->createWithContent('receipt.pdf', '%PDF-1.4 test proof'),
        ]);
        $response->assertCreated();

        return RentalPayment::query()->findOrFail($response->json('data.id'));
    }
}
