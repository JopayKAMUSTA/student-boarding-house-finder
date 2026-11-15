<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OwnerProfileTest extends TestCase
{
    use RefreshDatabase;

    private function createOwner(): User
    {
        return User::factory()->create([
            'role' => 'owner',
            'status' => 'active',
        ]);
    }

    private function validProfileData(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Jenny',
            'middle_name' => 'Rose',
            'last_name' => 'Dumayac',
            'email' => 'owner@example.com',
            'contact_number' => '09123456789',
            'business_name' => 'TagStay Boarding House',
            'business_address' => 'Tagum City',
        ], $overrides);
    }

    public function test_owner_can_update_profile_with_valid_phone_number(): void
    {
        $owner = $this->createOwner();
        Sanctum::actingAs($owner);

        $this->putJson('/api/owner/profile', $this->validProfileData())
            ->assertOk()
            ->assertJsonPath('message', 'Owner profile updated successfully.');

        $this->assertDatabaseHas('users', [
            'id' => $owner->id,
            'email' => 'owner@example.com',
        ]);

        $this->assertDatabaseHas('owner_profiles', [
            'user_id' => $owner->id,
            'contact_number' => '09123456789',
        ]);
    }

    public function test_owner_profile_rejects_invalid_phone_number(): void
    {
        $owner = $this->createOwner();
        Sanctum::actingAs($owner);

        $this->putJson('/api/owner/profile', $this->validProfileData([
            'contact_number' => '08123456789',
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('contact_number');
    }

    public function test_owner_can_keep_existing_email_address(): void
    {
        $owner = $this->createOwner();
        Sanctum::actingAs($owner);

        $this->putJson('/api/owner/profile', $this->validProfileData([
            'email' => $owner->email,
        ]))
            ->assertOk();
    }

    public function test_owner_cannot_use_another_users_email_address(): void
    {
        $owner = $this->createOwner();

        $anotherUser = User::factory()->create([
            'role' => 'student',
            'status' => 'active',
            'email' => 'another@example.com',
        ]);

        Sanctum::actingAs($owner);

        $this->putJson('/api/owner/profile', $this->validProfileData([
            'email' => $anotherUser->email,
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_owner_cannot_change_password_with_incorrect_current_password(): void
    {
        $owner = $this->createOwner();
        Sanctum::actingAs($owner);

        $this->putJson('/api/owner/profile/password', [
            'current_password' => 'wrong-password',
            'new_password' => 'newpassword123',
            'new_password_confirmation' => 'newpassword123',
        ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Your current password is incorrect.');
    }

    public function test_owner_can_change_password_with_correct_current_password(): void
    {
        $owner = $this->createOwner();
        Sanctum::actingAs($owner);

        $this->putJson('/api/owner/profile/password', [
            'current_password' => 'password',
            'new_password' => 'newpassword123',
            'new_password_confirmation' => 'newpassword123',
        ])
            ->assertOk()
            ->assertJsonPath('message', 'Password changed successfully.');

        $this->assertTrue(
            Hash::check('newpassword123', $owner->fresh()->password)
        );
    }

    public function test_owner_cannot_set_password_shorter_than_eight_characters(): void
    {
        $owner = $this->createOwner();
        Sanctum::actingAs($owner);

        $this->putJson('/api/owner/profile/password', [
            'current_password' => 'password',
            'new_password' => 'short',
            'new_password_confirmation' => 'short',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('new_password');
    }
}
