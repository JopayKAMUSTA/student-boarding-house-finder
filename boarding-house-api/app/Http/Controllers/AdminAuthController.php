<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AdminAuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid email or password.',
            ], 401);
        }

        if ($user->role !== 'admin' || $user->status !== 'active') {
            return response()->json([
                'success' => false,
                'message' => 'Only active Admin accounts can access the Admin portal.',
            ], 403);
        }

        return response()->json([
            'success' => true,
            'message' => 'Login successful.',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'first_name' => $user->first_name,
                'middle_name' => $user->middle_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'role' => $user->role,
                'status' => $user->status,
                'token' => $user->createToken('tagstay-admin')->plainTextToken,
            ],
        ]);
    }
}
