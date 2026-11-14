<?php

namespace Tests\Feature;

use App\Models\BoardingHousePaymentMethod;
use App\Models\Boardinghouse;
use App\Models\RentalBill;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RentalPaymentMethodsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_manage_multiple_methods_and_students_only_see_active_methods_for_their_bill(): void
    {
        Storage::fake('public');
        $owner = $this->createOwner();
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $house = $this->createHouse($owner);
        $bill = $this->createBill($house, $owner, $student);
        $otherStudent = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $otherBill = $this->createBill($house, $owner, $otherStudent);
        Sanctum::actingAs($owner);

        $baseUrl = "/api/owner/boarding-houses/{$house->id}/payment-methods";
        $created = $this->post(
            $baseUrl,
            [
                'provider' => 'GCash',
                'account_name' => 'Owner One',
                'account_number' => '09171234567',
                'qr_code' => $this->fakeQr(),
                'is_active' => '1',
            ],
            ['Accept' => 'application/json']
        )->assertCreated()
            ->assertJsonPath('data.provider', 'GCash')
            ->assertJsonPath('data.is_active', true);
        $methodId = $created->json('data.id');
        $method = BoardingHousePaymentMethod::findOrFail($methodId);
        Storage::disk('public')->assertExists($method->qr_image_path);

        $this->post(
            $baseUrl,
            [
                'provider' => 'Maya',
                'account_name' => 'Owner One',
                'account_number' => '09170000000',
                'qr_code' => $this->fakeQr(),
            ],
            ['Accept' => 'application/json']
        )->assertCreated();
        $this->assertDatabaseCount('boarding_house_payment_methods', 2);

        $oldQrPath = $method->qr_image_path;
        $this->post(
            "{$baseUrl}/{$methodId}",
            [
                '_method' => 'PUT',
                'provider' => 'GCash',
                'account_name' => 'Updated Owner',
                'account_number' => '09179999999',
            ],
            ['Accept' => 'application/json']
        )->assertOk()
            ->assertJsonPath('data.account_name', 'Updated Owner')
            ->assertJsonPath('data.account_number', '09179999999');
        Storage::disk('public')->assertExists($oldQrPath);

        $this->patchJson("{$baseUrl}/{$methodId}/status", [
            'is_active' => false,
        ])->assertOk()->assertJsonPath('data.is_active', false);
        $this->assertDatabaseHas('boarding_house_payment_methods', [
            'id' => $methodId,
            'account_number' => '09179999999',
            'is_active' => 0,
            'qr_image_path' => $oldQrPath,
        ]);

        Sanctum::actingAs($student);
        $this->getJson("/api/student/rental-bills/{$bill->id}/payment-methods")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.provider', 'Maya');
        $this->getJson("/api/student/rental-bills/{$otherBill->id}/payment-methods")
            ->assertNotFound();
        $this->getJson("/api/student/rental-bills/{$bill->id}/payment-methods/{$methodId}/qr")
            ->assertNotFound();

        Sanctum::actingAs($owner);
        $this->post(
            "{$baseUrl}/{$methodId}",
            [
                '_method' => 'PUT',
                'provider' => 'GCash',
                'account_name' => 'Updated Owner',
                'account_number' => '09179999999',
                'qr_code' => $this->fakeQr(),
                'is_active' => '1',
            ],
            ['Accept' => 'application/json']
        )->assertOk();
        $method->refresh();
        Storage::disk('public')->assertMissing($oldQrPath);
        Storage::disk('public')->assertExists($method->qr_image_path);
        $this->assertNotSame($oldQrPath, $method->qr_image_path);

        Sanctum::actingAs($student);
        $studentMethods = $this->getJson("/api/student/rental-bills/{$bill->id}/payment-methods")
            ->assertOk()
            ->assertJsonPath('data.1.provider', 'GCash')
            ->assertJsonPath('data.1.account_name', 'Updated Owner')
            ->assertJsonPath('data.1.is_active', true);
        $qrUrl = parse_url($studentMethods->json('data.1.qr_code_url'), PHP_URL_PATH);
        $this->get($qrUrl)->assertOk();

        Sanctum::actingAs($owner);
        $this->deleteJson("{$baseUrl}/{$methodId}")->assertOk();
        Storage::disk('public')->assertMissing($method->qr_image_path);
        $this->assertDatabaseMissing('boarding_house_payment_methods', ['id' => $methodId]);
        $this->assertDatabaseHas('boarding_house_payment_methods', [
            'boarding_house_id' => $house->id,
            'provider' => 'Maya',
        ]);
    }

    public function test_payment_method_validation_and_owner_scope_are_enforced(): void
    {
        Storage::fake('public');
        $owner = $this->createOwner();
        $otherOwner = $this->createOwner();
        $house = $this->createHouse($otherOwner);
        $url = "/api/owner/boarding-houses/{$house->id}/payment-methods";
        Sanctum::actingAs($owner);

        $this->getJson($url)->assertNotFound();
        $this->post($url, [
            'provider' => 'GCash',
            'account_name' => 'Owner',
            'account_number' => '09171234567',
            'qr_code' => $this->fakeQr(),
        ], ['Accept' => 'application/json'])->assertNotFound();

        Sanctum::actingAs(User::factory()->create(['role' => 'student']));
        $this->getJson($url)->assertForbidden();

        Sanctum::actingAs($otherOwner);
        $this->post($url, [
            'provider' => '',
            'account_name' => '',
            'account_number' => '',
            'qr_code' => UploadedFile::fake()->create('qr.txt', 1, 'text/plain'),
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['provider', 'account_name', 'account_number', 'qr_code']);

        $created = $this->post(
            $url,
            [
                'provider' => 'Other Provider',
                'account_name' => 'Owner',
                'account_number' => '09171234567',
                'qr_code' => $this->fakeQr(),
            ],
            ['Accept' => 'application/json']
        )->assertCreated();
        $methodId = $created->json('data.id');
        $otherHouse = $this->createHouse($owner);
        $this->putJson(
            "/api/owner/boarding-houses/{$otherHouse->id}/payment-methods/{$methodId}",
            [
                'provider' => 'Other Provider',
                'account_name' => 'Owner',
                'account_number' => '09171234567',
            ]
        )->assertNotFound();
    }

    public function test_student_bill_list_is_limited_to_the_linked_tenant(): void
    {
        $owner = $this->createOwner();
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $otherStudent = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $house = $this->createHouse($owner);
        $studentBill = $this->createBill($house, $owner, $student);
        $this->createBill($house, $owner, $otherStudent);

        Sanctum::actingAs($student);
        $this->getJson('/api/student/rental-bills')
            ->assertOk()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.id', $studentBill->id)
            ->assertJsonPath('data.data.0.room_assignment.tenant.user_id', $student->id);

        Sanctum::actingAs($owner);
        $this->getJson('/api/student/rental-bills')->assertForbidden();
    }

    private function createOwner(): User
    {
        return User::factory()->create(['role' => 'owner', 'status' => 'active']);
    }

    private function createHouse(User $owner): Boardinghouse
    {
        $house = Boardinghouse::create([
            'owner_id' => $owner->id,
            'name' => 'Payment Method House',
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
        $house->rooms()->create([
            'room_number' => '101',
            'room_type' => 'Single Room',
            'monthly_rent' => '5000.00',
            'pricing_basis' => 'per_person',
            'max_occupants' => 1,
            'availability_status' => 'available',
        ]);

        return $house;
    }

    private function createBill(
        Boardinghouse $house,
        User $owner,
        User $student
    ): RentalBill {
        $tenant = Tenant::create([
            'owner_id' => $owner->id,
            'user_id' => $student->id,
            'full_name' => 'Payment Method Student',
            'contact_number' => '09171234567',
        ]);
        $assignment = $tenant->assignments()->create([
            'boarding_house_room_id' => $house->rooms()->firstOrFail()->id,
            'move_in_date' => '2026-10-11',
            'monthly_rent' => '5000.00',
            'status' => 'active',
        ]);

        return $assignment->rentalBills()->create([
            'amount' => '5000.00',
            'rental_period_start' => '2026-11-11',
            'rental_period_end' => '2026-12-10',
            'due_date' => '2026-12-11',
        ]);
    }

    private function fakeQr(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent(
            'qr.png',
            base64_decode(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC'
            )
        );
    }
}
