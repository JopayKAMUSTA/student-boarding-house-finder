<?php

namespace App\Http\Controllers;

use App\Models\BoardingHousePaymentMethod;
use App\Models\RentalBill;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class StudentBoardingHousePaymentMethodController extends Controller
{
    public function index(Request $request, RentalBill $bill): JsonResponse
    {
        $this->authorizeStudentBill($request, $bill);
        $boardingHouse = $bill->roomAssignment->boardingHouseRoom->boardingHouse;
        $methods = $boardingHouse->paymentMethods()
            ->where('is_active', true)
            ->latest('id')
            ->get()
            ->map(fn (BoardingHousePaymentMethod $method) => [
                'id' => $method->id,
                'provider' => $method->provider,
                'account_name' => $method->account_name,
                'account_number' => $method->account_number,
                'qr_code_url' => route('student.rental-bills.payment-methods.qr', [
                    'bill' => $bill->id,
                    'paymentMethod' => $method->id,
                ]),
                'is_active' => $method->is_active,
            ]);

        return response()->json([
            'success' => true,
            'data' => $methods,
        ]);
    }

    public function showQr(
        Request $request,
        RentalBill $bill,
        BoardingHousePaymentMethod $paymentMethod
    ) {
        $this->authorizeStudentBill($request, $bill);
        $boardingHouseId = $bill->roomAssignment->boardingHouseRoom->boarding_house_id;
        abort_unless(
            (int) $paymentMethod->boarding_house_id === (int) $boardingHouseId &&
            $paymentMethod->is_active,
            404
        );
        abort_unless(Storage::disk('public')->exists($paymentMethod->qr_image_path), 404);

        return Storage::disk('public')->response($paymentMethod->qr_image_path);
    }

    private function authorizeStudentBill(Request $request, RentalBill $bill): void
    {
        abort_unless($request->user()?->role === 'student', 403);
        abort_unless(
            $bill->roomAssignment()->whereHas(
                'tenant',
                fn (Builder $query) => $query->where('user_id', $request->user()->id)
            )->exists(),
            404
        );
        $bill->loadMissing('roomAssignment.boardingHouseRoom.boardingHouse');
    }
}
