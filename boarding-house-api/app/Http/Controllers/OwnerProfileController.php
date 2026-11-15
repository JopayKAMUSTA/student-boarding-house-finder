<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\JsonResponse;

class OwnerProfileController extends Controller
{
    public function show(Request $request)
    {
        $user = $request->user();

        if ($user->role !== 'owner') {
            return response()->json([
                'message' => 'Unauthorized access.',
            ], 403);
        }

        $profile = $user->ownerProfile()->firstOrCreate([]);

$nameParts = preg_split('/\s+/', trim($user->name), 3);
        return response()->json([
            'user' => [
                'id' => $user->id,
                'first_name' => $nameParts[0] ?? '',
                'middle_name' => '',
                'last_name' => $nameParts[1] ?? '',
                'email' => $user->email,
                'role' => $user->role,
                'created_at' => $user->created_at,
            ],
                'profile' => [
                    'contact_number' => $profile->contact_number,
                    'business_name' => $profile->business_name,
                    'business_address' => $profile->business_address,
                    'verification_status' => $profile->verification_status,
                    'verified_at' => $profile->verified_at,
                    'valid_id_front' => $profile->valid_id_front,
                    'valid_id_back' => $profile->valid_id_back,
                    'rejection_reason' => $profile->rejection_reason,
                ],
        ]);
    }

    public function changePassword(Request $request)
{
    $user = $request->user();

    if ($user->role !== 'owner') {
        return response()->json([
            'message' => 'Unauthorized access.',
        ], 403);
    }

    $validated = $request->validate([
        'current_password' => ['required', 'string'],
        'new_password' => ['required', 'string', 'min:8', 'confirmed'],
    ]);

    if (!Hash::check($validated['current_password'], $user->password)) {
        return response()->json([
            'message' => 'Your current password is incorrect.',
        ], 422);
    }

    $user->update([
        'password' => Hash::make($validated['new_password']),
    ]);

    return response()->json([
        'message' => 'Password changed successfully.',
    ]);
}

    public function update(Request $request)
    {
        $user = $request->user();

        if ($user->role !== 'owner') {
            return response()->json([
                'message' => 'Unauthorized access.',
            ], 403);
        }

        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($user->id),
            ],
'contact_number' => [
    'nullable',
    'string',
    'regex:/^09[0-9]{9}$/',
],            'business_name' => ['nullable', 'string', 'max:255'],
            'business_address' => ['nullable', 'string', 'max:255'],
        ]);

        $fullName = collect([
            $validated['first_name'],
            $validated['middle_name'] ?? null,
            $validated['last_name'],
        ])->filter()->implode(' ');

        DB::transaction(function () use ($user, $validated, $fullName) {
            $user->update([
                'name' => $fullName,
                'email' => $validated['email'],
            ]);

            $user->ownerProfile()->firstOrCreate([]);

            $user->ownerProfile()->update([
                'contact_number' => $validated['contact_number'] ?? null,
                'business_name' => $validated['business_name'] ?? null,
                'business_address' => $validated['business_address'] ?? null,
            ]);
        });

        return response()->json([
            'message' => 'Owner profile updated successfully.',
        ]);
    }
public function submitIdentityDocuments(Request $request): JsonResponse
{
    $user = $request->user();

    if ($user->role !== 'owner') {
        return response()->json([
            'message' => 'Unauthorized access.',
        ], 403);
    }

    $validated = $request->validate([
        'valid_id_front' => [
            'required',
            'image',
            'mimes:jpg,jpeg,png,webp',
            'max:5120',
        ],
        'valid_id_back' => [
            'required',
            'image',
            'mimes:jpg,jpeg,png,webp',
            'max:5120',
        ],
    ]);

    $profile = $user->ownerProfile()->firstOrCreate([]);

    if ($profile->verification_status === 'approved') {
        return response()->json([
            'message' => 'Your owner account is already verified.',
        ], 422);
    }

    if (
        $profile->verification_status === 'pending' &&
        $profile->valid_id_front &&
        $profile->valid_id_back
    ) {
        return response()->json([
            'message' => 'Your ID documents are already awaiting review.',
        ], 422);
    }

    $oldFront = $profile->valid_id_front;
    $oldBack = $profile->valid_id_back;

    $frontPath = $request->file('valid_id_front')
        ->store('owner-ids', 'local');

    $backPath = $request->file('valid_id_back')
        ->store('owner-ids', 'local');

    $profile->update([
        'valid_id_front' => $frontPath,
        'valid_id_back' => $backPath,
        'verification_status' => 'pending',
        'verified_at' => null,
        'rejection_reason' => null,
    ]);

    if ($oldFront) {
        Storage::disk('local')->delete($oldFront);
    }

    if ($oldBack) {
        Storage::disk('local')->delete($oldBack);
    }

    return response()->json([
        'success' => true,
        'message' => 'Your ID documents have been submitted for verification.',
        'data' => [
            'verification_status' => $profile->verification_status,
        ],
    ]);
}
}

