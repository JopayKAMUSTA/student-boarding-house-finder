<?php

namespace App\Services;

use App\Models\RoomAssignment;
use Illuminate\Support\Carbon;

class RentalBillingCycle
{
    public function firstStart(RoomAssignment $assignment): Carbon
    {
        return $this->anniversaryInMonth(
            $assignment->move_in_date,
            $assignment->move_in_date->copy()->startOfMonth()->addMonthNoOverflow()
        );
    }

    public function startForMonth(RoomAssignment $assignment, Carbon $month): Carbon
    {
        return $this->anniversaryInMonth($assignment->move_in_date, $month);
    }

    public function nextStart(RoomAssignment $assignment, Carbon $start): Carbon
    {
        return $this->anniversaryInMonth(
            $assignment->move_in_date,
            $start->copy()->startOfMonth()->addMonthNoOverflow()
        );
    }

    public function firstStartAfter(
        RoomAssignment $assignment,
        ?string $periodEnd
    ): Carbon {
        $start = $this->firstStart($assignment);
        if ($periodEnd === null) {
            return $start;
        }

        $lastPeriodEnd = Carbon::parse($periodEnd)->startOfDay();
        while ($start->lessThanOrEqualTo($lastPeriodEnd)) {
            $start = $this->nextStart($assignment, $start);
        }

        return $start;
    }

    public function endForStart(RoomAssignment $assignment, Carbon $start): Carbon
    {
        return $this->nextStart($assignment, $start)->subDay();
    }

    private function anniversaryInMonth(Carbon $moveInDate, Carbon $month): Carbon
    {
        $anniversary = $month->copy()->startOfMonth();
        $anniversary->day = min($moveInDate->day, $anniversary->daysInMonth);

        return $anniversary->startOfDay();
    }
}
