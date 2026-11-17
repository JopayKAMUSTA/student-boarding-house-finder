<?php

namespace App\Http\Controllers;

use App\Models\Boardinghouse;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

abstract class ConversationController extends Controller
{
    abstract protected function participantRole(): string;

    public function index(Request $request): JsonResponse
    {
        $user = $this->authenticatedParticipant($request);

        $validated = $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $query = $this->participantConversations($user);

        // Students see conversations that already contain messages.
        // Owners retain their existing conversation-list behavior.
        if ($this->participantRole() === 'student') {
            $query->whereHas('messages');
        }

        $conversations = $query
            ->with([
                'tenant:id,user_id,full_name',
                'student:id,name,role',
                'boardingHouse:id,name',
                'latestMessage.sender:id,name,role',
            ])
            ->withCount([
                'messages as unread_count' => fn (Builder $query) => $query
                    ->whereNull('read_at')
                    ->where('sender_id', '!=', $user->id),
            ])
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->paginate($validated['per_page'] ?? 15);

        $conversations->through(
            fn (Conversation $conversation): array =>
                $this->presentConversation($conversation)
        );

        return response()->json([
            'success' => true,
            'data' => $conversations,
        ]);
    }

    public function recipients(Request $request): JsonResponse
    {
        $user = $this->authenticatedParticipant($request);

        abort_unless($this->participantRole() === 'owner', 403);

        $validated = $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $recipients = DB::table('tenants')
            ->join(
                'room_assignments',
                'room_assignments.tenant_id',
                '=',
                'tenants.id'
            )
            ->join(
                'boarding_house_rooms',
                'boarding_house_rooms.id',
                '=',
                'room_assignments.boarding_house_room_id'
            )
            ->join(
                'boarding_houses',
                'boarding_houses.id',
                '=',
                'boarding_house_rooms.boarding_house_id'
            )
            ->join(
                'users as linked_students',
                'linked_students.id',
                '=',
                'tenants.user_id'
            )
            ->where('tenants.owner_id', $user->id)
            ->whereNotNull('tenants.user_id')
            ->where('linked_students.role', 'student')
            ->where('boarding_houses.owner_id', $user->id)
            ->select([
                'tenants.id as tenant_id',
                'tenants.full_name as tenant_name',
                'boarding_houses.id as boarding_house_id',
                'boarding_houses.name as boarding_house_name',
            ])
            ->distinct()
            ->orderBy('tenants.full_name')
            ->paginate($validated['per_page'] ?? 100);

        return response()->json([
            'success' => true,
            'data' => $recipients,
        ]);
    }

   
public function store(Request $request): JsonResponse
{
    $user = $this->authenticatedParticipant($request);

    if ($this->participantRole() === 'owner') {
        $validated = $request->validate([
            'tenant_id' => ['required', 'integer', 'exists:tenants,id'],
            'boarding_house_id' => [
                'required',
                'integer',
                'exists:boarding_houses,id',
            ],
        ]);

        $tenant = Tenant::query()
            ->where('owner_id', $user->id)
            ->whereNotNull('user_id')
            ->whereHas(
                'student',
                fn (Builder $query) => $query->where('role', 'student')
            )
            ->findOrFail($validated['tenant_id']);

        $boardingHouse = Boardinghouse::query()
            ->where('owner_id', $user->id)
            ->findOrFail($validated['boarding_house_id']);

        $hasAssignment = $tenant->assignments()
            ->whereHas(
                'boardingHouseRoom',
                fn (Builder $query) => $query->where(
                    'boarding_house_id',
                    $boardingHouse->id
                )
            )
            ->exists();

        abort_unless($hasAssignment, 404);

        $conversation = Conversation::query()->firstOrCreate([
            'owner_id' => $user->id,
            'tenant_id' => $tenant->id,
            'boarding_house_id' => $boardingHouse->id,
        ]);
    } else {
        $validated = $request->validate([
            'boarding_house_id' => [
                'required',
                'integer',
                'exists:boarding_houses,id',
            ],
        ]);

        $boardingHouse = Boardinghouse::query()
            ->where('status', 'approved')
            ->findOrFail($validated['boarding_house_id']);

        abort_if(
            $boardingHouse->owner_id === $user->id,
            403,
            'You cannot start a conversation with yourself.'
        );

        // Check whether this student is already a tenant
        // assigned to this particular boarding house.
        $tenant = Tenant::query()
            ->where('user_id', $user->id)
            ->where('owner_id', $boardingHouse->owner_id)
            ->whereHas(
                'assignments',
                fn (Builder $assignmentQuery) =>
                    $assignmentQuery->whereHas(
                        'boardingHouseRoom',
                        fn (Builder $roomQuery) =>
                            $roomQuery->where(
                                'boarding_house_id',
                                $boardingHouse->id
                            )
                    )
            )
            ->first();

        // Reuse an existing conversation if this student
        // has already contacted this boarding house.
        $conversation = Conversation::query()
            ->where('student_id', $user->id)
            ->where('boarding_house_id', $boardingHouse->id)
            ->first();

        if ($conversation) {
            // If the student has since become a tenant,
            // link the existing inquiry to their tenant record.
            if ($tenant && $conversation->tenant_id === null) {
                $conversation->update([
                    'tenant_id' => $tenant->id,
                ]);
            }
        } elseif ($tenant) {
            // Check whether the owner already created
            // a conversation for this actual tenant.
            $conversation = Conversation::query()
                ->where('owner_id', $boardingHouse->owner_id)
                ->where('tenant_id', $tenant->id)
                ->where('boarding_house_id', $boardingHouse->id)
                ->first();

            if ($conversation) {
                $conversation->update([
                    'student_id' => $user->id,
                ]);
            } else {
                $conversation = Conversation::query()->create([
                    'owner_id' => $boardingHouse->owner_id,
                    'student_id' => $user->id,
                    'tenant_id' => $tenant->id,
                    'boarding_house_id' => $boardingHouse->id,
                ]);
            }
        } else {
            // Prospective student: create an inquiry.
            // No tenant record or room assignment is required.
            $conversation = Conversation::query()->create([
                'owner_id' => $boardingHouse->owner_id,
                'student_id' => $user->id,
                'tenant_id' => null,
                'boarding_house_id' => $boardingHouse->id,
            ]);
        }
    }

    $conversation->load([
        'tenant:id,user_id,full_name',
        'student:id,name,role',
        'boardingHouse:id,name',
    ]);

    return response()->json([
        'success' => true,
        'message' => $conversation->wasRecentlyCreated
            ? 'Conversation created.'
            : 'Conversation already exists.',
        'data' => $this->presentConversation($conversation),
    ], $conversation->wasRecentlyCreated ? 201 : 200);
}


