<?php

namespace App\Http\Controllers;

use App\Models\RentalBill;
use App\Models\RentalPayment;
use App\Models\RoomAssignment;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
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

    public function store(Request $request, Tenant $tenant): JsonResponse
    {
        $this->authorizeTenant($request, $tenant);
        $validated = $request->validate([
            'room_assignment_id' => [
                'required',
                'integer',
                'exists:room_assignments,id',
            ],
            'amount' => ['required', 'numeric', 'decimal:0,2', 'min:0.01', 'max:99999999.99'],
            'rental_period_start' => ['required', 'date_format:Y-m-d'],
            'rental_period_end' => ['required', 'date_format:Y-m-d', 'after_or_equal:rental_period_start'],
            'due_date' => ['required', 'date_format:Y-m-d'],
        ]);

        $periodStart = Carbon::createFromFormat('Y-m-d', $validated['rental_period_start']);
        $periodEnd = Carbon::createFromFormat('Y-m-d', $validated['rental_period_end']);
        if (
            $periodStart->day !== 1 ||
            $periodEnd->day !== $periodEnd->daysInMonth ||
            $periodStart->format('Y-m') !== $periodEnd->format('Y-m')
        ) {
            throw ValidationException::withMessages([
                'rental_period_start' => [
                    'A rental bill must cover one complete calendar month.',
                ],
            ]);
        }

        try {
            /** @var RentalBill $bill */
            $bill = DB::transaction(function () use ($request, $tenant, $validated) {
                $lockedTenant = Tenant::query()
                    ->where('owner_id', $request->user()->id)
                    ->lockForUpdate()
                    ->findOrFail($tenant->id);
                /** @var RoomAssignment $assignment */
                $assignment = $lockedTenant->assignments()
                    ->whereKey($validated['room_assignment_id'])
                    ->lockForUpdate()
                    ->firstOrFail();

                if (
                    $assignment->move_in_date->gt($validated['rental_period_end']) ||
                    ($assignment->move_out_date &&
                        $assignment->move_out_date->lt($validated['rental_period_start']))
                ) {
                    throw ValidationException::withMessages([
                        'room_assignment_id' => [
                            'The rental period does not overlap this room assignment.',
                        ],
                    ]);
                }

                $duplicate = RentalBill::query()
                    ->where('room_assignment_id', $assignment->id)
                    ->whereDate('rental_period_start', $validated['rental_period_start'])
                    ->exists();
                if ($duplicate) {
                    throw ValidationException::withMessages([
                        'rental_period_start' => [
                            'A bill already exists for this assignment and rental month.',
                        ],
                    ]);
                }

                return $assignment->rentalBills()->create([
                    'amount' => $validated['amount'],
                    'rental_period_start' => $validated['rental_period_start'],
                    'rental_period_end' => $validated['rental_period_end'],
                    'due_date' => $validated['due_date'],
                ]);
            });
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages([
                'rental_period_start' => [
                    'A bill already exists for this assignment and rental month.',
                ],
            ]);
        }

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
            $balance = $lockedBill->balanceInCents();
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

            return $lockedBill->payments()->create([
                'amount' => $validated['amount'],
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
            'payments.voidedBy:id,name',
            'voidedBy:id,name',
        ]);
    }
}
