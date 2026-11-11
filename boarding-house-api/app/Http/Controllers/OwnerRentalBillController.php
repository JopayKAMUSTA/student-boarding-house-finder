<?php

namespace App\Http\Controllers;

use App\Models\RentalBill;
use App\Models\RentalPayment;
use App\Models\Tenant;
use App\Services\RentalBillBalanceCalculator;
use App\Services\RentalBillGenerator;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OwnerRentalBillController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeOwner($request);
        $validated = $request->validate([
            'tenant_id' => ['nullable', 'integer'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'month' => ['nullable', 'date_format:Y-m'],
        ]);

        $bills = RentalBill::query()
            ->whereHas(
                'roomAssignment.tenant',
                fn (Builder $query) => $query->where('owner_id', $request->user()->id)
            )
            ->when(
                isset($validated['tenant_id']),
                fn (Builder $query) => $query->whereHas(
                    'roomAssignment',
                    fn (Builder $assignmentQuery) => $assignmentQuery->where(
                        'tenant_id',
                        $validated['tenant_id']
                    )
                )
                ->when(
                    isset($validated['month']),
                    fn (Builder $query) => $query->whereDate(
                        'rental_period_start',
                        $validated['month'].'-01'
                    )
                )
            )
            ->with([
                'roomAssignment.tenant',
                'roomAssignment.boardingHouseRoom.boardingHouse',
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

    public function generationStatus(Request $request): JsonResponse
    {
        $this->authorizeOwner($request);
        $validated = $request->validate([
            'month' => ['nullable', 'date_format:Y-m'],
        ]);
        $timezone = config('app.timezone', 'UTC');
        $month = $validated['month'] ?? now($timezone)->format('Y-m');
        abort_if($month > now($timezone)->format('Y-m'), 422, 'Future months cannot be reconciled.');
        $periodStart = $month.'-01';
        $periodEnd = \Illuminate\Support\Carbon::parse($periodStart, $timezone)
            ->endOfMonth()
            ->toDateString();

        $assignmentIds = \App\Models\RoomAssignment::query()
            ->whereIn('status', ['active', 'moved_out'])
            ->whereDate('move_in_date', '<=', $periodEnd)
            ->where(fn (Builder $query) => $query
                ->whereNull('move_out_date')
                ->orWhereDate('move_out_date', '>=', $periodStart))
            ->whereHas(
                'tenant',
                fn (Builder $query) => $query->where('owner_id', $request->user()->id)
            )
            ->whereHas(
                'boardingHouseRoom.boardingHouse',
                fn (Builder $query) => $query->where('status', 'approved')
            )
            ->pluck('id');
        $eligible = $assignmentIds->count();
        $generated = $eligible === 0
            ? 0
            : RentalBill::query()
                ->whereIn('room_assignment_id', $assignmentIds)
                ->whereDate('rental_period_start', $periodStart)
                ->count();

        return response()->json([
            'success' => true,
            'data' => [
                'month' => $month,
                'period_start' => $periodStart,
                'period_end' => $periodEnd,
                'eligible_assignments' => $eligible,
                'generated_bills' => $generated,
                'missing_bills' => max(0, $eligible - $generated),
                'status' => $eligible === 0
                    ? 'no_assignments'
                    : ($generated >= $eligible ? 'complete' : 'pending_generation'),
                'scheduled_time' => '01:00',
                'timezone' => $timezone,
            ],
        ]);
    }

    public function store(Request $request, Tenant $tenant): JsonResponse
    {
        $this->authorizeTenant($request, $tenant);
        $validated = $request->validate([
            'room_assignment_id' => [
                'required',
                'integer',
                'exists:room_assignments,id',
            ],
            'rental_period_start' => ['required', 'date_format:Y-m-d'],
            'rental_period_end' => ['required', 'date_format:Y-m-d', 'after_or_equal:rental_period_start'],
            'due_date' => ['required', 'date_format:Y-m-d'],
        ]);

        $bill = app(RentalBillGenerator::class)->generate(
            (int) $validated['room_assignment_id'],
            $validated['rental_period_start'],
            $validated['rental_period_end'],
            $validated['due_date'],
            tenantId: (int) $tenant->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Rental bill created successfully.',
            'data' => $this->loadBillDetails($bill),
        ], 201);
    }

    public function show(Request $request, RentalBill $bill): JsonResponse
    {
        $this->authorizeBill($request, $bill);

        return response()->json([
            'success' => true,
            'data' => $this->loadBillDetails($bill),
        ]);
    }

    public function recordPayment(Request $request, RentalBill $bill): JsonResponse
    {
        $this->authorizeBill($request, $bill);
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'decimal:0,2', 'min:0.01', 'max:99999999.99'],
            'payment_date' => ['required', 'date_format:Y-m-d'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $payment = DB::transaction(function () use ($request, $bill, $validated) {
            /** @var RentalBill $lockedBill */
            $lockedBill = $this->ownedBills($request)
                ->whereKey($bill->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedBill->is_voided) {
                throw ValidationException::withMessages([
                    'bill' => ['Payments cannot be recorded against a voided bill.'],
                ]);
            }

            $lockedBill->setRelation(
                'payments',
                $lockedBill->payments()->lockForUpdate()->get()
            );
            $paymentDate = CarbonImmutable::parse(
                $validated['payment_date'],
                config('app.timezone', 'UTC')
            )->startOfDay();
            $calculator = app(RentalBillBalanceCalculator::class);
            $summary = $calculator->calculate($lockedBill, $paymentDate);
            $balance = $summary['_total_outstanding_cents'];
            if ($balance === 0) {
                throw ValidationException::withMessages([
                    'bill' => ['The bill has already been paid in full.'],
                ]);
            }

            $paymentAmount = RentalBill::toCents($validated['amount']);
            if ($paymentAmount > $balance) {
                throw ValidationException::withMessages([
                    'amount' => ['The payment cannot exceed the remaining balance.'],
                ]);
            }

            $latestPaymentDate = $lockedBill->payments
                ->where('status', 'approved')
                ->whereNull('voided_at')
                ->map(fn (RentalPayment $existingPayment): string =>
                    $existingPayment->payment_date->toDateString()
                )
                ->push($paymentDate->toDateString())
                ->max();
            $historySummary = $calculator->calculate(
                $lockedBill,
                CarbonImmutable::parse($latestPaymentDate, config('app.timezone', 'UTC')),
                [
                    'amount' => $validated['amount'],
                    'payment_date' => $validated['payment_date'],
                ]
            );
            if ($historySummary['has_overpayment']) {
                throw ValidationException::withMessages([
                    'amount' => [
                        'The payment would make the dated payment history exceed the bill balance.',
                    ],
                ]);
            }

            return $lockedBill->payments()->create([
                'amount' => $validated['amount'],
                'status' => 'approved',
                'payment_date' => $validated['payment_date'],
                'notes' => $validated['notes'] ?? null,
                'recorded_by' => $request->user()->id,
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Payment recorded successfully.',
            'data' => $this->loadBillDetails($bill->fresh()),
            'payment' => $payment->load(['recordedBy:id,name', 'voidedBy:id,name']),
        ], 201);
    }

    public function voidPayment(Request $request, RentalPayment $payment): JsonResponse
    {
        $this->authorizeOwner($request);
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        $this->authorizeBill($request, $payment->bill);
        $voidedPayment = DB::transaction(function () use (
            $request,
            $payment,
            $validated
        ) {
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

            if ($lockedPayment->voided_at !== null) {
                throw ValidationException::withMessages([
                    'payment' => ['This payment has already been voided.'],
                ]);
            }

            $lockedPayment->forceFill([
                'voided_at' => now(),
                'void_reason' => $validated['reason'],
                'voided_by' => $request->user()->id,
            ])->save();

            return $lockedPayment;
        });

        return response()->json([
            'success' => true,
            'message' => 'Payment voided successfully.',
            'data' => $voidedPayment->load(['recordedBy:id,name', 'voidedBy:id,name']),
            'bill' => $this->loadBillDetails($payment->bill->fresh()),
        ]);
    }

    private function authorizeOwner(Request $request): void
    {
        abort_unless($request->user()?->role === 'owner', 403);
    }

    private function authorizeTenant(Request $request, Tenant $tenant): void
    {
        $this->authorizeOwner($request);
        abort_unless((int) $tenant->owner_id === (int) $request->user()->id, 404);
    }

    private function authorizeBill(Request $request, RentalBill $bill): void
    {
        $this->authorizeOwner($request);
        abort_unless($bill->roomAssignment()->whereHas(
                'tenant',
                fn (Builder $query) => $query->where('owner_id', $request->user()->id)
            )->exists(), 404);
    }

    private function ownedBills(Request $request): Builder
    {
        return RentalBill::query()->whereHas(
            'roomAssignment.tenant',
            fn (Builder $query) => $query->where('owner_id', $request->user()->id)
        );
    }

    private function loadBillDetails(RentalBill $bill): RentalBill
    {
        return $bill->load([
            'roomAssignment.tenant',
            'roomAssignment.boardingHouseRoom.boardingHouse',
            'payments.recordedBy:id,name',
            'payments.reviewedBy:id,name',
            'payments.voidedBy:id,name',
            'voidedBy:id,name',
        ]);
    }
}