    public function show(
        Request $request,
        Conversation $conversation
    ): JsonResponse {
        $conversation = $this->authorizedConversation(
            $request,
            $conversation
        );

        $conversation->load([
            'tenant:id,user_id,full_name',
            'student:id,name,role',
            'boardingHouse:id,name',
            'latestMessage.sender:id,name,role',
        ]);

        $conversation->loadCount([
            'messages as unread_count' => fn (Builder $query) => $query
                ->whereNull('read_at')
                ->where('sender_id', '!=', $request->user()->id),
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->presentConversation($conversation),
        ]);
    }

    public function messages(
        Request $request,
        Conversation $conversation
    ): JsonResponse {
        $conversation = $this->authorizedConversation(
            $request,
            $conversation
        );

        $validated = $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $messages = $conversation->messages()
            ->with([
                'sender:id,name,role',
                'attachments:id,message_id,original_filename,mime_type,file_size,created_at',
            ])
            ->orderByDesc('id')
            ->paginate($validated['per_page'] ?? 30);

        $messages->setCollection(
            $messages->getCollection()
                ->reverse()
                ->values()
                ->map(
                    fn (Message $message): array =>
                        $this->presentMessage($message, $conversation)
                )
        );

        return response()->json([
            'success' => true,
            'data' => $messages,
        ]);
    }

