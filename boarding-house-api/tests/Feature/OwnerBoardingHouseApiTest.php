<?php

namespace Tests\Feature;

use App\Models\Boardinghouse;
use App\Models\BoardinghouseRoom;
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
            'available_rooms' => 2,
            'total_rooms' => 3,
            'room_type' => 'Single',
            'amenities' => ['Wi-Fi', 'Water'],
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.owner_id', $owner->id)
            ->assertJsonPath('data.name', 'My Boarding House');

        $this->getJson('/api/owner/boarding-houses')
            ->assertOk()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.name', 'My Boarding House')
            ->assertJsonMissing(['name' => 'Other Owner House']);
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
        Sanctum::actingAs($student);

        $this->getJson('/api/owner/boarding-houses')->assertForbidden();
        $this->postJson('/api/owner/boarding-houses', [])->assertForbidden();
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
        $this->get("{$baseUrl}/{$roomId}/images/{$imageId}")
            ->assertOk();

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
