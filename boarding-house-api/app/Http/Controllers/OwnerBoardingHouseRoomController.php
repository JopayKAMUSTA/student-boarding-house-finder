<?php

namespace App\Http\Controllers;

use App\Models\Boardinghouse;
use App\Models\BoardinghouseRoom;
use App\Models\RoomImage;
use App\Models\RoomAssignment;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

class OwnerBoardingHouseRoomController extends Controller
{
    public function index(Request $request, Boardinghouse $boardingHouse): JsonResponse
    {
        $this->authorizeOwner($request, $boardingHouse);

        $rooms = $boardingHouse->rooms()
            ->with('images')
            ->latest()
            ->paginate(20);
        $rooms->getCollection()->each(
            fn (BoardinghouseRoom $room) => $this->appendImageUrls($room, $boardingHouse)
        );

        return response()->json([
            'success' => true,
            'boarding_house' => $boardingHouse->only([
                'id', 'name', 'address', 'barangay', 'city',
            ]),
            'data' => $rooms,
        ]);
    }

    public function show(
        Request $request,
        Boardinghouse $boardingHouse,
        BoardinghouseRoom $room
    ): JsonResponse {
        $this->authorizeRoom($request, $boardingHouse, $room);

        $occupants = $room->assignments()
            ->where('status', 'active')
            ->whereHas(
                'tenant',
                fn (Builder $query) => $query->where('owner_id', $request->user()->id)
            )
            ->with('tenant:id,full_name,contact_number,emergency_contact_name,emergency_contact_number')
            ->get()
            ->map(fn (RoomAssignment $assignment) => [
                'tenant_id' => $assignment->tenant->id,
                'full_name' => $assignment->tenant->full_name,
                'contact_number' => $assignment->tenant->contact_number,
                'emergency_contact_name' => $assignment->tenant->emergency_contact_name,
                'emergency_contact_number' => $assignment->tenant->emergency_contact_number,
                'move_in_date' => $assignment->move_in_date?->toDateString(),
                'monthly_rent' => $assignment->monthly_rent,
                'status' => $assignment->status,
            ]);
        $room->setAttribute('current_occupants', $occupants);
        $room->setAttribute('current_occupant_count', $occupants->count());

        return response()->json([
            'success' => true,
            'data' => $this->appendImageUrls($room->load('images'), $boardingHouse),
        ]);
    }

    public function store(Request $request, Boardinghouse $boardingHouse): JsonResponse
    {
        $this->authorizeOwner($request, $boardingHouse);
        $validated = $this->validateRoom($request, $boardingHouse);
        $images = $validated['images'] ?? [];
        unset($validated['images']);

        $storedPaths = [];
        try {
            $room = DB::transaction(function () use (
                $boardingHouse,
                $validated,
                $images,
                &$storedPaths
            ): BoardinghouseRoom {
                $room = $boardingHouse->rooms()->create($validated);
                $this->storeImages($room, $images, $storedPaths);

                return $room->load('images');
            });
        } catch (Throwable $exception) {
            Storage::disk('public')->delete($storedPaths);
            throw $exception;
        }

        return response()->json([
            'success' => true,
            'message' => 'Room created successfully.',
            'data' => $this->appendImageUrls($room, $boardingHouse),
        ], 201);
    }

    public function update(
        Request $request,
        Boardinghouse $boardingHouse,
        BoardinghouseRoom $room
    ): JsonResponse {
        $this->authorizeRoom($request, $boardingHouse, $room);
        $validated = $this->validateRoom($request, $boardingHouse, $room);
        $images = $validated['images'] ?? [];
        unset($validated['images']);

        $storedPaths = [];
        try {
            $room = DB::transaction(function () use (
                $room,
                $validated,
                $images,
                &$storedPaths
            ): BoardinghouseRoom {
                $lockedRoom = BoardinghouseRoom::query()
                    ->lockForUpdate()
                    ->findOrFail($room->id);
                $activeAssignments = $lockedRoom->assignments()
                    ->where('status', 'active')
                    ->count();

                if ($validated['max_occupants'] < $activeAssignments) {
                    throw ValidationException::withMessages([
                        'max_occupants' => [
                            'Room capacity cannot be lower than its current active occupancy.',
                        ],
                    ]);
                }

                if (in_array($validated['availability_status'], ['available', 'occupied'], true)) {
                    $validated['availability_status'] = $activeAssignments >= $validated['max_occupants']
                        ? 'occupied'
                        : 'available';
                }

                $room->update($validated);
                $this->storeImages($room, $images, $storedPaths);

                return $room->fresh()->load('images');
            });
        } catch (Throwable $exception) {
            Storage::disk('public')->delete($storedPaths);
            throw $exception;
        }

        return response()->json([
            'success' => true,
            'message' => 'Room updated successfully.',
            'data' => $this->appendImageUrls($room, $boardingHouse),
        ]);
    }

