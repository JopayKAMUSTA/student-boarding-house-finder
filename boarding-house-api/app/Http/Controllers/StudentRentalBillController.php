<?php

namespace App\Http\Controllers;

use App\Models\RentalBill;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StudentRentalBillController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->role === 'student', 403);

        $validated = $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        $bills = RentalBill::query()
            ->whereHas(
                'roomAssignment.tenant',
                fn (Builder $query) => $query->where(
                    'user_id',
                    $request->user()->id
                )
            )
            ->with([
                'roomAssignment.tenant:id,user_id,full_name',
                'roomAssignment.boardingHouseRoom.boardingHouse:id,name,address,city',
                'payments',
            ])
            ->latest('due_date')
            ->latest('id')
            ->paginate($validated['per_page'] ?? 15);

        return response()->json([
            'success' => true,
            'data' => $bills,
        ]);
    }
}
