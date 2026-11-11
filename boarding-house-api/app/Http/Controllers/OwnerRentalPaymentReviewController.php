<?php

namespace App\Http\Controllers;

use App\Models\RentalBill;
use App\Models\RentalPayment;
use App\Services\RentalBillBalanceCalculator;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OwnerRentalPaymentReviewController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeOwner($request);
        $validated = $request->validate([
            'status' => ['nullable', 'in:pending,approved,rejected'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $payments = RentalPayment::query()
            ->whereHas(
                'bill.roomAssignment.tenant',
                fn (Builder $query) => $query->where('owner_id', $request->user()->id)
            )
            ->when(
                isset($validated['status']),
                fn (Builder $query) => $query->where('status', $validated['status'])
            )
            ->with([
                'recordedBy:id,name',
                'reviewedBy:id,name',
                'bill.roomAssignment.tenant',
                'bill.roomAssignment.boardingHouseRoom.boardingHouse',
            ])
            ->latest('id')
            ->paginate($validated['per_page'] ?? 15);

        return response()->json(['success' => true, 'data' => $payments]);
    }

    public function approve(Request $request, RentalPayment $payment): JsonResponse
    {
        $this->authorizeOwnedPayment($request, $payment);
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'decimal:0,2', 'min:0.01', 'max:99999999.99'],
            'payment_date' => ['required', 'date_format:Y-m-d'],
            'amount_adjustment_reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $approvedPayment = DB::transaction(function () use ($request, $payment, $validated) {
            /** @var RentalBill $bill */
            $bill = $this->ownedBills($request)
                ->whereKey($payment->rental_bill_id)
                ->lockForUpdate()
                ->firstOrFail();
            /** @var RentalPayment $lockedPayment */
            $lockedPayment = $bill->payments()
                ->whereKey($payment->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedPayment->status !== 'pending' || $lockedPayment->voided_at !== null) {
                throw ValidationException::withMessages([
                    'payment' => ['Only a pending, non-voided submission can be approved.'],
                ]);
            }
            if ($bill->is_voided) {
                throw ValidationException::withMessages([
                    'bill' => ['Payments cannot be approved against a voided bill.'],
                ]);
            }

            $submittedCents = RentalBill::toCents(
                $lockedPayment->submitted_amount ?? $lockedPayment->amount
            );
            $verifiedCents = RentalBill::toCents($validated['amount']);
            if (
                $submittedCents !== $verifiedCents &&
                empty(trim($validated['amount_adjustment_reason'] ?? ''))
            ) {
                throw ValidationException::withMessages([
                    'amount_adjustment_reason' => [
                        'A reason is required when changing the submitted amount.',
                    ],
                ]);
            }

            $bill->setRelation('payments', $bill->payments()->lockForUpdate()->get());
            $paymentDate = CarbonImmutable::parse(
                $validated['payment_date'],
                config('app.timezone', 'UTC')
            )->startOfDay();
            $calculator = app(RentalBillBalanceCalculator::class);
            $balance = $calculator->calculate($bill, $paymentDate)['_total_outstanding_cents'];
            if ($verifiedCents > $balance) {
                throw ValidationException::withMessages([
                    'amount' => ['The verified payment cannot exceed the outstanding balance on the payment date.'],
                ]);
            }

            $latestEffectiveDate = $bill->payments
                ->where('status', 'approved')
                ->whereNull('voided_at')
                ->map(fn (RentalPayment $existingPayment): string =>
                    $existingPayment->payment_date->toDateString()
                )
                ->push($paymentDate->toDateString())
                ->max();
            $historySummary = $calculator->calculate(
                $bill,
                CarbonImmutable::parse($latestEffectiveDate, config('app.timezone', 'UTC')),
                [
                    'amount' => $validated['amount'],
                    'payment_date' => $validated['payment_date'],
                ]
            );
            if ($historySummary['has_overpayment']) {
                throw ValidationException::withMessages([
                    'amount' => ['The verified amount would overpay the bill when applied to its dated payment history.'],
                ]);
            }

            $lockedPayment->forceFill([
                'amount' => $validated['amount'],
                'payment_date' => $validated['payment_date'],
                'status' => 'approved',
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(config('app.timezone', 'UTC')),
                'amount_adjustment_reason' => $submittedCents === $verifiedCents
                    ? null
                    : trim($validated['amount_adjustment_reason']),
            ])->save();

            return $lockedPayment->load([
                'recordedBy:id,name',
                'reviewedBy:id,name',
                'voidedBy:id,name',
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Payment submission approved.',
            'data' => $approvedPayment,
            'bill' => $this->loadBill($payment->bill->fresh()),
        ]);
    }

    public function reject(Request $request, RentalPayment $payment): JsonResponse
    {
        $this->authorizeOwnedPayment($request, $payment);
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        $rejectedPayment = DB::transaction(function () use ($request, $payment, $validated) {
            $bill = $this->ownedBills($request)
                ->whereKey($payment->rental_bill_id)
                ->lockForUpdate()
                ->firstOrFail();
            $lockedPayment = $bill->payments()
                ->whereKey($payment->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedPayment->status !== 'pending' || $lockedPayment->voided_at !== null) {
                throw ValidationException::withMessages([
                    'payment' => ['Only a pending, non-voided submission can be rejected.'],
                ]);
            }

            $lockedPayment->forceFill([
                'status' => 'rejected',
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(config('app.timezone', 'UTC')),
                'rejection_reason' => trim($validated['reason']),
            ])->save();

            return $lockedPayment->load(['recordedBy:id,name', 'reviewedBy:id,name']);
        });

        return response()->json([
            'success' => true,
            'message' => 'Payment submission rejected.',
            'data' => $rejectedPayment,
            'bill' => $this->loadBill($payment->bill->fresh()),
        ]);
    }

    public function proof(Request $request, RentalPayment $payment): StreamedResponse
    {
        abort_unless($payment->proof_path, 404);
        $user = $request->user();
        $ownerCanView = $user?->role === 'owner' && $this->ownedBills($request)
            ->whereKey($payment->rental_bill_id)
            ->exists();
        $tenantCanView = $user?->role === 'student' && $payment->bill()
            ->whereHas(
                'roomAssignment.tenant',
                fn (Builder $query) => $query->where('user_id', $user->id)
            )
            ->exists();
        abort_unless($ownerCanView || $tenantCanView, 404);

        abort_unless(Storage::disk('local')->exists($payment->proof_path), 404);

        return Storage::disk('local')->response($payment->proof_path);
    }

    private function authorizeOwner(Request $request): void
    {
        abort_unless($request->user()?->role === 'owner', 403);
    }

    private function authorizeOwnedPayment(Request $request, RentalPayment $payment): void
    {
        $this->authorizeOwner($request);
        abort_unless(
            $this->ownedBills($request)->whereKey($payment->rental_bill_id)->exists(),
            404
        );
    }

    private function ownedBills(Request $request): Builder
    {
        return RentalBill::query()->whereHas(
            'roomAssignment.tenant',
            fn (Builder $query) => $query->where('owner_id', $request->user()->id)
        );
    }

    private function loadBill(RentalBill $bill): RentalBill
    {
        return $bill->load([
            'roomAssignment.tenant',
            'roomAssignment.boardingHouseRoom.boardingHouse',
            'payments.recordedBy:id,name',
            'payments.reviewedBy:id,name',
            'payments.voidedBy:id,name',
        ]);
    }
}
