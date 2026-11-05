<?php

namespace Tests\Feature;

use App\Models\Boardinghouse;
use App\Models\BoardinghouseRoom;
use App\Models\RoomAssignment;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OwnerTenantManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_register_walk_in_tenant_and_link_student_account(): void
    {
        $owner = $this->createOwner();
        $student = User::factory()->create(['role' => 'student']);
        Sanctum::actingAs($owner);

        $this->postJson('/api/owner/tenants', [
            'full_name' => 'Walk In Tenant',
            'contact_number' => '09171234567',
            'emergency_contact_name' => 'Emergency Contact',
            'emergency_contact_number' => '09179876543',
        ])
            ->assertCreated()
            ->assertJsonPath('data.full_name', 'Walk In Tenant')
            ->assertJsonPath('data.user_id', null);

        $linked = $this->postJson('/api/owner/tenants', [
            'user_id' => $student->id,
            'full_name' => 'Linked Tenant',
            'contact_number' => '09170000000',
        ])
            ->assertCreated()
            ->assertJsonPath('data.user_id', $student->id);

        $this->assertDatabaseHas('tenants', [
            'id' => $linked->json('data.id'),
            'owner_id' => $owner->id,
            'user_id' => $student->id,
        ]);
    }

    public function test_owner_cannot_link_a_non_student_account(): void
    {
        Sanctum::actingAs($this->createOwner());
        $admin = User::factory()->create(['role' => 'admin']);

        $this->postJson('/api/owner/tenants', [
            'user_id' => $admin->id,
            'full_name' => 'Invalid Linked Tenant',
            'contact_number' => '09171234567',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['user_id']);
    }

    public function test_owner_can_search_and_filter_their_tenants_and_view_assignment_history(): void
    {
        $owner = $this->createOwner();
        $house = $this->createBoardingHouse($owner);
        $room = $this->createRoom($house);
        $tenant = $this->createTenant($owner, ['full_name' => 'Maria Santos']);
        $assignment = $this->createAssignment($tenant, $room);
        Sanctum::actingAs($owner);

        $this->getJson('/api/owner/tenants?search=Maria&boarding_house_id='.$house->id.'&assignment_status=active')
            ->assertOk()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.id', $tenant->id)
            ->assertJsonPath('data.data.0.current_assignment.id', $assignment->id);

        $this->getJson("/api/owner/tenants/{$tenant->id}")
            ->assertOk()
            ->assertJsonPath('data.assignments.0.id', $assignment->id)
            ->assertJsonPath('data.current_assignment.boarding_house_room.id', $room->id);
    }

    public function test_owner_cannot_view_another_owners_tenant_or_change_its_owner(): void
    {
        $owner = $this->createOwner();
        $otherOwner = $this->createOwner();
        $tenant = $this->createTenant($otherOwner);
        Sanctum::actingAs($owner);

        $this->getJson("/api/owner/tenants/{$tenant->id}")->assertNotFound();
        $this->putJson("/api/owner/tenants/{$tenant->id}", [
            'contact_number' => '09171234567',
        ])->assertNotFound();

        $ownedTenant = $this->createTenant($owner);
        $this->putJson("/api/owner/tenants/{$ownedTenant->id}", [
            'owner_id' => $otherOwner->id,
            'contact_number' => '09171234567',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['owner_id']);
    }

    public function test_owner_can_update_contact_information_without_changing_tenant_identity(): void
    {
        $owner = $this->createOwner();
        $student = User::factory()->create(['role' => 'student']);
        $tenant = $this->createTenant($owner, [
            'user_id' => $student->id,
            'full_name' => 'Original Tenant Name',
        ]);
        Sanctum::actingAs($owner);

        $this->putJson("/api/owner/tenants/{$tenant->id}", [
            'contact_number' => '09179998877',
            'emergency_contact_name' => 'Updated Contact',
            'emergency_contact_number' => '09175554433',
        ])
            ->assertOk()
            ->assertJsonPath('data.full_name', 'Original Tenant Name')
            ->assertJsonPath('data.user_id', $student->id)
            ->assertJsonPath('data.contact_number', '09179998877');

        $this->assertDatabaseHas('tenants', [
            'id' => $tenant->id,
            'owner_id' => $owner->id,
            'user_id' => $student->id,
            'emergency_contact_name' => 'Updated Contact',
            'emergency_contact_number' => '09175554433',
        ]);
    }

    public function test_only_owner_accounts_can_access_tenant_endpoints(): void
    {
        foreach (['student', 'admin'] as $role) {
            Sanctum::actingAs(User::factory()->create(['role' => $role]));

            $this->getJson('/api/owner/tenants')->assertForbidden();
            $this->postJson('/api/owner/tenants', [])->assertForbidden();
        }
    }

    public function test_guest_cannot_access_tenant_endpoints(): void
    {
        $this->getJson('/api/owner/tenants')->assertUnauthorized();
        $this->postJson('/api/owner/tenants', [])->assertUnauthorized();
    }

    public function test_owner_can_assign_tenant_to_available_room_and_room_becomes_occupied_at_capacity(): void
    {
        $owner = $this->createOwner();
        $house = $this->createBoardingHouse($owner);
        $room = $this->createRoom($house, ['max_occupants' => 1]);
        $tenant = $this->createTenant($owner);
        Sanctum::actingAs($owner);

        $response = $this->postJson("/api/owner/tenants/{$tenant->id}/assignments", [
            'boarding_house_room_id' => $room->id,
            'move_in_date' => '2026-11-01',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.monthly_rent', '5000.00');

        $this->assertDatabaseHas('room_assignments', [
            'id' => $response->json('data.id'),
            'tenant_id' => $tenant->id,
            'boarding_house_room_id' => $room->id,
            'monthly_rent' => '5000.00',
        ]);
        $this->assertDatabaseHas('boarding_house_rooms', [
            'id' => $room->id,
            'availability_status' => 'occupied',
        ]);
    }

    public function test_assignment_is_rejected_when_room_capacity_is_full(): void
    {
        $owner = $this->createOwner();
        $house = $this->createBoardingHouse($owner);
        $room = $this->createRoom($house, ['max_occupants' => 1]);
        $this->createAssignment($this->createTenant($owner), $room);
        $tenant = $this->createTenant($owner);
        Sanctum::actingAs($owner);

        $this->postJson("/api/owner/tenants/{$tenant->id}/assignments", [
            'boarding_house_room_id' => $room->id,
            'move_in_date' => '2026-11-01',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['boarding_house_room_id']);
    }

    public function test_assignment_is_rejected_for_another_owners_room(): void
    {
        $owner = $this->createOwner();
        $otherOwner = $this->createOwner();
        $house = $this->createBoardingHouse($otherOwner);
        $room = $this->createRoom($house);
        $tenant = $this->createTenant($owner);
        Sanctum::actingAs($owner);

        $this->postJson("/api/owner/tenants/{$tenant->id}/assignments", [
            'boarding_house_room_id' => $room->id,
            'move_in_date' => '2026-11-01',
        ])->assertForbidden();
    }

    public function test_assignment_is_rejected_for_unapproved_boarding_house(): void
    {
        $owner = $this->createOwner();
        $house = $this->createBoardingHouse($owner, ['status' => 'pending']);
        $room = $this->createRoom($house);
        $tenant = $this->createTenant($owner);
        Sanctum::actingAs($owner);

        $this->postJson("/api/owner/tenants/{$tenant->id}/assignments", [
            'boarding_house_room_id' => $room->id,
            'move_in_date' => '2026-11-01',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['boarding_house_room_id']);
    }

    public function test_assignment_is_rejected_for_reserved_and_maintenance_rooms(): void
    {
        $owner = $this->createOwner();
        $house = $this->createBoardingHouse($owner);
        $tenant = $this->createTenant($owner);
        Sanctum::actingAs($owner);

        foreach (['reserved', 'under_maintenance'] as $status) {
            $room = $this->createRoom($house, [
                'room_number' => $status === 'reserved' ? '102' : '103',
                'availability_status' => $status,
            ]);
            $this->postJson("/api/owner/tenants/{$tenant->id}/assignments", [
                'boarding_house_room_id' => $room->id,
                'move_in_date' => '2026-11-01',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['boarding_house_room_id']);
        }
    }

    public function test_tenant_cannot_have_two_active_assignments(): void
    {
        $owner = $this->createOwner();
        $house = $this->createBoardingHouse($owner);
        $source = $this->createRoom($house);
        $destination = $this->createRoom($house, ['room_number' => '102']);
        $tenant = $this->createTenant($owner);
        $this->createAssignment($tenant, $source);
        Sanctum::actingAs($owner);

        $this->postJson("/api/owner/tenants/{$tenant->id}/assignments", [
            'boarding_house_room_id' => $destination->id,
            'move_in_date' => '2026-11-01',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['tenant']);
    }

    public function test_owner_can_transfer_tenant_within_the_same_house_and_keep_history(): void
    {
        $owner = $this->createOwner();
        $house = $this->createBoardingHouse($owner);
        $source = $this->createRoom($house);
        $destination = $this->createRoom($house, [
            'room_number' => '102',
            'monthly_rent' => 6200,
        ]);
        $tenant = $this->createTenant($owner);
        $previous = $this->createAssignment($tenant, $source);
        Sanctum::actingAs($owner);

        $response = $this->postJson("/api/owner/tenants/{$tenant->id}/transfer", [
            'boarding_house_room_id' => $destination->id,
            'move_in_date' => '2026-11-05',
        ])->assertCreated()
            ->assertJsonPath('data.boarding_house_room_id', $destination->id)
            ->assertJsonPath('data.monthly_rent', '6200.00');

        $previous->refresh();
        $this->assertSame('moved_out', $previous->status);
        $this->assertSame('2026-11-05', $previous->move_out_date->toDateString());
        $this->assertDatabaseHas('room_assignments', [
            'id' => $response->json('data.id'),
            'status' => 'active',
        ]);
        $this->getJson("/api/owner/tenants/{$tenant->id}")
            ->assertOk()
            ->assertJsonCount(2, 'data.assignments');
    }

    public function test_transfer_to_another_boarding_house_is_rejected(): void
    {
        $owner = $this->createOwner();
        $sourceHouse = $this->createBoardingHouse($owner);
        $destinationHouse = $this->createBoardingHouse($owner, ['name' => 'Second House']);
        $source = $this->createRoom($sourceHouse);
        $destination = $this->createRoom($destinationHouse);
        $tenant = $this->createTenant($owner);
        $previous = $this->createAssignment($tenant, $source);
        Sanctum::actingAs($owner);

        $this->postJson("/api/owner/tenants/{$tenant->id}/transfer", [
            'boarding_house_room_id' => $destination->id,
            'move_in_date' => '2026-11-05',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['boarding_house_room_id']);

        $this->assertDatabaseHas('room_assignments', [
            'id' => $previous->id,
            'status' => 'active',
        ]);
    }

    public function test_move_out_preserves_history_and_frees_room_capacity(): void
    {
        $owner = $this->createOwner();
        $house = $this->createBoardingHouse($owner);
        $room = $this->createRoom($house, ['max_occupants' => 1]);
        $tenant = $this->createTenant($owner);
        $assignment = $this->createAssignment($tenant, $room);
        Sanctum::actingAs($owner);

        $this->patchJson("/api/owner/tenants/{$tenant->id}/move-out")
            ->assertOk()
            ->assertJsonPath('data.status', 'moved_out');

        $assignment->refresh();
        $this->assertSame('moved_out', $assignment->status);
        $this->assertSame(now()->toDateString(), $assignment->move_out_date->toDateString());
        $this->assertDatabaseHas('boarding_house_rooms', [
            'id' => $room->id,
            'availability_status' => 'available',
        ]);
        $this->assertDatabaseHas('tenants', ['id' => $tenant->id]);
    }

    public function test_room_capacity_cannot_be_reduced_below_active_occupancy(): void
    {
        $owner = $this->createOwner();
        $house = $this->createBoardingHouse($owner);
        $room = $this->createRoom($house, ['max_occupants' => 2]);
        $this->createAssignment($this->createTenant($owner), $room);
        $this->createAssignment($this->createTenant($owner), $room);
        Sanctum::actingAs($owner);

        $this->putJson("/api/owner/boarding-houses/{$house->id}/rooms/{$room->id}", [
            ...$this->validRoomData(),
            'max_occupants' => 1,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['max_occupants']);
    }

    public function test_room_with_assignment_history_cannot_be_deleted(): void
    {
        $owner = $this->createOwner();
        $house = $this->createBoardingHouse($owner);
        $room = $this->createRoom($house);
        $tenant = $this->createTenant($owner);
        $assignment = $this->createAssignment($tenant, $room);
        $assignment->update(['status' => 'moved_out', 'move_out_date' => '2026-11-01']);
        Sanctum::actingAs($owner);

        $this->deleteJson("/api/owner/boarding-houses/{$house->id}/rooms/{$room->id}")
            ->assertStatus(409);

        $this->assertDatabaseHas('boarding_house_rooms', ['id' => $room->id]);
        $this->assertDatabaseHas('room_assignments', ['id' => $assignment->id]);
    }

    private function createOwner(): User
    {
        return User::factory()->create(['role' => 'owner', 'status' => 'active']);
    }

    private function createTenant(User $owner, array $attributes = []): Tenant
    {
        return Tenant::create([
            'owner_id' => $owner->id,
            'full_name' => 'Test Tenant',
            'contact_number' => '09171234567',
            ...$attributes,
        ]);
    }

    private function createBoardingHouse(User $owner, array $attributes = []): Boardinghouse
    {
        return Boardinghouse::create([
            'owner_id' => $owner->id,
            'name' => 'Approved Test House',
            'city' => 'Tagum City',
            'address' => '123 Test Street',
            'monthly_rent' => 5000,
            'available_rooms' => 1,
            'total_rooms' => 1,
            'status' => 'approved',
            ...$attributes,
        ]);
    }

    private function createRoom(Boardinghouse $house, array $attributes = []): BoardinghouseRoom
    {
        return $house->rooms()->create([
            ...$this->validRoomData(),
            ...$attributes,
        ]);
    }

    private function createAssignment(Tenant $tenant, BoardinghouseRoom $room): RoomAssignment
    {
        return $tenant->assignments()->create([
            'boarding_house_room_id' => $room->id,
            'move_in_date' => '2026-10-01',
            'monthly_rent' => $room->monthly_rent,
            'status' => 'active',
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
            'description' => 'Test room',
            'amenities' => ['Bed'],
        ];
    }
}
