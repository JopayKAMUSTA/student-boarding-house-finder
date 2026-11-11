<?php

namespace App\Services;

use App\Models\RentalBill;
use App\Models\RoomAssignment;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RentalBillGenerator
{
    public function generate(
        int $assignmentId,
        string $periodStart,
        string $periodEnd,
        string $dueDate,
        ?int $tenantId = null,
        bool $skipExisting = false,
        bool $requireApprovedHouse = false
    ): ?RentalBill {
        try {
            return DB::transaction(function () use (
                $assignmentId,
                $periodStart,
                $periodEnd,
                $dueDate,
                $tenantId,
                $skipExisting,
                $requireApprovedHouse
            ): ?RentalBill {
                $query = RoomAssignment::query()->lockForUpdate();
                if ($tenantId !== null) {
                    $query->where('tenant_id', $tenantId);
                }
                $assignment = $query->findOrFail($assignmentId);

                $start = Carbon::createFromFormat('Y-m-d', $periodStart)->startOfDay();
                $end = Carbon::createFromFormat('Y-m-d', $periodEnd)->startOfDay();
                if (
                    $start->day !== 1 ||
                    $end->day !== $end->daysInMonth ||
                    $start->format('Y-m') !== $end->format('Y-m')
                ) {
                    throw ValidationException::withMessages([
                        'rental_period_start' => [
                            'A rental bill must cover one complete calendar month.',
                        ],
                    ]);
                }

                if (
                    $assignment->move_in_date->gt($end) ||
                    ($assignment->move_out_date &&
                        $assignment->move_out_date->lt($start))
                ) {
                    throw ValidationException::withMessages([
                        'room_assignment_id' => [
                            'The rental period does not overlap this room assignment.',
                        ],
                    ]);
                }

                $room = $assignment->boardingHouseRoom()
                    ->lockForUpdate()
                    ->firstOrFail();
                $boardingHouse = $room->boardingHouse()
                    ->lockForUpdate()
                    ->firstOrFail();

                if ($requireApprovedHouse && $boardingHouse->status !== 'approved') {
                    return null;
                }

                if (! in_array($boardingHouse->billing_policy, ['full_monthly', 'prorated'], true)) {
                    throw ValidationException::withMessages([
                        'billing_policy' => [
                            'The boarding house has an unsupported billing policy.',
                        ],
                    ]);
                }

                $existingBill = RentalBill::query()
                    ->where('room_assignment_id', $assignment->id)
                    ->whereDate('rental_period_start', $periodStart)
                    ->exists();
                if ($existingBill) {
                    if ($skipExisting) {
                        return null;
                    }

                    throw ValidationException::withMessages([
                        'rental_period_start' => [
                            'A bill already exists for this assignment and rental month.',
                        ],
                    ]);
                }

                $overlapStart = $assignment->move_in_date->gt($start)
                    ? $assignment->move_in_date
                    : $start;
                $overlapEnd = $assignment->move_out_date &&
                    $assignment->move_out_date->lt($end)
                    ? $assignment->move_out_date
                    : $end;
                $billableDays = (int) $overlapStart->diffInDays($overlapEnd) + 1;
                $daysInMonth = $start->daysInMonth;
                $monthlyRentCents = RentalBill::toCents($assignment->monthly_rent);
                $amountCents = $boardingHouse->billing_policy === 'full_monthly'
                    ? $monthlyRentCents
                    : self::proratedAmountInCents(
                        $monthlyRentCents,
                        $billableDays,
                        $daysInMonth
                    );

                if ($amountCents < 1) {
                    throw ValidationException::withMessages([
                        'room_assignment_id' => [
                            'The calculated rental amount must be at least 0.01.',
                        ],
                    ]);
                }

                return $assignment->rentalBills()->create([
                    'amount' => self::formatCents($amountCents),
                    'billing_policy' => $boardingHouse->billing_policy,
                    'monthly_rent_snapshot' => $assignment->monthly_rent,
                    'billable_days' => $billableDays,
                    'days_in_month' => $daysInMonth,
                    'daily_late_fee_snapshot' => $boardingHouse->late_payment_fee ?? 0,
                    'grace_period_days_snapshot' => $boardingHouse->grace_period_days ?? 0,
                    'rental_period_start' => $periodStart,
                    'rental_period_end' => $periodEnd,
                    'due_date' => $dueDate,
                ]);
            });
        } catch (UniqueConstraintViolationException $exception) {
            if ($skipExisting) {
                return null;
            }

            throw ValidationException::withMessages([
                'rental_period_start' => [
                    'A bill already exists for this assignment and rental month.',
                ],
            ]);
        }
    }

    private static function proratedAmountInCents(
        int $monthlyRentCents,
        int $billableDays,
        int $daysInMonth
    ): int {
        $numerator = $monthlyRentCents * $billableDays;
        $wholeCents = intdiv($numerator, $daysInMonth);
        $remainder = $numerator % $daysInMonth;

        return $wholeCents + ($remainder * 2 >= $daysInMonth ? 1 : 0);
    }

    private static function formatCents(int $amount): string
    {
        return intdiv($amount, 100) . '.' . str_pad(
            (string) ($amount % 100),
            2,
            '0',
            STR_PAD_LEFT
        );
    }
}
