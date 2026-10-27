<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthenticationFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_login_logout_and_revoke_the_access_token(): void
    {
        $owner = User::factory()->create([
            'role' => 'owner',
            'status' => 'active',
        ]);

        $login = $this->postJson('/api/login', [
            'email' => $owner->email,
            'password' => 'password',
        ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.role', 'owner');

        $token = $login->json('data.token');

        $this->withToken($token)
            ->postJson('/api/logout')
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->app['auth']->forgetGuards();

        $this->withToken($token)
            ->getJson('/api/profile')
            ->assertUnauthorized();
    }

    public function test_login_rejects_invalid_credentials(): void
    {
        $owner = User::factory()->create([
            'role' => 'owner',
            'status' => 'active',
        ]);

        $this->postJson('/api/login', [
            'email' => $owner->email,
            'password' => 'incorrect-password',
        ])
            ->assertUnauthorized()
            ->assertJsonPath('success', false);
    }

    public function test_configured_token_expiration_rejects_an_expired_access_token(): void
    {
        config(['sanctum.expiration' => 1]);

        $owner = User::factory()->create([
            'role' => 'owner',
            'status' => 'active',
        ]);

        $login = $this->postJson('/api/login', [
            'email' => $owner->email,
            'password' => 'password',
        ])->assertOk();

        $token = $login->json('data.token');

        $this->travel(2)->minutes();

        $this->withToken($token)
            ->getJson('/api/profile')
            ->assertUnauthorized();
    }
}
