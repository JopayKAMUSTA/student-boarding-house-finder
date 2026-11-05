<?php

namespace App\Http\Controllers;

use App\Models\Boardinghouse;
use App\Models\BoardinghouseRoom;
use App\Models\RoomImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class AdminBoardinghouseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'status' => ['nullable', Rule::in(['pending', 'approved', 'rejected'])],
        ]);

        $boardingHouses = Boardinghouse::query()
            ->with([
                'owner:id,name,first_name,middle_name,last_name,email,role,status',
                'owner.ownerProfile:id,user_id,contact_number,business_name,business_address,verification_status,verified_at',
            ])
            ->when(
                $validated['status'] ?? null,
                fn ($query, $status) => $query->where('status', $status)
            )
            ->latest()
            ->paginate(15);

        return response()->json([
            'success' => true,
            'data' => $boardingHouses,
        ]);
    }

    public function show(Request $request, Boardinghouse $boardingHouse): JsonResponse
    {
        $this->authorizeAdmin($request);

        $boardingHouse->load([
            'owner:id,name,first_name,middle_name,last_name,email,role,status',
            'owner.ownerProfile:id,user_id,contact_number,business_name,business_address,verification_status,verified_at',
            'rooms.images',
        ]);

        $boardingHouse->rooms->each(
            fn (BoardinghouseRoom $room) => $room->images->each(
                fn (RoomImage $image) => $image->setAttribute(
                    'url',
                    route('admin.boarding-houses.rooms.images.show', [
                        'boardingHouse' => $boardingHouse->id,
                        'room' => $room->id,
                        'image' => $image->id,
                    ])
                )
            )
        );

        return response()->json([
            'success' => true,
            'data' => $boardingHouse,
        ]);
    }

    public function updateStatus(Request $request, Boardinghouse $boardingHouse): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'status' => ['required', Rule::in(['approved', 'rejected'])],
        ]);

        $boardingHouse->status = $validated['status'];
        $boardingHouse->save();

        return response()->json([
            'success' => true,
            'message' => $validated['status'] === 'approved'
                ? 'Boarding house approved.'
                : 'Boarding house rejected.',
            'data' => $boardingHouse->fresh(),
        ]);
    }

    public function showImage(
        Request $request,
        Boardinghouse $boardingHouse,
        BoardinghouseRoom $room,
        RoomImage $image
    ) {
        $this->authorizeAdmin($request);

        abort_unless((int) $room->boarding_house_id === (int) $boardingHouse->id, 404);
        abort_unless((int) $image->boarding_house_room_id === (int) $room->id, 404);
        abort_unless(Storage::disk('public')->exists($image->image_path), 404);

        return Storage::disk('public')->response($image->image_path);
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless(
            $request->user()?->role === 'admin' &&
            $request->user()?->status === 'active',
            403
        );
    }
}
