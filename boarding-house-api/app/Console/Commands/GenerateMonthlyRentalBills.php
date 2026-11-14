<?php

namespace App\Console\Commands;

use App\Models\RoomAssignment;
use App\Models\RentalBill;
use App\Services\RentalBillingCycle;
use App\Services\RentalBillGenerator;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class GenerateMonthlyRentalBills extends Command
{
    protected $signature = 'rental-bills:generate-monthly {--month= : Anniversary start month to reconcile (YYYY-MM)}';

    protected $description = 'Generate due anniversary-based rental bills.';

    public function handle(
        RentalBillGenerator $generator,
        RentalBillingCycle $cycles
    ): int
    {
        $timezone = config('app.timezone', 'UTC');
        $monthOption = $this->option('month');
        if ($monthOption && ! preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $monthOption)) {
            $this->error('The month option must use YYYY-MM format.');

            return self::FAILURE;
        }
        $month = $monthOption
            ? Carbon::createFromFormat('!Y-m', $monthOption, $timezone)
            : null;

        if ($monthOption && (! $month || $month->format('Y-m') !== $monthOption)) {
            $this->error('The month option must use YYYY-MM format.');

            return self::FAILURE;
        }

        $today = Carbon::now($timezone)->startOfDay();
        $currentMonth = $today->copy()->startOfMonth();
        if ($month && $month->greaterThan($currentMonth)) {
            $this->error('Bills cannot be generated for a future month.');

            return self::FAILURE;
        }

        $assignmentIds = RoomAssignment::query()
            ->whereIn('status', ['active', 'moved_out'])
            ->whereDate('move_in_date', '<=', $today->toDateString())
            ->whereHas(
                'boardingHouseRoom.boardingHouse',
                fn ($query) => $query->where('status', 'approved')
            )
            ->orderBy('id')
            ->get();

        $created = 0;
        $checked = 0;
        foreach ($assignmentIds as $assignment) {
            $lastPeriodEnd = RentalBill::query()
                ->where('room_assignment_id', $assignment->id)
                ->max('rental_period_end');
            $start = $month
                ? $cycles->startForMonth($assignment, $month)
                : $cycles->firstStartAfter($assignment, $lastPeriodEnd);
            if ($month && $start->lessThanOrEqualTo($assignment->move_in_date)) {
                continue;
            }
            if (
                $month &&
                $lastPeriodEnd !== null &&
                $start->lessThanOrEqualTo(Carbon::parse($lastPeriodEnd)->startOfDay())
            ) {
                continue;
            }
            while ($start->lessThanOrEqualTo($today)) {
                if (
                    $assignment->move_out_date &&
                    $assignment->move_out_date->lt($start)
                ) {
                    break;
                }

                $end = $cycles->endForStart($assignment, $start);
                $dueDate = $cycles->nextStart($assignment, $start);
                $checked++;
                $bill = $generator->generate(
                    (int) $assignment->id,
                    $start->toDateString(),
                    $end->toDateString(),
                    $dueDate->toDateString(),
                    skipExisting: true,
                    requireApprovedHouse: true
                );
                $created += $bill !== null ? 1 : 0;
                $start = $dueDate;
            }
        }

        $period = $month ? $month->format('Y-m') : $today->format('Y-m');
        $this->info("Generated {$created} bill(s); {$checked} due cycle(s) checked for {$period}.");

        return self::SUCCESS;
    }
}
