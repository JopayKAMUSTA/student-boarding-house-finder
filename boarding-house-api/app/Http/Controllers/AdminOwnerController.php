<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Storage;
use App\Models\Boardinghouse;

class AdminOwnerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $owners = User::query()
            ->where('role', 'owner')
            ->select([
                'id',
                'name',
                'first_name',
                'middle_name',
                'last_name',
                'email',
                'role',
                'status',
                'created_at',
                'updated_at',
            ])
->with('ownerProfile:id,user_id,contact_number,business_name,business_address,verification_status,verified_at,valid_id_front,valid_id_back,rejection_reason,created_at,updated_at')            ->latest()
            ->paginate(15);

        return response()->json([
            'success' => true,
            'data' => $owners,
        ]);
    }

public function viewIdentityDocument(
    Request $request,
    User $owner,
    string $side
) {
    $this->authorizeAdmin($request);
    abort_unless($owner->role === 'owner', 404);

    abort_unless(
        in_array($side, ['front', 'back'], true),
        404
    );

    $profile = $owner->ownerProfile;

    abort_if($profile === null, 404);

    $path = $side === 'front'
        ? $profile->valid_id_front
        : $profile->valid_id_back;

    abort_if(!$path, 404);

    $disk = Storage::disk('local');

    abort_unless($disk->exists($path), 404);

    return response()->file($disk->path($path));
}


public function show(Request $request, User $owner): JsonResponse
{
    $this->authorizeAdmin($request);
    abort_unless($owner->role === 'owner', 404);

    $owner->load('ownerProfile');

    $boardingHouses = Boardinghouse::query()
        ->where('owner_id', $owner->id)
        ->withCount('rooms')
        ->latest()
        ->get([
            'id',
            'owner_id',
            'name',
            'city',
            'barangay',
            'address',
            'status',
            'available_rooms',
            'total_rooms',
            'created_at',
        ]);

    return response()->json([
        'success' => true,
        'data' => [
            'id' => $owner->id,
            'name' => $owner->name,
            'first_name' => $owner->first_name,
            'middle_name' => $owner->middle_name,
            'last_name' => $owner->last_name,
            'email' => $owner->email,
            'role' => $owner->role,
            'status' => $owner->status,
            'created_at' => $owner->created_at,
            'owner_profile' => $owner->ownerProfile,
            'boarding_houses' => $boardingHouses,
        ],
    ]);
}

   
public function updateVerification(
    Request $request,
    User $owner
): JsonResponse {
    $this->authorizeAdmin($request);
    abort_unless($owner->role === 'owner', 404);

    $validated = $request->validate([
        'verification_status' => [
            'required',
            Rule::in(['approved', 'rejected']),
        ],
        'rejection_reason' => [
            'required_if:verification_status,rejected',
            'nullable',
            'string',
            'max:2000',
        ],
    ]);

    $ownerProfile = $owner->ownerProfile;
    abort_if($ownerProfile === null, 404);

    if ($validated['verification_status'] === 'approved') {
        if (
            !$ownerProfile->valid_id_front ||
            !$ownerProfile->valid_id_back
        ) {
            return response()->json([
                'message' => 'The owner has not submitted both sides of their valid ID.',
            ], 422);
        }

        $ownerProfile->verified_at = now();
        $ownerProfile->rejection_reason = null;
    } else {
        $ownerProfile->verified_at = null;
        $ownerProfile->rejection_reason = $validated['rejection_reason'];
    }

    $ownerProfile->verification_status = $validated['verification_status'];
    $ownerProfile->save();

    return response()->json([
        'success' => true,
        'message' => $validated['verification_status'] === 'approved'
            ? 'Owner verification approved.'
            : 'Owner verification rejected.',
        'data' => $owner->load('ownerProfile'),
    ]);
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
