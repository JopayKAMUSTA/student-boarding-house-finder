<?php

namespace App\Http\Controllers;

use App\Models\BoardinghouseRoom;
use App\Models\RoomAssignment;
use App\Models\Tenant;
use App\Services\RentalBillingCycle;
use App\Services\RentalBillGenerator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OwnerTenantController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeOwner($request);

        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'boarding_house_id' => ['nullable', 'integer', 'exists:boarding_houses,id'],
            'assignment_status' => ['nullable', Rule::in(['active', 'moved_out'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $tenants = Tenant::query()
            ->where('owner_id', $request->user()->id)
            ->with([
                'student:id,name,email',
                'currentAssignment.boardingHouseRoom.boardingHouse:id,name',
            ])
            ->when(
                ! empty($validated['search']),
                fn (Builder $query) => $query->where(function (Builder $query) use ($validated) {
                    $query->where('full_name', 'like', '%'.$validated['search'].'%')
                        ->orWhere('contact_number', 'like', '%'.$validated['search'].'%');
                })
            )
            ->when(
                isset($validated['boarding_house_id']) ||
                isset($validated['assignment_status']),
                function (Builder $query) use ($validated): void {
                    $query->whereHas(
                        'assignments',
                        function (Builder $assignments) use ($validated): void {
                            $assignments
                                ->when(
                                    isset($validated['boarding_house_id']),
                                    fn (Builder $assignmentQuery) => $assignmentQuery
                                        ->whereHas(
                                            'boardingHouseRoom',
                                            fn (Builder $roomQuery) => $roomQuery->where(
                                                'boarding_house_id',
                                                $validated['boarding_house_id']
                                            )
                                        )
                                )
                                ->when(
                                    isset($validated['assignment_status']),
                                    fn (Builder $assignmentQuery) => $assignmentQuery->where(
                                        'status',
                                        $validated['assignment_status']
                                    )
                                );
                        }
                    );
                }
            )
            ->latest()
            ->paginate($validated['per_page'] ?? 10);

        return response()->json([
            'success' => true,
            'data' => $tenants,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeOwner($request);

        $validated = $request->validate([
            'user_id' => [
                'nullable',
                'integer',
                Rule::exists('users', 'id')->where('role', 'student'),
            ],
                'full_name' => ['required', 'string', 'max:255'],
                'contact_number' => ['required', 'string', 'regex:/^09[0-9]{9}$/'],
                'emergency_contact_name' => ['nullable', 'string', 'max:255'],
                'emergency_contact_number' => ['nullable', 'string', 'regex:/^09[0-9]{9}$/'],
                        ]);

        $tenant = Tenant::create([
            ...$validated,
            'owner_id' => $request->user()->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Tenant registered successfully.',
            'data' => $tenant->load('student:id,name,email'),
        ], 201);
    }

    public function show(Request $request, Tenant $tenant): JsonResponse
    {
        $this->authorizeTenant($request, $tenant);
        $tenant->load([
            'student:id,name,email',
            'currentAssignment.boardingHouseRoom.boardingHouse:id,name,address,barangay,city',
            'assignments' => fn (HasMany $query) => $query
                ->with('boardingHouseRoom.boardingHouse:id,name,address,barangay,city')
                ->orderByDesc('move_in_date')
                ->orderByDesc('id'),
        ]);

        return response()->json([
            'success' => true,
            'data' => $tenant,
        ]);
    }

    public function update(Request $request, Tenant $tenant): JsonResponse
    {
        $this->authorizeTenant($request, $tenant);
        $validated = $request->validate([
            'owner_id' => ['prohibited'],
            'contact_number' => ['required', 'string', 'max:30'],
            'emergency_contact_name' => ['nullable', 'string', 'max:255'],
            'emergency_contact_number' => ['nullable', 'string', 'max:30'],
        ]);

        $tenant->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Tenant contact information updated successfully.',
            'data' => $tenant->fresh()->load('student:id,name,email'),
        ]);
    }

    public function assign(
        Request $request,
        Tenant $tenant,
        RentalBillGenerator $billGenerator,
        RentalBillingCycle $billingCycles
    ): JsonResponse {
        $this->authorizeTenant($request, $tenant);
        $validated = $request->validate([
            'boarding_house_room_id' => ['required', 'integer', 'exists:boarding_house_rooms,id'],
            'move_in_date' => ['required', 'date'],
        ]);

        $assignment = DB::transaction(function () use (
            $request,
            $tenant,
            $validated,
            $billGenerator,
            $billingCycles
        ) {
            $lockedTenant = $this->lockOwnedTenant($request, $tenant);
            if ($lockedTenant->assignments()->where('status', 'active')->exists()) {
                throw ValidationException::withMessages([
                    'tenant' => ['The tenant already has an active room assignment.'],
                ]);
            }

            $room = $this->lockRoom((int) $validated['boarding_house_room_id']);
            $this->authorizeRoomOwner($request, $room);
            $this->ensureApprovedBoardingHouse($room);
            $this->ensureAssignable($room);

            $assignment = $lockedTenant->assignments()->create([
                'boarding_house_room_id' => $room->id,
                'move_in_date' => $validated['move_in_date'],
                'monthly_rent' => $room->monthly_rent,
                'status' => 'active',
            ]);

            $this->syncRoomAvailability($room);
            $billGenerator->generateDueCyclesForAssignment(
                (int) $assignment->id,
                $billingCycles
            );

            return $assignment;
        });

        return response()->json([
            'success' => true,
            'message' => 'Tenant assigned to the room successfully.',
            'data' => $assignment->load('boardingHouseRoom.boardingHouse:id,name'),
        ], 201);
    }

    public function transfer(
        Request $request,
        Tenant $tenant,
        RentalBillGenerator $billGenerator,
        RentalBillingCycle $billingCycles
    ): JsonResponse {
        $this->authorizeTenant($request, $tenant);
        $validated = $request->validate([
            'boarding_house_room_id' => ['required', 'integer', 'exists:boarding_house_rooms,id'],
            'move_in_date' => ['required', 'date'],
        ]);

        $assignment = DB::transaction(function () use (
            $request,
            $tenant,
            $validated,
            $billGenerator,
            $billingCycles
        ) {
            $lockedTenant = $this->lockOwnedTenant($request, $tenant);
            $current = $lockedTenant->assignments()
                ->where('status', 'active')
                ->lockForUpdate()
                ->first();

            if (! $current) {
                throw ValidationException::withMessages([
                    'tenant' => ['The tenant does not have an active room assignment to transfer.'],
                ]);
            }

            $transferDate = Carbon::parse($validated['move_in_date'])->startOfDay();
            if (! $transferDate->gt($current->move_in_date)) {
                throw ValidationException::withMessages([
                    'move_in_date' => [
                        'The transfer date must be later than the current assignment move-in date.',
                    ],
                ]);
            }

            $destinationId = (int) $validated['boarding_house_room_id'];
            if ($destinationId === (int) $current->boarding_house_room_id) {
                throw ValidationException::withMessages([
                    'boarding_house_room_id' => ['Choose a different room for the transfer.'],
                ]);
            }

            $rooms = BoardinghouseRoom::query()
                ->whereIn('id', [$current->boarding_house_room_id, $destinationId])
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');
            $source = $rooms->get($current->boarding_house_room_id);
            $destination = $rooms->get($destinationId);

            abort_if(! $source || ! $destination, 404);
            $this->authorizeRoomOwner($request, $destination);
            $this->ensureSameBoardingHouse($source, $destination);
            $this->ensureApprovedBoardingHouse($destination);
            $this->ensureAssignable($destination);

            DB::table('room_assignments')
                ->where('id', $current->id)
                ->update([
                    'status' => 'moved_out',
                    'move_out_date' => $transferDate->copy()->subDay()->toDateString(),
                ]);

            $newAssignment = $lockedTenant->assignments()->create([
                'boarding_house_room_id' => $destination->id,
                'move_in_date' => $transferDate->toDateString(),
                'monthly_rent' => $destination->monthly_rent,
                'status' => 'active',
            ]);

            $this->syncRoomAvailability($source);
            $this->syncRoomAvailability($destination);
            $billGenerator->generateDueCyclesForAssignment(
                (int) $newAssignment->id,
                $billingCycles
            );

            return $newAssignment;
        });

        return response()->json([
            'success' => true,
            'message' => 'Tenant transferred successfully.',
            'data' => $assignment->load('boardingHouseRoom.boardingHouse:id,name'),
        ], 201);
    }

    public function moveOut(Request $request, Tenant $tenant): JsonResponse
    {
        $this->authorizeTenant($request, $tenant);

        $assignment = DB::transaction(function () use ($request, $tenant) {
            $lockedTenant = $this->lockOwnedTenant($request, $tenant);
            /** @var RoomAssignment|null $assignment */
            $assignment = $lockedTenant->assignments()
                ->where('status', 'active')
                ->lockForUpdate()
                ->first();

            if (! $assignment) {
                throw ValidationException::withMessages([
                    'tenant' => ['The tenant does not have an active room assignment.'],
                ]);
            }

            $room = $this->lockRoom((int) $assignment->boarding_house_room_id);
            DB::table('room_assignments')
                ->where('id', $assignment->id)
                ->update([
                    'status' => 'moved_out',
                    'move_out_date' => now()->toDateString(),
                ]);
            $assignment->refresh();
            $this->syncRoomAvailability($room);

            return $assignment;
        });

        return response()->json([
            'success' => true,
            'message' => 'Tenant moved out successfully.',
            'data' => $assignment->load('boardingHouseRoom.boardingHouse:id,name'),
        ]);
    }

    private function authorizeOwner(Request $request): void
    {
        abort_unless($request->user()?->role === 'owner', 403);
    }

    private function authorizeTenant(Request $request, Tenant $tenant): void
    {
        $this->authorizeOwner($request);
        abort_unless((int) $tenant->owner_id === (int) $request->user()->id, 404);
    }

    private function lockOwnedTenant(Request $request, Tenant $tenant): Tenant
    {
        return Tenant::query()
            ->where('owner_id', $request->user()->id)
            ->lockForUpdate()
            ->findOrFail($tenant->id);
    }

    private function lockRoom(int $roomId): BoardinghouseRoom
    {
        return BoardinghouseRoom::query()
            ->with('boardingHouse')
            ->lockForUpdate()
            ->findOrFail($roomId);
    }

    private function authorizeRoomOwner(Request $request, BoardinghouseRoom $room): void
    {
        abort_unless(
            (int) $room->boardingHouse->owner_id === (int) $request->user()->id,
            403
        );
    }

    private function ensureApprovedBoardingHouse(BoardinghouseRoom $room): void
    {
        if ($room->boardingHouse->status !== 'approved') {
            throw ValidationException::withMessages([
                'boarding_house_room_id' => [
                    'Rooms can only be assigned in approved boarding houses.',
                ],
            ]);
        }
    }

    private function ensureAssignable(BoardinghouseRoom $room): void
    {
        if (! in_array($room->availability_status, ['available', 'occupied'], true)) {
            throw ValidationException::withMessages([
                'boarding_house_room_id' => [
                    'The room is reserved or under maintenance and cannot be assigned.',
                ],
            ]);
        }

        if ($room->assignments()->where('status', 'active')->count() >= $room->max_occupants) {
            throw ValidationException::withMessages([
                'boarding_house_room_id' => ['The room has reached its occupant capacity.'],
            ]);
        }
    }

    private function ensureSameBoardingHouse(
        BoardinghouseRoom $source,
        BoardinghouseRoom $destination
    ): void {
        if ((int) $source->boarding_house_id !== (int) $destination->boarding_house_id) {
            throw ValidationException::withMessages([
                'boarding_house_room_id' => [
                    'A tenant can only be transferred within the same boarding house.',
                ],
            ]);
        }
    }

    private function syncRoomAvailability(BoardinghouseRoom $room): void
    {
        if (! in_array($room->availability_status, ['available', 'occupied'], true)) {
            return;
        }

        $activeAssignments = $room->assignments()->where('status', 'active')->count();
        $room->update([
            'availability_status' => $activeAssignments >= $room->max_occupants
                ? 'occupied'
                : 'available',
        ]);
    }
}