    public function send(
        Request $request,
        Conversation $conversation
    ): JsonResponse {
        $conversation = $this->authorizedConversation(
            $request,
            $conversation
        );

        $validated = $request->validate([
            'body' => ['nullable', 'string', 'max:5000'],
            'attachments' => ['sometimes', 'array', 'max:5'],
            'attachments.*' => [
                'file',
                'mimes:jpg,jpeg,png,webp,pdf',
                'max:10240',
            ],
        ]);

        $body = trim($validated['body'] ?? '');
        $files = $validated['attachments'] ?? [];

        if ($body === '' && count($files) === 0) {
            throw ValidationException::withMessages([
                'body' => [
                    'Write a message or attach at least one file.',
                ],
            ]);
        }

        $storedPaths = [];

        try {
            $message = DB::transaction(function () use (
                $conversation,
                $request,
                $body,
                $files,
                &$storedPaths
            ): Message {
                $message = $conversation->messages()->create([
                    'sender_id' => $request->user()->id,
                    'body' => $body === '' ? null : $body,
                ]);

                foreach ($files as $file) {
                    $path = Storage::disk('local')->putFile(
                        'message-attachments',
                        $file
                    );

                    if (! is_string($path)) {
                        throw new RuntimeException(
                            'A message attachment could not be stored.'
                        );
                    }

                    $storedPaths[] = $path;

                    $message->attachments()->create([
                        'original_filename' => basename(
                            str_replace(
                                '\\',
                                '/',
                                $file->getClientOriginalName()
                            )
                        ),
                        'stored_path' => $path,
                        'mime_type' => $file->getMimeType()
                            ?? 'application/octet-stream',
                        'file_size' => $file->getSize(),
                    ]);
                }

                $conversation->touch();

                return $message->load([
                    'sender:id,name,role',
                    'attachments:id,message_id,original_filename,mime_type,file_size,created_at',
                ]);
            });
        } catch (Throwable $exception) {
            if ($storedPaths !== []) {
                Storage::disk('local')->delete($storedPaths);
            }

            throw $exception;
        }

        return response()->json([
            'success' => true,
            'message' => 'Message sent.',
            'data' => $this->presentMessage($message, $conversation),
        ], 201);
    }

    public function markRead(
        Request $request,
        Conversation $conversation
    ): JsonResponse {
        $conversation = $this->authorizedConversation(
            $request,
            $conversation
        );

        $markedCount = $conversation->messages()
            ->where('sender_id', '!=', $request->user()->id)
            ->whereNull('read_at')
            ->update([
                'read_at' => now(config('app.timezone', 'UTC')),
            ]);

        return response()->json([
            'success' => true,
            'data' => ['marked_read' => $markedCount],
        ]);
    }

    
public function unreadCount(Request $request): JsonResponse
{
    $user = $this->authenticatedParticipant($request);

    $conversationIds = $this->participantConversations($user)
        ->select('conversations.id');

    $unreadMessages = Message::query()
        ->whereNull('read_at')
        ->where('sender_id', '!=', $user->id)
        ->whereHas(
            'conversation',
            fn (Builder $query) =>
                $query->whereIn('conversations.id', $conversationIds)
        )
        ->count();

    return response()->json([
        'success' => true,
        'data' => [
            'unread_count' => $unreadMessages,
        ],
    ]);
}


    public function attachment(
        Request $request,
        Conversation $conversation,
        MessageAttachment $attachment
    ): Response {
        $conversation = $this->authorizedConversation(
            $request,
            $conversation
        );

        $attachment = MessageAttachment::query()
            ->whereHas(
                'message',
                fn (Builder $query) =>
                    $query->where(
                        'conversation_id',
                        $conversation->id
                    )
            )
            ->findOrFail($attachment->id);

        $disk = Storage::disk('local');

        abort_unless(
            $disk->exists($attachment->stored_path),
            404,
            'Attachment file not found.'
        );

        $filePath = $disk->path($attachment->stored_path);

        abort_unless(
            is_file($filePath) && is_readable($filePath),
            404,
            'Attachment file is not readable.'
        );

        $filename = basename(str_replace(
            '\\',
            '/',
            $attachment->original_filename
        ));

        $mimeType = $attachment->mime_type
            ?: mime_content_type($filePath)
            ?: 'application/octet-stream';

        if ($request->boolean('download')) {
            return response()->download(
                $filePath,
                $filename,
                [
                    'Content-Type' => $mimeType,
                    'X-Content-Type-Options' => 'nosniff',
                ]
            );
        }

        return response()->file(
            $filePath,
            [
                'Content-Type' => $mimeType,
                'Content-Disposition' => 'inline; filename="' .
                    addcslashes($filename, '"\\') . '"',
                'X-Content-Type-Options' => 'nosniff',
                'Cache-Control' => 'private, no-cache, no-store, must-revalidate',
            ]
        );
    }

    private function authenticatedParticipant(Request $request): User
    {
        abort_unless(
            $request->user()?->role === $this->participantRole(),
            403
        );

        return $request->user();
    }

