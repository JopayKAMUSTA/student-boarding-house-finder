<?php

namespace Tests\Feature;

use App\Models\Boardinghouse;
use App\Models\BoardinghouseRoom;
use App\Models\RentalBill;
use App\Models\RoomAssignment;
use App\Models\Tenant;
use App\Models\RoomImage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class OwnerBoardingHouseApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_create_and_list_only_their_boarding_houses(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $otherOwner = User::factory()->create(['role' => 'owner']);
        Boardinghouse::create([
            'owner_id' => $otherOwner->id,
            'name' => 'Other Owner House',
            'city' => 'Tagum City',
            'address' => '456 Other Street',
            'monthly_rent' => 6000,
            'available_rooms' => 1,
            'total_rooms' => 2,
        ]);
        Sanctum::actingAs($owner);

        $response = $this->postJson('/api/owner/boarding-houses', [
            'owner_id' => $otherOwner->id,
            'name' => 'My Boarding House',
            'description' => 'Near the campus',
            'city' => 'Tagum City',
            'barangay' => 'Mankilam',
            'address' => '123 Main Street',
            'monthly_rent' => 4500,
            'security_deposit' => 1000,
            'advance_payment' => 4500,
            'late_payment_fee' => 250.50,
            'grace_period_days' => 5,
            'rules' => "Quiet hours after 10 PM.\nNo smoking indoors.",
            'available_rooms' => 2,
            'total_rooms' => 3,
            'room_type' => 'Single',
            'amenities' => ['Wi-Fi', 'Water'],
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.owner_id', $owner->id)
            ->assertJsonPath('data.name', 'My Boarding House')
            ->assertJsonPath('data.billing_policy', 'full_monthly')
            ->assertJsonPath('data.late_payment_fee', '250.50')
            ->assertJsonPath('data.grace_period_days', 5)
            ->assertJsonPath('data.rules', "Quiet hours after 10 PM.\nNo smoking indoors.")
            ->assertJsonPath('data.description', 'Near the campus');

        $this->getJson('/api/owner/boarding-houses')
            ->assertOk()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.name', 'My Boarding House')
            ->assertJsonPath('data.data.0.late_payment_fee', '250.50')
            ->assertJsonPath('data.data.0.grace_period_days', 5)
            ->assertJsonPath('data.data.0.rules', "Quiet hours after 10 PM.\nNo smoking indoors.")
            ->assertJsonMissing(['name' => 'Other Owner House']);
    }

    public function test_create_uses_late_payment_setting_defaults_when_omitted(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        Sanctum::actingAs($owner);

        $this->postJson('/api/owner/boarding-houses', [
            'name' => 'Defaults House',
            'city' => 'Tagum City',
            'address' => '123 Main Street',
            'monthly_rent' => 4500,
            'available_rooms' => 1,
            'total_rooms' => 1,
        ])->assertCreated()
            ->assertJsonPath('data.late_payment_fee', '0.00')
            ->assertJsonPath('data.grace_period_days', 0)
            ->assertJsonPath('data.rules', null);

        $this->assertDatabaseHas('boarding_houses', [
            'owner_id' => $owner->id,
            'name' => 'Defaults House',
            'late_payment_fee' => '0.00',
            'grace_period_days' => 0,
            'rules' => null,
        ]);
    }

    public function test_owner_create_rejects_negative_late_fees_and_invalid_grace_periods(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        Sanctum::actingAs($owner);
        $baseData = [
            'name' => 'Invalid Settings House',
            'city' => 'Tagum City',
            'address' => '123 Main Street',
            'monthly_rent' => 4500,
            'available_rooms' => 1,
            'total_rooms' => 1,
        ];

        $this->postJson('/api/owner/boarding-houses', [
            ...$baseData,
            'late_payment_fee' => -1,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['late_payment_fee']);

        $this->postJson('/api/owner/boarding-houses', [
            ...$baseData,
            'grace_period_days' => -1,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['grace_period_days']);

        $this->postJson('/api/owner/boarding-houses', [
            ...$baseData,
            'grace_period_days' => 1.5,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['grace_period_days']);
    }

    public function test_owner_can_update_late_payment_settings_and_rules_separately_from_description(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $house = $this->createBoardingHouse($owner);
        $house->update(['description' => 'A sunny and quiet property.']);
        Sanctum::actingAs($owner);

        $this->patchJson("/api/owner/boarding-houses/{$house->id}/settings", [
            'late_payment_fee' => '125.75',
            'grace_period_days' => 7,
            'rules' => "Quiet hours: 10 PM to 6 AM.\nKeep shared spaces clean.",
        ])->assertOk()
            ->assertJsonPath('data.late_payment_fee', '125.75')
            ->assertJsonPath('data.grace_period_days', 7)
            ->assertJsonPath('data.rules', "Quiet hours: 10 PM to 6 AM.\nKeep shared spaces clean.")
            ->assertJsonPath('data.description', 'A sunny and quiet property.');

        $this->assertDatabaseHas('boarding_houses', [
            'id' => $house->id,
            'late_payment_fee' => '125.75',
            'grace_period_days' => 7,
            'rules' => "Quiet hours: 10 PM to 6 AM.\nKeep shared spaces clean.",
            'description' => 'A sunny and quiet property.',
        ]);
    }

    public function test_house_settings_reject_negative_fee_and_invalid_grace_period(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $house = $this->createBoardingHouse($owner);
        Sanctum::actingAs($owner);
        $settingsUrl = "/api/owner/boarding-houses/{$house->id}/settings";

        $this->patchJson($settingsUrl, [
            'late_payment_fee' => -0.01,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['late_payment_fee']);

        $this->patchJson($settingsUrl, [
            'grace_period_days' => -1,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['grace_period_days']);

        $this->patchJson($settingsUrl, [
            'grace_period_days' => 1.5,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['grace_period_days']);

        $this->assertDatabaseHas('boarding_houses', [
            'id' => $house->id,
            'late_payment_fee' => '0.00',
            'grace_period_days' => 0,
        ]);
    }

    public function test_owner_can_create_boarding_houses_with_supported_billing_policies(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        Sanctum::actingAs($owner);

        foreach (['full_monthly', 'prorated'] as $policy) {
            $this->postJson('/api/owner/boarding-houses', [
                'name' => "House {$policy}",
                'city' => 'Tagum City',
                'address' => '123 Main Street',
                'monthly_rent' => 4500,
                'available_rooms' => 1,
                'total_rooms' => 1,
                'billing_policy' => $policy,
            ])->assertCreated()
                ->assertJsonPath('data.billing_policy', $policy);

            $this->assertDatabaseHas('boarding_houses', [
                'owner_id' => $owner->id,
                'name' => "House {$policy}",
                'billing_policy' => $policy,
            ]);
        }
    }

    public function test_owner_create_rejects_an_unsupported_billing_policy(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        Sanctum::actingAs($owner);

        $this->postJson('/api/owner/boarding-houses', [
            'name' => 'Invalid Policy House',
            'city' => 'Tagum City',
            'address' => '123 Main Street',
            'monthly_rent' => 4500,
            'available_rooms' => 1,
            'total_rooms' => 1,
            'billing_policy' => 'weekly',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['billing_policy']);
    }

    public function test_owner_can_update_only_their_boarding_house_billing_policy(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $house = $this->createBoardingHouse($owner);
        Sanctum::actingAs($owner);

        $this->patchJson("/api/owner/boarding-houses/{$house->id}/billing-policy", [
            'billing_policy' => 'prorated',
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $house->id)
            ->assertJsonPath('data.billing_policy', 'prorated')
            ->assertJsonPath('data.name', $house->name);

        $this->assertDatabaseHas('boarding_houses', [
            'id' => $house->id,
            'billing_policy' => 'prorated',
            'name' => $house->name,
            'address' => $house->address,
        ]);
    }

    public function test_owner_policy_update_rejects_an_unsupported_billing_policy(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $house = $this->createBoardingHouse($owner);
        Sanctum::actingAs($owner);

        $this->patchJson("/api/owner/boarding-houses/{$house->id}/billing-policy", [
            'billing_policy' => 'weekly',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['billing_policy']);

        $this->assertDatabaseHas('boarding_houses', [
            'id' => $house->id,
            'billing_policy' => 'full_monthly',
        ]);
    }

    public function test_owner_cannot_update_another_owners_billing_policy(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $otherOwner = User::factory()->create(['role' => 'owner']);
        $house = $this->createBoardingHouse($otherOwner);
        Sanctum::actingAs($owner);

        $this->patchJson("/api/owner/boarding-houses/{$house->id}/billing-policy", [
            'billing_policy' => 'prorated',
        ])->assertNotFound();
        $this->patchJson("/api/owner/boarding-houses/{$house->id}/settings", [
            'late_payment_fee' => 100,
        ])->assertNotFound();

        $this->assertDatabaseHas('boarding_houses', [
            'id' => $house->id,
            'billing_policy' => 'full_monthly',
        ]);
    }

    public function test_policy_update_does_not_change_existing_rental_bill_or_snapshots(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $house = $this->createBoardingHouse($owner);
        $room = $house->rooms()->create($this->validRoomData());
        $tenant = Tenant::create([
            'owner_id' => $owner->id,
            'full_name' => 'Billing Policy Test Tenant',
            'contact_number' => '09171234567',
        ]);
        $assignment = $tenant->assignments()->create([
            'boarding_house_room_id' => $room->id,
            'move_in_date' => '2026-01-01',
            'monthly_rent' => '5000.00',
            'status' => 'active',
        ]);
        $bill = $assignment->rentalBills()->create([
            'amount' => '4321.09',
            'billing_policy' => 'full_monthly',
            'monthly_rent_snapshot' => '5000.00',
            'billable_days' => 30,
            'days_in_month' => 30,
            'rental_period_start' => '2026-10-01',
            'rental_period_end' => '2026-10-31',
            'due_date' => '2026-10-05',
        ]);
        Sanctum::actingAs($owner);

        $this->patchJson("/api/owner/boarding-houses/{$house->id}/billing-policy", [
            'billing_policy' => 'prorated',
        ])->assertOk();

        $this->assertDatabaseHas('rental_bills', [
            'id' => $bill->id,
            'amount' => '4321.09',
            'billing_policy' => 'full_monthly',
            'monthly_rent_snapshot' => '5000.00',
            'billable_days' => 30,
            'days_in_month' => 30,
        ]);
    }

    public function test_owner_create_rejects_available_rooms_above_total_rooms(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        Sanctum::actingAs($owner);

        $this->postJson('/api/owner/boarding-houses', [
            'name' => 'Invalid House',
            'city' => 'Tagum City',
            'address' => '123 Main Street',
            'monthly_rent' => 4500,
            'available_rooms' => 4,
            'total_rooms' => 3,
        ])
            ->assertUnprocessable()
            ->assertJsonPath('success', false);
    }

    public function test_non_owners_cannot_access_owner_boarding_house_routes(): void
    {
        $student = User::factory()->create(['role' => 'student']);
        $house = $this->createBoardingHouse(
            User::factory()->create(['role' => 'owner'])
        );
        Sanctum::actingAs($student);

        $this->getJson('/api/owner/boarding-houses')->assertForbidden();
        $this->postJson('/api/owner/boarding-houses', [])->assertForbidden();
        $this->patchJson("/api/owner/boarding-houses/{$house->id}/settings", [
            'late_payment_fee' => 100,
        ])->assertForbidden();
        $this->patchJson("/api/owner/boarding-houses/{$house->id}/billing-policy", [
            'billing_policy' => 'prorated',
        ])->assertForbidden();
    }

    public function test_owner_can_manage_room_details_and_photos(): void
    {
        Storage::fake('public');
        $owner = User::factory()->create(['role' => 'owner']);
        $boardingHouse = $this->createBoardingHouse($owner);
        Sanctum::actingAs($owner);
        $baseUrl = "/api/owner/boarding-houses/{$boardingHouse->id}/rooms";
        $roomData = $this->validRoomData();

        $created = $this->postJson($baseUrl, $roomData)
            ->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.room_number', '101');
        $roomId = $created->json('data.id');

        $this->getJson($baseUrl)
            ->assertOk()
            ->assertJsonPath('boarding_house.id', $boardingHouse->id)
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.id', $roomId);

        $this->getJson("{$baseUrl}/{$roomId}")
            ->assertOk()
            ->assertJsonPath('data.room_number', '101');

        $this->putJson("{$baseUrl}/{$roomId}", [
            ...$roomData,
            'room_number' => '102',
            'monthly_rent' => 5200,
        ])
            ->assertOk()
            ->assertJsonPath('data.room_number', '102')
            ->assertJsonPath('data.monthly_rent', '5200.00');

        $this->post("{$baseUrl}/{$roomId}", [
            ...$roomData,
            '_method' => 'PUT',
            'room_number' => '103',
            'monthly_rent' => 5300,
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.room_number', '103');

        $upload = $this->post(
            "{$baseUrl}/{$roomId}/images",
            ['images' => [$this->fakeRoomPhoto(), $this->fakeRoomPhoto()]],
            ['Accept' => 'application/json']
        );
        $upload->assertCreated()->assertJsonPath('success', true);

        $imageId = $upload->json('data.images.0.id');
        $image = RoomImage::findOrFail($imageId);
        $remainingImage = RoomImage::findOrFail($upload->json('data.images.1.id'));
        Storage::disk('public')->assertExists($image->image_path);
        Storage::disk('public')->assertExists($remainingImage->image_path);
        $this->assertNotEmpty($upload->json('data.images.0.url'));
        $imageResponse = $this->get("{$baseUrl}/{$roomId}/images/{$imageId}")
            ->assertOk();
        $this->assertSame(
            Storage::disk('public')->get($image->image_path),
            $imageResponse->streamedContent()
        );
        $this->assertSame('image/png', $imageResponse->headers->get('Content-Type'));

        $this->deleteJson("{$baseUrl}/{$roomId}/images/{$imageId}")
            ->assertOk();
        Storage::disk('public')->assertMissing($image->image_path);
        $this->assertDatabaseMissing('room_images', ['id' => $imageId]);

        $this->deleteJson("{$baseUrl}/{$roomId}")
            ->assertOk();
        $this->assertDatabaseMissing('boarding_house_rooms', ['id' => $roomId]);
        Storage::disk('public')->assertMissing($remainingImage->image_path);
    }

    public function test_owner_cannot_manage_another_owners_room_or_image(): void
    {
        Storage::fake('public');
        $owner = User::factory()->create(['role' => 'owner']);
        $otherOwner = User::factory()->create(['role' => 'owner']);
        $boardingHouse = $this->createBoardingHouse($otherOwner);
        $room = $boardingHouse->rooms()->create($this->validRoomData());
        $image = $room->images()->create(['image_path' => 'room-images/private.jpg']);
        Sanctum::actingAs($owner);
        $baseUrl = "/api/owner/boarding-houses/{$boardingHouse->id}/rooms";

        $this->getJson($baseUrl)->assertForbidden();
        $this->postJson($baseUrl, $this->validRoomData())->assertForbidden();
        $this->getJson("{$baseUrl}/{$room->id}")->assertForbidden();
        $this->putJson("{$baseUrl}/{$room->id}", $this->validRoomData())->assertForbidden();
        $this->postJson("{$baseUrl}/{$room->id}/images", [
            'images' => [$this->fakeRoomPhoto()],
        ])->assertForbidden();
        $this->get("{$baseUrl}/{$room->id}/images/{$image->id}")
            ->assertForbidden();
        $this->deleteJson("{$baseUrl}/{$room->id}/images/{$image->id}")
            ->assertForbidden();
        $this->deleteJson("{$baseUrl}/{$room->id}")->assertForbidden();
    }

    public function test_room_validation_checks_positive_values_unique_names_and_photo_types(): void
    {
        Storage::fake('public');
        $owner = User::factory()->create(['role' => 'owner']);
        $boardingHouse = $this->createBoardingHouse($owner);
        Sanctum::actingAs($owner);
        $baseUrl = "/api/owner/boarding-houses/{$boardingHouse->id}/rooms";

        $this->postJson($baseUrl, [
            ...$this->validRoomData(),
            'monthly_rent' => 0,
            'max_occupants' => 0,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['monthly_rent', 'max_occupants']);

        $this->postJson($baseUrl, $this->validRoomData())->assertCreated();
        $this->postJson($baseUrl, $this->validRoomData())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['room_number']);

        $room = BoardinghouseRoom::firstOrFail();
        $this->post(
            "{$baseUrl}/{$room->id}/images",
            ['images' => [UploadedFile::fake()->create('not-an-image.txt', 1, 'text/plain')]],
            ['Accept' => 'application/json']
        )->assertUnprocessable();
    }

    private function createBoardingHouse(User $owner): Boardinghouse
    {
        return Boardinghouse::create([
            'owner_id' => $owner->id,
            'name' => 'Test Boarding House',
            'city' => 'Tagum City',
            'address' => '123 Main Street',
            'monthly_rent' => 3500,
            'available_rooms' => 5,
            'total_rooms' => 5,
            'status' => 'pending',
        ]);
    }

    private function validRoomData(): array
    {
        return [
            'room_number' => '101',
            'room_type' => 'Single Room',
            'monthly_rent' => 5000,
            'pricing_basis' => 'per_person',
            'max_occupants' => 1,
            'availability_status' => 'available',
            'description' => 'Quiet room',
            'amenities' => ['Bed', 'Study table'],
        ];
    }

    private function fakeRoomPhoto(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent(
            'room.png',
            base64_decode(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC'
            )
        );
    }
}
