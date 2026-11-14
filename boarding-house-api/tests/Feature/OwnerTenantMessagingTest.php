<?php

namespace Tests\Feature;

use App\Models\Boardinghouse;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OwnerTenantMessagingTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_create_one_conversation_for_a_linked_tenant_and_house(): void
    {
        $owner = $this->createOwner();
        $student = $this->createStudent();
        $house = $this->createHouse($owner);
        $tenant = $this->createTenant($owner, $student, $house);
        Sanctum::actingAs($owner);

        $payload = [
            'tenant_id' => $tenant->id,
            'boarding_house_id' => $house->id,
        ];
        $first = $this->postJson('/api/owner/conversations', $payload)
            ->assertCreated()
            ->assertJsonPath('data.tenant_id', $tenant->id)
            ->assertJsonPath('data.boarding_house_id', $house->id);
        $second = $this->postJson('/api/owner/conversations', $payload)
            ->assertOk()
            ->assertJsonPath('data.id', $first->json('data.id'));

        $this->assertDatabaseCount('conversations', 1);
        $this->getJson('/api/owner/conversations')
            ->assertOk()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.tenant.full_name', $tenant->full_name);
        $this->getJson('/api/owner/conversations/recipients')
            ->assertOk()
            ->assertJsonPath('data.data.0.tenant_id', $tenant->id)
            ->assertJsonPath('data.data.0.boarding_house_id', $house->id);
    }

    public function test_student_can_start_only_a_conversation_for_their_assigned_boarding_house(): void
    {
        $owner = $this->createOwner();
        $student = $this->createStudent();
        $house = $this->createHouse($owner);
        $tenant = $this->createTenant($owner, $student, $house);
        Sanctum::actingAs($student);

        $first = $this->postJson('/api/student/conversations', [
            'boarding_house_id' => $house->id,
        ])->assertCreated()
            ->assertJsonPath('data.tenant_id', $tenant->id)
            ->assertJsonPath('data.owner_id', $owner->id);
        $this->postJson('/api/student/conversations', [
            'boarding_house_id' => $house->id,
        ])->assertOk()
            ->assertJsonPath('data.id', $first->json('data.id'));

        $otherHouse = $this->createHouse($owner, 'Unassigned House');
        $this->postJson('/api/student/conversations', [
            'boarding_house_id' => $otherHouse->id,
        ])->assertNotFound();
        $this->assertDatabaseCount('conversations', 1);
    }

    public function test_owner_and_tenant_can_send_and_retrieve_messages_and_update_read_status(): void
    {
        $owner = $this->createOwner();
        $student = $this->createStudent();
        $house = $this->createHouse($owner);
        $tenant = $this->createTenant($owner, $student, $house);
        $conversation = $this->createConversation($owner, $tenant, $house);
        Sanctum::actingAs($owner);

        $ownerMessage = $this->postJson(
            "/api/owner/conversations/{$conversation->id}/messages",
            ['body' => 'Welcome to the house.']
        )->assertCreated()
            ->assertJsonPath('data.body', 'Welcome to the house.')
            ->assertJsonPath('data.sender_id', $owner->id);

        Sanctum::actingAs($student);
        $this->getJson('/api/student/conversations/unread-count')
            ->assertOk()
            ->assertJsonPath('data.unread_count', 1);
        $this->getJson("/api/student/conversations/{$conversation->id}/messages")
            ->assertOk()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.body', 'Welcome to the house.')
            ->assertJsonPath('data.data.0.id', $ownerMessage->json('data.id'));
        $this->postJson("/api/student/conversations/{$conversation->id}/read")
            ->assertOk()
            ->assertJsonPath('data.marked_read', 1);

        $studentMessage = $this->postJson(
            "/api/student/conversations/{$conversation->id}/messages",
            ['body' => 'Thank you.']
        )->assertCreated()
            ->assertJsonPath('data.sender_id', $student->id);
        $this->assertNotNull(
            Message::findOrFail($ownerMessage->json('data.id'))->read_at
        );

        Sanctum::actingAs($owner);
        $this->getJson('/api/owner/conversations/unread-count')
            ->assertOk()
            ->assertJsonPath('data.unread_count', 1);
        $this->postJson("/api/owner/conversations/{$conversation->id}/read")
            ->assertOk()
            ->assertJsonPath('data.marked_read', 1);
        $this->assertNotNull(
            Message::findOrFail($studentMessage->json('data.id'))->read_at
        );
        $this->getJson('/api/owner/conversations/unread-count')
            ->assertOk()
            ->assertJsonPath('data.unread_count', 0);
    }

    public function test_messages_can_include_private_image_and_pdf_attachments(): void
    {
        Storage::fake('local');
        $owner = $this->createOwner();
        $student = $this->createStudent();
        $house = $this->createHouse($owner);
        $tenant = $this->createTenant($owner, $student, $house);
        $conversation = $this->createConversation($owner, $tenant, $house);
        Sanctum::actingAs($owner);

        $response = $this->post(
            "/api/owner/conversations/{$conversation->id}/messages",
            [
                'body' => 'Please review these files.',
                'attachments' => [
                    UploadedFile::fake()->createWithContent(
                        'room.png',
                        base64_decode(
                            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC'
                        )
                    ),
                    UploadedFile::fake()->createWithContent(
                        'lease.pdf',
                        '%PDF-1.4 sample lease file'
                    ),
                ],
            ],
            ['Accept' => 'application/json']
        )->assertCreated()
            ->assertJsonCount(2, 'data.attachments')
            ->assertJsonMissingPath('data.attachments.0.stored_path');

        $attachments = MessageAttachment::query()->orderBy('id')->get();
        $this->assertCount(2, $attachments);
        foreach ($attachments as $attachment) {
            Storage::disk('local')->assertExists($attachment->stored_path);
        }

        Sanctum::actingAs($student);
        $studentMessages = $this->getJson("/api/student/conversations/{$conversation->id}/messages")
            ->assertOk()
            ->assertJsonPath('data.data.0.attachments.0.original_filename', 'room.png')
            ->assertJsonPath('data.data.0.attachments.1.original_filename', 'lease.pdf');

        $imageUrl = $studentMessages->json('data.data.0.attachments.0.url');
        $imagePath = parse_url($imageUrl, PHP_URL_PATH);
        $this->get($imagePath)->assertOk()->assertHeader('Content-Type', 'image/png');
        $pdfUrl = $studentMessages->json('data.data.0.attachments.1.url');
        $pdfPath = parse_url($pdfUrl, PHP_URL_PATH);
        $this->get($pdfPath.'?download=1')->assertOk()
            ->assertHeader('Content-Disposition', 'attachment; filename=lease.pdf');
    }

    public function test_conversation_and_attachment_access_is_limited_to_its_participants(): void
    {
        Storage::fake('local');
        $owner = $this->createOwner();
        $student = $this->createStudent();
        $house = $this->createHouse($owner);
        $tenant = $this->createTenant($owner, $student, $house);
        $conversation = $this->createConversation($owner, $tenant, $house);

        Sanctum::actingAs($student);
        $message = $this->post(
            "/api/student/conversations/{$conversation->id}/messages",
            [
                'attachments' => [
                    UploadedFile::fake()->createWithContent('private.pdf', '%PDF-1.4 private'),
                ],
            ],
            ['Accept' => 'application/json']
        )->assertCreated();
        $attachmentId = $message->json('data.attachments.0.id');

        $otherOwner = $this->createOwner();
        $otherStudent = $this->createStudent();
        $otherHouse = $this->createHouse($otherOwner);
        $otherTenant = $this->createTenant($otherOwner, $otherStudent, $otherHouse);
        $otherConversation = $this->createConversation($otherOwner, $otherTenant, $otherHouse);

        Sanctum::actingAs($otherStudent);
        $this->getJson("/api/student/conversations/{$conversation->id}")->assertNotFound();
        $this->get("/api/student/conversations/{$conversation->id}/attachments/{$attachmentId}")
            ->assertNotFound();

        Sanctum::actingAs($otherOwner);
        $this->getJson('/api/owner/conversations')
            ->assertOk()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.id', $otherConversation->id);
        $this->getJson("/api/owner/conversations/{$conversation->id}")->assertNotFound();
        $this->get("/api/owner/conversations/{$conversation->id}/attachments/{$attachmentId}")
            ->assertNotFound();

        Sanctum::actingAs($student);
        $this->getJson('/api/owner/conversations')->assertForbidden();
        Sanctum::actingAs($owner);
        $this->getJson('/api/student/conversations')->assertForbidden();
    }

    public function test_unlinked_or_unassigned_relationships_cannot_start_conversations(): void
    {
        $owner = $this->createOwner();
        $student = $this->createStudent();
        $house = $this->createHouse($owner);
        $unlinkedTenant = $this->createTenant($owner, null, $house);
        Sanctum::actingAs($owner);

        $this->postJson('/api/owner/conversations', [
            'tenant_id' => $unlinkedTenant->id,
            'boarding_house_id' => $house->id,
        ])->assertNotFound();

        $otherHouse = $this->createHouse($owner, 'No Assignment House');
        $linkedTenant = $this->createTenant($owner, $student, $house);
        $this->postJson('/api/owner/conversations', [
            'tenant_id' => $linkedTenant->id,
            'boarding_house_id' => $otherHouse->id,
        ])->assertNotFound();

        $otherOwner = $this->createOwner();
        $otherOwnerHouse = $this->createHouse($otherOwner);
        $this->postJson('/api/owner/conversations', [
            'tenant_id' => $linkedTenant->id,
            'boarding_house_id' => $otherOwnerHouse->id,
        ])->assertNotFound();
    }

    public function test_message_validation_requires_text_or_valid_attachments(): void
    {
        Storage::fake('local');
        $owner = $this->createOwner();
        $student = $this->createStudent();
        $house = $this->createHouse($owner);
        $tenant = $this->createTenant($owner, $student, $house);
        $conversation = $this->createConversation($owner, $tenant, $house);
        Sanctum::actingAs($owner);

        $this->postJson("/api/owner/conversations/{$conversation->id}/messages", [
            'body' => '   ',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['body']);
        $this->post(
            "/api/owner/conversations/{$conversation->id}/messages",
            [
                'attachments' => [
                    UploadedFile::fake()->create('script.exe', 10, 'application/x-msdownload'),
                ],
            ],
            ['Accept' => 'application/json']
        )->assertUnprocessable()
            ->assertJsonValidationErrors(['attachments.0']);

        $this->assertDatabaseCount('messages', 0);
    }

    private function createOwner(): User
    {
        return User::factory()->create(['role' => 'owner', 'status' => 'active']);
    }

    private function createStudent(): User
    {
        return User::factory()->create(['role' => 'student', 'status' => 'active']);
    }

    private function createHouse(User $owner, string $name = 'Messaging House'): Boardinghouse
    {
        $house = Boardinghouse::create([
            'owner_id' => $owner->id,
            'name' => $name,
            'city' => 'Tagum City',
            'address' => '1 Messaging Street',
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

    private function createTenant(
        User $owner,
        ?User $student,
        Boardinghouse $house
    ): Tenant {
        $tenant = Tenant::create([
            'owner_id' => $owner->id,
            'user_id' => $student?->id,
            'full_name' => 'Messaging Tenant',
            'contact_number' => '09171234567',
        ]);
        $tenant->assignments()->create([
            'boarding_house_room_id' => $house->rooms()->firstOrFail()->id,
            'move_in_date' => '2026-10-11',
            'monthly_rent' => '5000.00',
            'status' => 'active',
        ]);

        return $tenant;
    }

    private function createConversation(
        User $owner,
        Tenant $tenant,
        Boardinghouse $house
    ): Conversation {
        return Conversation::query()->create([
            'owner_id' => $owner->id,
            'tenant_id' => $tenant->id,
            'boarding_house_id' => $house->id,
        ]);
    }
}