    /**
     * Returns conversations belonging to the authenticated participant.
     *
     * Students are identified through their tenant record.
     * Their tenant must be assigned to the exact boarding house
     * referenced by the conversation.
     */
    
private function participantConversations(User $user): Builder
{
    $query = Conversation::query();

    if ($this->participantRole() === 'owner') {
        return $query
            ->where('owner_id', $user->id)
            ->whereHas(
                'boardingHouse',
                fn (Builder $houseQuery) =>
                    $houseQuery->where('owner_id', $user->id)
            )
            ->where(function (Builder $participantQuery) use ($user) {
                $participantQuery
                    ->whereHas(
                        'tenant',
                        fn (Builder $tenantQuery) =>
                            $tenantQuery->where('owner_id', $user->id)
                    )
                    ->orWhereHas(
                        'student',
                        fn (Builder $studentQuery) =>
                            $studentQuery->where('role', 'student')
                    );
            });
    }

    return $query
        ->where(function (Builder $participantQuery) use ($user) {

            // Prospective student inquiries.
            $participantQuery->where(function (Builder $inquiryQuery) use ($user) {
                $inquiryQuery
                    ->where('student_id', $user->id)
                    ->whereNull('tenant_id');
            })

            // Actual tenant conversations.
            ->orWhere(function (Builder $tenantConversationQuery) use ($user) {
                $tenantConversationQuery
                    ->whereNotNull('tenant_id')
                    ->whereHas(
                        'tenant',
                        function (Builder $tenantQuery) use ($user) {
                            $tenantQuery
                                ->where('user_id', $user->id)
                                ->whereColumn(
                                    'tenants.owner_id',
                                    'conversations.owner_id'
                                )
                                ->whereHas(
                                    'assignments',
                                    fn (Builder $assignmentQuery) =>
                                        $assignmentQuery->whereHas(
                                            'boardingHouseRoom',
                                            fn (Builder $roomQuery) =>
                                                $roomQuery->whereColumn(
                                                    'boarding_house_rooms.boarding_house_id',
                                                    'conversations.boarding_house_id'
                                                )
                                        )
                                );
                        }
                    );
            });
        })
        ->whereHas(
            'boardingHouse',
            fn (Builder $houseQuery) =>
                $houseQuery->whereColumn(
                    'boarding_houses.owner_id',
                    'conversations.owner_id'
                )
        );
}


    private function authorizedConversation(
        Request $request,
        Conversation $conversation
    ): Conversation {
        $user = $this->authenticatedParticipant($request);

        return $this->participantConversations($user)
            ->whereKey($conversation->id)
            ->firstOrFail();
    }

    private function presentConversation(
        Conversation $conversation
    ): array {
        $latestMessage = $conversation->latestMessage;

        return [
            'id' => $conversation->id,
            'owner_id' => $conversation->owner_id,
            'student_id' => $conversation->student_id,
            'tenant_id' => $conversation->tenant_id,
            'boarding_house_id' => $conversation->boarding_house_id,
            'student' => $conversation->student,
            'tenant' => $conversation->tenant,
            'boarding_house' => $conversation->boardingHouse,
            'latest_message' => $latestMessage
                ? [
                    'id' => $latestMessage->id,
                    'body' => $latestMessage->body,
                    'sender' => $this->presentSender(
                        $latestMessage->sender
                    ),
                    'created_at' => $latestMessage->created_at,
                ]
                : null,
            'unread_count' => (int) (
                $conversation->unread_count ?? 0
            ),
            'created_at' => $conversation->created_at,
            'updated_at' => $conversation->updated_at,
        ];
    }

    private function presentMessage(
        Message $message,
        Conversation $conversation
    ): array {
        $routeName = $this->participantRole()
            . '.conversations.attachments.show';

        return [
            'id' => $message->id,
            'conversation_id' => $conversation->id,
            'sender_id' => $message->sender_id,
            'sender' => $this->presentSender($message->sender),
            'body' => $message->body,
            'read_at' => $message->read_at,
            'created_at' => $message->created_at,
            'attachments' => $message->attachments->map(
                fn (MessageAttachment $attachment): array => [
                    'id' => $attachment->id,
                    'original_filename' => $attachment->original_filename,
                    'mime_type' => $attachment->mime_type,
                    'file_size' => $attachment->file_size,
                    'created_at' => $attachment->created_at,
                    'url' => route($routeName, [
                        'conversation' => $conversation->id,
                        'attachment' => $attachment->id,
                    ]),
                ]
            )->values(),
        ];
    }

    private function presentSender(?User $sender): ?array
    {
        return $sender
            ? [
                'id' => $sender->id,
                'name' => $sender->name,
                'role' => $sender->role,
            ]
            : null;
    }
}
