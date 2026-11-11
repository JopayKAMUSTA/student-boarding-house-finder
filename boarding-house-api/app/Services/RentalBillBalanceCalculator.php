<?php

namespace App\Services;

use App\Models\RentalBill;
use App\Models\RentalPayment;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;

class RentalBillBalanceCalculator
{
    /**
     * @param  array{amount: string|int|float, payment_date: string}|null  $additionalPayment
     * @return array{
     *     original_amount: string,
     *     total_payments: string,
     *     remaining_balance: string,
     *     overdue_days: int,
     *     accumulated_late_fee: string,
     *     remaining_late_fee: string,
     *     total_outstanding: string,
     *     future_dated_payment_total: string,
     *     has_overpayment: bool,
     *     _total_payments_cents: int,
     *     _remaining_balance_cents: int,
     *     _total_outstanding_cents: int
     * }
     */
    public function calculate(
        RentalBill $bill,
        ?CarbonImmutable $asOf = null,
        ?array $additionalPayment = null
    ): array {
        $timezone = config('app.timezone', 'UTC');
        $asOf ??= CarbonImmutable::now($timezone)->startOfDay();
        $asOfDate = $asOf->setTimezone($timezone)->toDateString();
        $dueDate = CarbonImmutable::parse($bill->due_date->toDateString(), $timezone);
        $feeStartDate = $dueDate->addDays((int) ($bill->grace_period_days_snapshot ?? 0) + 1);
        $principalRemaining = RentalBill::toCents($bill->amount);
        $lateFeeRemaining = 0;
        $dailyFeeCents = RentalBill::toCents($bill->daily_late_fee_snapshot ?? 0);
        $accumulatedLateFee = 0;
        $overdueDays = 0;
        $hasOverpayment = false;
        $paymentGroups = [];
        $totalPayments = 0;
        $futurePaymentTotal = 0;

        $payments = $bill->relationLoaded('payments')
            ? $bill->getRelation('payments')
            : $bill->payments()->get();

        foreach ($payments as $payment) {
            if ($payment->voided_at !== null || $payment->status !== 'approved') {
                continue;
            }

            $paymentDate = $this->paymentDate($payment, $timezone);
            $amountCents = RentalBill::toCents($payment->amount);
            if ($paymentDate > $asOfDate) {
                $futurePaymentTotal += $amountCents;
            } else {
                $totalPayments += $amountCents;
                $paymentGroups[$paymentDate] = ($paymentGroups[$paymentDate] ?? 0) + $amountCents;
            }
        }

        if ($additionalPayment !== null) {
            $paymentDate = Carbon::parse($additionalPayment['payment_date'], $timezone)
                ->toDateString();
            $amountCents = RentalBill::toCents($additionalPayment['amount']);
            if ($paymentDate > $asOfDate) {
                $futurePaymentTotal += $amountCents;
            } else {
                $totalPayments += $amountCents;
                $paymentGroups[$paymentDate] = ($paymentGroups[$paymentDate] ?? 0) + $amountCents;
            }
        }

        ksort($paymentGroups);

        foreach ($paymentGroups as $paymentDate => $amountCents) {
            if ($paymentDate >= $feeStartDate->toDateString()) {
                continue;
            }

            $this->applyPayment(
                $amountCents,
                $principalRemaining,
                $lateFeeRemaining,
                $hasOverpayment
            );
        }

        $cursor = $feeStartDate;
        foreach ($paymentGroups as $paymentDate => $amountCents) {
            if ($paymentDate < $feeStartDate->toDateString()) {
                continue;
            }

            $eventDate = CarbonImmutable::parse($paymentDate, $timezone);
            if ($eventDate->greaterThan($asOf)) {
                continue;
            }

            if (($principalRemaining + $lateFeeRemaining) > 0 && $cursor->lessThanOrEqualTo($eventDate)) {
                $chargeableDays = (int) $cursor->diffInDays($eventDate) + 1;
                $overdueDays += $chargeableDays;
                $newLateFee = $dailyFeeCents * $chargeableDays;
                $lateFeeRemaining += $newLateFee;
                $accumulatedLateFee += $newLateFee;
            }

            $this->applyPayment(
                $amountCents,
                $principalRemaining,
                $lateFeeRemaining,
                $hasOverpayment
            );
            $cursor = $eventDate->addDay();
        }

        if (
            ($principalRemaining + $lateFeeRemaining) > 0 &&
            $cursor->lessThanOrEqualTo($asOf)
        ) {
            $chargeableDays = (int) $cursor->diffInDays($asOf) + 1;
            $overdueDays += $chargeableDays;
            $newLateFee = $dailyFeeCents * $chargeableDays;
            $lateFeeRemaining += $newLateFee;
            $accumulatedLateFee += $newLateFee;
        }

        $totalOutstanding = $principalRemaining + $lateFeeRemaining;

        return [
            'original_amount' => self::formatCents(RentalBill::toCents($bill->amount)),
            'total_payments' => self::formatCents($totalPayments),
            'remaining_balance' => self::formatCents($principalRemaining),
            'overdue_days' => $overdueDays,
            'accumulated_late_fee' => self::formatCents($accumulatedLateFee),
            'remaining_late_fee' => self::formatCents($lateFeeRemaining),
            'total_outstanding' => self::formatCents($totalOutstanding),
            'future_dated_payment_total' => self::formatCents($futurePaymentTotal),
            'has_overpayment' => $hasOverpayment,
            '_total_payments_cents' => $totalPayments,
            '_remaining_balance_cents' => $principalRemaining,
            '_total_outstanding_cents' => $totalOutstanding,
        ];
    }

    private function paymentDate(RentalPayment $payment, string $timezone): string
    {
        return Carbon::parse($payment->payment_date->toDateString(), $timezone)->toDateString();
    }

    private function applyPayment(
        int $amountCents,
        int &$principalRemaining,
        int &$lateFeeRemaining,
        bool &$hasOverpayment
    ): void {
        $outstanding = $principalRemaining + $lateFeeRemaining;
        if ($amountCents > $outstanding) {
            $hasOverpayment = true;
        }

        $amountCents = min($amountCents, $outstanding);
        $principalPayment = min($amountCents, $principalRemaining);
        $principalRemaining -= $principalPayment;
        $lateFeeRemaining -= min($amountCents - $principalPayment, $lateFeeRemaining);
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
