<?php

namespace App\Console\Commands;

use App\Models\RoomAssignment;
use App\Services\RentalBillGenerator;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class GenerateMonthlyRentalBills extends Command
{
    protected $signature = 'rental-bills:generate-monthly {--month= : Calendar month to reconcile (YYYY-MM)}';

    protected $description = 'Generate missing rental bills for an eligible calendar month.';

    public function handle(RentalBillGenerator $generator): int
    {
        $timezone = config('app.timezone', 'UTC');
        $monthOption = $this->option('month');
        if ($monthOption && ! preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $monthOption)) {
            $this->error('The month option must use YYYY-MM format.');

            return self::FAILURE;
        }
        $month = $monthOption
            ? Carbon::createFromFormat('!Y-m', $monthOption, $timezone)
            : Carbon::now($timezone)->startOfMonth();

        if (! $month || ($monthOption && $month->format('Y-m') !== $monthOption)) {
            $this->error('The month option must use YYYY-MM format.');

            return self::FAILURE;
        }

        $currentMonth = Carbon::now($timezone)->startOfMonth();
        if ($month->greaterThan($currentMonth)) {
            $this->error('Bills cannot be generated for a future month.');

            return self::FAILURE;
        }

        $periodStart = $month->copy()->startOfMonth();
        $periodEnd = $month->copy()->endOfMonth();
        $assignmentIds = RoomAssignment::query()
            ->whereIn('status', ['active', 'moved_out'])
            ->whereDate('move_in_date', '<=', $periodEnd->toDateString())
            ->where(function ($query) use ($periodStart): void {
                $query->whereNull('move_out_date')
                    ->orWhereDate('move_out_date', '>=', $periodStart->toDateString());
            })
            ->whereHas(
                'boardingHouseRoom.boardingHouse',
                fn ($query) => $query->where('status', 'approved')
            )
            ->orderBy('id')
            ->get(['id', 'move_in_date']);

        $created = 0;
        foreach ($assignmentIds as $assignment) {
            $dueDate = $this->anniversaryDueDate($periodStart, $assignment->move_in_date->day);
            $bill = $generator->generate(
                (int) $assignment->id,
                $periodStart->toDateString(),
                $periodEnd->toDateString(),
                $dueDate->toDateString(),
                skipExisting: true,
                requireApprovedHouse: true
            );
            $created += $bill !== null ? 1 : 0;
        }

        $this->info("Generated {$created} bill(s); {$assignmentIds->count()} eligible assignment(s) checked for {$month->format('Y-m')}.");

        return self::SUCCESS;
    }

    private function anniversaryDueDate(Carbon $billingMonth, int $anchorDay): Carbon
    {
        $dueMonth = $billingMonth->copy()->addMonthNoOverflow()->startOfMonth();
        $dueMonth->day = min($anchorDay, $dueMonth->daysInMonth);

        return $dueMonth;
    }
}
