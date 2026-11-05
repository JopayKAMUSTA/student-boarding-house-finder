<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

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
            ->with('ownerProfile:id,user_id,contact_number,business_name,business_address,verification_status,verified_at,created_at,updated_at')
            ->latest()
            ->paginate(15);

        return response()->json([
            'success' => true,
            'data' => $owners,
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
        ]);

        $ownerProfile = $owner->ownerProfile;
        abort_if($ownerProfile === null, 404);

        $ownerProfile->verification_status = $validated['verification_status'];
        $ownerProfile->verified_at = $validated['verification_status'] === 'approved'
            ? now()
            : null;
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
