<?php

namespace App\Http\Controllers;

use App\Models\BoardingHousePaymentMethod;
use App\Models\Boardinghouse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

class OwnerBoardingHousePaymentMethodController extends Controller
{
    public function index(Request $request, Boardinghouse $boardingHouse): JsonResponse
    {
        $this->authorizeHouse($request, $boardingHouse);

        return response()->json([
            'success' => true,
            'data' => $boardingHouse->paymentMethods()->latest('id')->get()
                ->map(fn (BoardingHousePaymentMethod $method) =>
                    $this->presentMethod($method, $boardingHouse)
                ),
        ]);
    }

    public function store(Request $request, Boardinghouse $boardingHouse): JsonResponse
    {
        $this->authorizeHouse($request, $boardingHouse);
        $validated = $request->validate([
            'provider' => ['required', 'string', 'max:100'],
            'account_name' => ['required', 'string', 'max:255'],
            'account_number' => ['required', 'string', 'max:100'],
            'qr_code' => ['required', 'image', 'mimes:jpeg,png,webp', 'max:5120'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $path = Storage::disk('public')->putFile(
            'boarding-house-payment-methods',
            $validated['qr_code']
        );
        if (! is_string($path)) {
            throw new RuntimeException('The payment QR image could not be stored.');
        }

        try {
            $method = DB::transaction(fn (): BoardingHousePaymentMethod =>
                $boardingHouse->paymentMethods()->create([
                    'provider' => $validated['provider'],
                    'account_name' => $validated['account_name'],
                    'account_number' => $validated['account_number'],
                    'qr_image_path' => $path,
                    'is_active' => $validated['is_active'] ?? true,
                ])
            );
        } catch (Throwable $exception) {
            Storage::disk('public')->delete($path);
            throw $exception;
        }

        return response()->json([
            'success' => true,
            'message' => 'Payment method created successfully.',
            'data' => $this->presentMethod($method, $boardingHouse),
        ], 201);
    }

    public function update(
        Request $request,
        Boardinghouse $boardingHouse,
        BoardingHousePaymentMethod $paymentMethod
    ): JsonResponse {
        $this->authorizeMethod($request, $boardingHouse, $paymentMethod);
        $validated = $request->validate([
            'provider' => ['required', 'string', 'max:100'],
            'account_name' => ['required', 'string', 'max:255'],
            'account_number' => ['required', 'string', 'max:100'],
            'qr_code' => ['sometimes', 'image', 'mimes:jpeg,png,webp', 'max:5120'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $newPath = null;
        if (isset($validated['qr_code'])) {
            $newPath = Storage::disk('public')->putFile(
                'boarding-house-payment-methods',
                $validated['qr_code']
            );
            if (! is_string($newPath)) {
                throw new RuntimeException('The replacement payment QR image could not be stored.');
            }
        }

        $oldPath = $paymentMethod->qr_image_path;
        try {
            $paymentMethod = DB::transaction(function () use (
                $paymentMethod,
                $validated,
                $newPath
            ): BoardingHousePaymentMethod {
                $lockedMethod = BoardingHousePaymentMethod::query()
                    ->lockForUpdate()
                    ->findOrFail($paymentMethod->id);
                $lockedMethod->fill([
                    'provider' => $validated['provider'],
                    'account_name' => $validated['account_name'],
                    'account_number' => $validated['account_number'],
                    'is_active' => $validated['is_active'] ?? $lockedMethod->is_active,
                ]);
                if ($newPath !== null) {
                    $lockedMethod->qr_image_path = $newPath;
                }
                $lockedMethod->save();

                return $lockedMethod;
            });
        } catch (Throwable $exception) {
            if ($newPath !== null) {
                Storage::disk('public')->delete($newPath);
            }
            throw $exception;
        }

        if ($newPath !== null && ! Storage::disk('public')->delete($oldPath)) {
            throw new RuntimeException('The replaced payment QR image could not be removed.');
        }

        return response()->json([
            'success' => true,
            'message' => 'Payment method updated successfully.',
            'data' => $this->presentMethod($paymentMethod, $boardingHouse),
        ]);
    }

    public function updateStatus(
        Request $request,
        Boardinghouse $boardingHouse,
        BoardingHousePaymentMethod $paymentMethod
    ): JsonResponse {
        $this->authorizeMethod($request, $boardingHouse, $paymentMethod);
        $validated = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);
        $paymentMethod->update(['is_active' => $validated['is_active']]);

        return response()->json([
            'success' => true,
            'message' => 'Payment method status updated successfully.',
            'data' => $this->presentMethod($paymentMethod->fresh(), $boardingHouse),
        ]);
    }

    public function destroy(
        Request $request,
        Boardinghouse $boardingHouse,
        BoardingHousePaymentMethod $paymentMethod
    ): JsonResponse {
        $this->authorizeMethod($request, $boardingHouse, $paymentMethod);
        $path = $paymentMethod->qr_image_path;
        $paymentMethod->delete();
        if (! Storage::disk('public')->delete($path)) {
            throw new RuntimeException('The payment QR image could not be removed.');
        }

        return response()->json([
            'success' => true,
            'message' => 'Payment method deleted successfully.',
        ]);
    }

    public function showQr(
        Request $request,
        Boardinghouse $boardingHouse,
        BoardingHousePaymentMethod $paymentMethod
    ) {
        $this->authorizeMethod($request, $boardingHouse, $paymentMethod);
        abort_unless(Storage::disk('public')->exists($paymentMethod->qr_image_path), 404);

        return Storage::disk('public')->response($paymentMethod->qr_image_path);
    }

    private function authorizeHouse(Request $request, Boardinghouse $boardingHouse): void
    {
        abort_unless($request->user()?->role === 'owner', 403);
        abort_unless((int) $boardingHouse->owner_id === (int) $request->user()->id, 404);
    }

    private function authorizeMethod(
        Request $request,
        Boardinghouse $boardingHouse,
        BoardingHousePaymentMethod $paymentMethod
    ): void {
        $this->authorizeHouse($request, $boardingHouse);
        abort_unless(
            (int) $paymentMethod->boarding_house_id === (int) $boardingHouse->id,
            404
        );
    }

    private function presentMethod(
        BoardingHousePaymentMethod $method,
        Boardinghouse $boardingHouse
    ): BoardingHousePaymentMethod {
        return $method->setAttribute(
            'qr_code_url',
            route('owner.boarding-houses.payment-methods.qr', [
                'boardingHouse' => $boardingHouse->id,
                'paymentMethod' => $method->id,
            ])
        );
    }
}
