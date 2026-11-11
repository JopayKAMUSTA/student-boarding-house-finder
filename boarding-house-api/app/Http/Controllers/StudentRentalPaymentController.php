<?php

namespace App\Http\Controllers;

use App\Models\RentalBill;
use App\Models\RentalPayment;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Throwable;

class StudentRentalPaymentController extends Controller
{
    public function submit(Request $request, RentalBill $bill): JsonResponse
    {
        abort_unless($request->user()?->role === 'student', 403);
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'decimal:0,2', 'min:0.01', 'max:99999999.99'],
            'payment_date' => ['required', 'date_format:Y-m-d'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'proof' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
        ]);

        $tenantExists = Tenant::query()
            ->where('user_id', $request->user()->id)
            ->whereHas('assignments', fn ($query) => $query->whereKey($bill->room_assignment_id))
            ->exists();
        abort_unless($tenantExists, 404);
        abort_if($bill->is_voided, 422, 'Payments cannot be submitted for a voided bill.');

        /** @var UploadedFile $proof */
        $proof = $validated['proof'];
        $proofPath = Storage::disk('local')->putFile('rental-payment-proofs', $proof);
        if (! is_string($proofPath)) {
            throw new \RuntimeException('The payment proof could not be stored.');
        }

        try {
            $payment = DB::transaction(fn (): RentalPayment => $bill->payments()->create([
                'amount' => $validated['amount'],
                'submitted_amount' => $validated['amount'],
                'payment_date' => $validated['payment_date'],
                'submitted_payment_date' => $validated['payment_date'],
                'status' => 'pending',
                'proof_path' => $proofPath,
                'notes' => $validated['notes'] ?? null,
                'recorded_by' => $request->user()->id,
            ]));
        } catch (Throwable $exception) {
            Storage::disk('local')->delete($proofPath);
            throw $exception;
        }

        return response()->json([
            'success' => true,
            'message' => 'Payment submitted for owner review.',
            'data' => $payment->load('recordedBy:id,name'),
        ], 201);
    }
}
