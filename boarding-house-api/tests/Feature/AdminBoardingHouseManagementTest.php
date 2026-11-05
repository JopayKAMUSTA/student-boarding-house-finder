<?php

namespace Tests\Feature;

use App\Models\Boardinghouse;
use App\Models\OwnerProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminBoardingHouseManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_active_admin_can_list_paginated_boarding_houses_with_owner_information_and_status_filter(): void
    {
        $owner = $this->createOwner();
        $pendingHouse = $this->createBoardingHouse($owner, ['status' => 'pending']);
        $this->createBoardingHouse($owner, ['status' => 'approved']);
        $this->createBoardingHouse($owner, ['status' => 'rejected']);
        for ($index = 0; $index < 15; $index++) {
            $this->createBoardingHouse($owner, ['name' => "Pending House {$index}"]);
        }

        Sanctum::actingAs($this->createAdmin());

        $response = $this->getJson('/api/admin/boarding-houses?status=pending')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.per_page', 15)
            ->assertJsonPath('data.total', 16)
            ->assertJsonPath('data.data.0.owner.id', $owner->id)
            ->assertJsonPath('data.data.0.owner.owner_profile.business_name', 'Tagum Rooms');

        $this->assertSame(
            15,
            count($response->json('data.data'))
        );
        $this->assertSame(
            ['pending'],
            array_values(array_unique(array_column($response->json('data.data'), 'status')))
        );
        $this->assertDatabaseHas('boarding_houses', ['id' => $pendingHouse->id]);
    }

    public function test_admin_can_retrieve_full_listing_details_and_access_room_images(): void
    {
        Storage::fake('public');
        $owner = $this->createOwner();
        $boardingHouse = $this->createBoardingHouse($owner, [
            'description' => 'Near the university.',
            'amenities' => ['Wi-Fi', 'Laundry'],
        ]);
        $room = $boardingHouse->rooms()->create([
            'room_number' => '101',
            'room_type' => 'Single Room',
            'monthly_rent' => 5000,
            'pricing_basis' => 'per_person',
            'max_occupants' => 1,
            'availability_status' => 'available',
            'description' => 'Ground-floor room.',
            'amenities' => ['Bed', 'Study table'],
        ]);
        $imagePath = 'room-images/admin-review.png';
        Storage::disk('public')->put($imagePath, $this->pngContents());
        $image = $room->images()->create(['image_path' => $imagePath]);
        Sanctum::actingAs($this->createAdmin());

        $response = $this->getJson("/api/admin/boarding-houses/{$boardingHouse->id}")
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $boardingHouse->id)
            ->assertJsonPath('data.owner.email', $owner->email)
            ->assertJsonPath('data.owner.owner_profile.business_name', 'Tagum Rooms')
            ->assertJsonPath('data.amenities.0', 'Wi-Fi')
            ->assertJsonPath('data.rooms.0.amenities.0', 'Bed')
            ->assertJsonPath('data.rooms.0.images.0.image_path', $imagePath);

        $imageUrl = $response->json('data.rooms.0.images.0.url');
        $this->assertNotEmpty($imageUrl);
        $imageResponse = $this->get($imageUrl)->assertOk();
        $this->assertSame($this->pngContents(), $imageResponse->streamedContent());
        $this->assertSame('image/png', $imageResponse->headers->get('Content-Type'));
        Storage::disk('public')->assertExists($imagePath);
        $this->assertDatabaseHas('room_images', [
            'id' => $image->id,
            'boarding_house_room_id' => $room->id,
        ]);
    }

    public function test_admin_can_approve_a_pending_boarding_house(): void
    {
        $boardingHouse = $this->createBoardingHouse($this->createOwner());
        Sanctum::actingAs($this->createAdmin());

        $this->patchJson("/api/admin/boarding-houses/{$boardingHouse->id}/status", [
            'status' => 'approved',
        ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'approved');

        $this->assertDatabaseHas('boarding_houses', [
            'id' => $boardingHouse->id,
            'status' => 'approved',
        ]);
    }

    public function test_admin_can_reject_a_pending_boarding_house(): void
    {
        $boardingHouse = $this->createBoardingHouse($this->createOwner());
        Sanctum::actingAs($this->createAdmin());

        $this->patchJson("/api/admin/boarding-houses/{$boardingHouse->id}/status", [
            'status' => 'rejected',
        ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'rejected');

        $this->assertDatabaseHas('boarding_houses', [
            'id' => $boardingHouse->id,
            'status' => 'rejected',
        ]);
    }

    public function test_invalid_listing_status_values_are_rejected(): void
    {
        $boardingHouse = $this->createBoardingHouse($this->createOwner());
        Sanctum::actingAs($this->createAdmin());

        $this->patchJson("/api/admin/boarding-houses/{$boardingHouse->id}/status", [
            'status' => 'pending',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);

        $this->assertDatabaseHas('boarding_houses', [
            'id' => $boardingHouse->id,
            'status' => 'pending',
        ]);
    }

    public function test_non_admin_and_inactive_admin_accounts_cannot_access_admin_listing_endpoints(): void
    {
        $boardingHouse = $this->createBoardingHouse($this->createOwner());
        $room = $boardingHouse->rooms()->create($this->roomData());
        $image = $room->images()->create(['image_path' => 'room-images/hidden.png']);
        $endpoints = [
            ['GET', '/api/admin/boarding-houses'],
            ['GET', "/api/admin/boarding-houses/{$boardingHouse->id}"],
            ['PATCH', "/api/admin/boarding-houses/{$boardingHouse->id}/status"],
            [
                'GET',
                "/api/admin/boarding-houses/{$boardingHouse->id}/rooms/{$room->id}/images/{$image->id}",
            ],
        ];

        foreach ($endpoints as [$method, $uri]) {
            $this->json($method, $uri, ['status' => 'approved'])->assertUnauthorized();
        }

        Sanctum::actingAs(User::factory()->create([
            'role' => 'owner',
            'status' => 'active',
        ]));
        foreach ($endpoints as [$method, $uri]) {
            $this->json($method, $uri, ['status' => 'approved'])->assertForbidden();
        }

        Sanctum::actingAs(User::factory()->create([
            'role' => 'admin',
            'status' => 'suspended',
        ]));
        foreach ($endpoints as [$method, $uri]) {
            $this->json($method, $uri, ['status' => 'approved'])->assertForbidden();
        }
    }

    public function test_public_listing_endpoints_only_return_approved_boarding_houses(): void
    {
        $owner = $this->createOwner();
        $this->createBoardingHouse($owner, ['name' => 'Pending House']);
        $approvedHouse = $this->createBoardingHouse($owner, [
            'name' => 'Approved House',
            'status' => 'approved',
        ]);
        $this->createBoardingHouse($owner, [
            'name' => 'Rejected House',
            'status' => 'rejected',
        ]);

        $this->getJson('/api/boarding-houses')
            ->assertOk()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.id', $approvedHouse->id)
            ->assertJsonMissing(['name' => 'Pending House'])
            ->assertJsonMissing(['name' => 'Rejected House']);

        $this->getJson("/api/boarding-houses/{$approvedHouse->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $approvedHouse->id);

        foreach (['pending', 'rejected'] as $status) {
            $house = Boardinghouse::where('status', $status)->firstOrFail();
            $this->getJson("/api/boarding-houses/{$house->id}")->assertNotFound();
        }
    }

    private function createAdmin(): User
    {
        return User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);
    }

    private function createOwner(): User
    {
        $owner = User::factory()->create([
            'role' => 'owner',
            'status' => 'active',
        ]);
        OwnerProfile::create([
            'user_id' => $owner->id,
            'business_name' => 'Tagum Rooms',
            'verification_status' => 'approved',
        ]);

        return $owner;
    }

    private function createBoardingHouse(User $owner, array $attributes = []): Boardinghouse
    {
        return Boardinghouse::create([
            'owner_id' => $owner->id,
            'name' => 'Test Boarding House',
            'description' => 'A student boarding house.',
            'city' => 'Tagum City',
            'barangay' => 'Mankilam',
            'address' => '123 Main Street',
            'monthly_rent' => 3500,
            'security_deposit' => 1000,
            'advance_payment' => 3500,
            'available_rooms' => 2,
            'total_rooms' => 3,
            'room_type' => 'Single',
            'amenities' => ['Wi-Fi'],
            'status' => 'pending',
            ...$attributes,
        ]);
    }

    private function roomData(): array
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

    private function pngContents(): string
    {
        return base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC'
        );
    }
}