    public function destroy(
        Request $request,
        Boardinghouse $boardingHouse,
        BoardinghouseRoom $room
    ): JsonResponse {
        $this->authorizeRoom($request, $boardingHouse, $room);
        if ($room->assignments()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Rooms with assignment history cannot be deleted.',
            ], 409);
        }

        $imagePaths = $room->images()->pluck('image_path')->all();
        $room->delete();
        Storage::disk('public')->delete($imagePaths);

        return response()->json([
            'success' => true,
            'message' => 'Room deleted successfully.',
        ]);
    }

    public function uploadImages(
        Request $request,
        Boardinghouse $boardingHouse,
        BoardinghouseRoom $room
    ): JsonResponse {
        $this->authorizeRoom($request, $boardingHouse, $room);
        $validated = $request->validate([
            'images' => ['required', 'array', 'min:1', 'max:10'],
            'images.*' => ['required', 'image', 'mimes:jpeg,png,webp', 'max:5120'],
        ]);

        $storedPaths = [];
        try {
            DB::transaction(function () use ($room, $validated, &$storedPaths): void {
                $this->storeImages($room, $validated['images'], $storedPaths);
            });
        } catch (Throwable $exception) {
            Storage::disk('public')->delete($storedPaths);
            throw $exception;
        }

        return response()->json([
            'success' => true,
            'message' => 'Room photos uploaded successfully.',
            'data' => $this->appendImageUrls(
                $room->fresh()->load('images'),
                $boardingHouse
            ),
        ], 201);
    }

    public function showImage(
        Request $request,
        Boardinghouse $boardingHouse,
        BoardinghouseRoom $room,
        RoomImage $image
    ) {
        $this->authorizeRoom($request, $boardingHouse, $room);
        abort_unless((int) $image->boarding_house_room_id === (int) $room->id, 404);
        abort_unless(Storage::disk('public')->exists($image->image_path), 404);

        return Storage::disk('public')->response($image->image_path);
    }

    public function destroyImage(
        Request $request,
        Boardinghouse $boardingHouse,
        BoardinghouseRoom $room,
        RoomImage $image
    ): JsonResponse {
        $this->authorizeRoom($request, $boardingHouse, $room);
        abort_unless($image->boarding_house_room_id === $room->id, 404);

        $disk = Storage::disk('public');
        if ($disk->exists($image->image_path) && !$disk->delete($image->image_path)) {
            throw new RuntimeException('The room photo could not be removed from storage.');
        }
        $image->delete();

        return response()->json([
            'success' => true,
            'message' => 'Room photo removed successfully.',
        ]);
    }

    private function authorizeOwner(Request $request, Boardinghouse $boardingHouse): void
    {
        abort_unless(
            $request->user()?->role === 'owner' &&
            (int) $boardingHouse->owner_id === (int) $request->user()->id,
            403
        );
    }

    private function authorizeRoom(
        Request $request,
        Boardinghouse $boardingHouse,
        BoardinghouseRoom $room
    ): void {
        $this->authorizeOwner($request, $boardingHouse);
        abort_unless((int) $room->boarding_house_id === (int) $boardingHouse->id, 404);
    }

    private function validateRoom(
        Request $request,
        Boardinghouse $boardingHouse,
        ?BoardinghouseRoom $room = null
    ): array {
        return $request->validate([
            'room_number' => [
                'required', 'string', 'max:100',
                Rule::unique('boarding_house_rooms', 'room_number')
                    ->where('boarding_house_id', $boardingHouse->id)
                    ->ignore($room?->id),
            ],
            'room_type' => [
                'required',
                Rule::in(['Single Room', 'Double-Sharing Room', 'Shared Room']),
            ],
            'monthly_rent' => ['required', 'numeric', 'gt:0', 'max:99999999.99'],
            'pricing_basis' => ['required', Rule::in(['per_person', 'entire_room'])],
            'max_occupants' => ['required', 'integer', 'min:1', 'max:65535'],
            'availability_status' => [
                'required',
                Rule::in(['available', 'occupied', 'reserved', 'under_maintenance']),
            ],
            'description' => ['nullable', 'string', 'max:10000'],
            'amenities' => ['nullable', 'array', 'max:30'],
            'amenities.*' => ['required', 'string', 'max:100'],
            'images' => ['sometimes', 'array', 'max:10'],
            'images.*' => ['required', 'image', 'mimes:jpeg,png,webp', 'max:5120'],
        ]);
    }

    /**
     * @param array<int, UploadedFile> $images
     * @param array<int, string> $storedPaths
     */
    private function storeImages(
        BoardinghouseRoom $room,
        array $images,
        array &$storedPaths
    ): void {
        foreach ($images as $image) {
            $path = Storage::disk('public')->putFile('room-images', $image);
            if ($path === false) {
                throw new RuntimeException('A room photo could not be saved.');
            }

            $storedPaths[] = $path;
            $room->images()->create(['image_path' => $path]);
        }
    }

    private function appendImageUrls(
        BoardinghouseRoom $room,
        Boardinghouse $boardingHouse
    ): BoardinghouseRoom
    {
        $room->images->each(
            fn (RoomImage $image) => $image->setAttribute(
                'url',
                route('owner.boarding-houses.rooms.images.show', [
                    'boardingHouse' => $boardingHouse->id,
                    'room' => $room->id,
                    'image' => $image->id,
                ])
            )
        );

        return $room;
    }
}
