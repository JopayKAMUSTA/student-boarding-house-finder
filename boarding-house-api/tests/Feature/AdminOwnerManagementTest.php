<?php

namespace Tests\Feature;

use App\Models\OwnerProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminOwnerManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_login_issues_a_token_only_for_active_admin_accounts(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);

        $this->postJson('/api/admin/login', [
            'email' => $admin->email,
            'password' => 'password',
        ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.role', 'admin')
            ->assertJsonStructure(['data' => ['token']]);

        $owner = User::factory()->create([
            'role' => 'owner',
            'status' => 'active',
        ]);

        $this->postJson('/api/admin/login', [
            'email' => $owner->email,
            'password' => 'password',
        ])->assertForbidden();

        $admin->update(['status' => 'suspended']);
        $this->postJson('/api/admin/login', [
            'email' => $admin->email,
            'password' => 'password',
        ])->assertForbidden();
    }

    public function test_owner_list_requires_an_active_admin_and_returns_owner_profiles(): void
    {
        $owner = $this->createOwner([
            'name' => 'Alex Owner',
            'email' => 'alex@example.com',
        ], [
            'business_name' => 'Tagum Stay',
            'business_address' => 'Tagum City',
            'contact_number' => '09123456789',
        ]);
        User::factory()->create(['role' => 'student']);

        $this->getJson('/api/admin/owners')->assertUnauthorized();
        $this->patchJson("/api/admin/owners/{$owner->id}/verification", [
            'verification_status' => 'approved',
        ])->assertUnauthorized();

        Sanctum::actingAs(User::factory()->create([
            'role' => 'student',
            'status' => 'active',
        ]));
        $this->getJson('/api/admin/owners')->assertForbidden();

        Sanctum::actingAs(User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]));
        $this->getJson('/api/admin/owners')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.id', $owner->id)
            ->assertJsonPath('data.data.0.owner_profile.business_name', 'Tagum Stay')
            ->assertJsonPath('data.data.0.owner_profile.verification_status', 'pending');
    }

    public function test_admin_can_approve_or_reject_owner_verification_without_changing_account_status(): void
    {
        $owner = $this->createOwner([], [
            'verification_status' => 'pending',
        ]);
        Sanctum::actingAs(User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]));

        $this->patchJson("/api/admin/owners/{$owner->id}/verification", [
            'verification_status' => 'approved',
        ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.owner_profile.verification_status', 'approved');

        $this->assertDatabaseHas('owner_profiles', [
            'user_id' => $owner->id,
            'verification_status' => 'approved',
        ]);
        $this->assertNotNull($owner->ownerProfile()->firstOrFail()->verified_at);
        $this->assertDatabaseHas('users', [
            'id' => $owner->id,
            'status' => 'active',
        ]);

        $this->patchJson("/api/admin/owners/{$owner->id}/verification", [
            'verification_status' => 'rejected',
        ])
            ->assertOk()
            ->assertJsonPath('data.owner_profile.verification_status', 'rejected');

        $this->assertDatabaseHas('owner_profiles', [
            'user_id' => $owner->id,
            'verification_status' => 'rejected',
            'verified_at' => null,
        ]);
        $this->assertDatabaseHas('users', [
            'id' => $owner->id,
            'status' => 'active',
        ]);
    }

    public function test_only_owner_accounts_and_approved_or_rejected_statuses_can_be_updated(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);
        $student = User::factory()->create(['role' => 'student']);
        $owner = $this->createOwner();
        Sanctum::actingAs(User::factory()->create([
            'role' => 'student',
            'status' => 'active',
        ]));
        $this->patchJson("/api/admin/owners/{$owner->id}/verification", [
            'verification_status' => 'approved',
        ])->assertForbidden();

        Sanctum::actingAs($admin);
        $this->patchJson("/api/admin/owners/{$student->id}/verification", [
            'verification_status' => 'approved',
        ])->assertNotFound();

        $this->patchJson("/api/admin/owners/{$owner->id}/verification", [
            'verification_status' => 'pending',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['verification_status']);

        Sanctum::actingAs(User::factory()->create([
            'role' => 'admin',
            'status' => 'suspended',
        ]));
        $this->patchJson("/api/admin/owners/{$owner->id}/verification", [
            'verification_status' => 'approved',
        ])->assertForbidden();
    }

    private function createOwner(array $userAttributes = [], array $profileAttributes = []): User
    {
        $owner = User::factory()->create([
            'role' => 'owner',
            'status' => 'active',
            ...$userAttributes,
        ]);

        OwnerProfile::create([
            'user_id' => $owner->id,
            'verification_status' => 'pending',
            ...$profileAttributes,
        ]);

        return $owner;
    }
}
