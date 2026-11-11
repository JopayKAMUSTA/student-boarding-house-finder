<?php

namespace App\Models;

use App\Services\RentalBillBalanceCalculator;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $room_assignment_id
 * @property \Illuminate\Support\Carbon $due_date
 * @property string $amount
 * @property \Illuminate\Support\Carbon|null $voided_at
 * @property bool $is_voided
 */
class RentalBill extends Model
{
    protected $fillable = [
        'room_assignment_id',
        'amount',
        'billing_policy',
        'monthly_rent_snapshot',
        'billable_days',
        'days_in_month',
        'daily_late_fee_snapshot',
        'grace_period_days_snapshot',
        'rental_period_start',
        'rental_period_end',
        'due_date',
        'voided_at',
        'void_reason',
        'voided_by',
    ];

    protected $appends = [
        'amount_paid',
        'balance',
        'original_amount',
        'total_payments',
        'remaining_balance',
        'overdue_days',
        'accumulated_late_fee',
        'remaining_late_fee',
        'total_outstanding',
        'future_dated_payment_total',
        'payment_status',
        'is_voided',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'monthly_rent_snapshot' => 'decimal:2',
            'billable_days' => 'integer',
            'days_in_month' => 'integer',
            'daily_late_fee_snapshot' => 'decimal:2',
            'grace_period_days_snapshot' => 'integer',
            'rental_period_start' => 'date',
            'rental_period_end' => 'date',
            'due_date' => 'date',
            'voided_at' => 'datetime',
        ];
    }

    public function roomAssignment(): BelongsTo
    {
        return $this->belongsTo(RoomAssignment::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(RentalPayment::class);
    }

    public function voidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by');
    }

    public function getAmountPaidAttribute(): string
    {
        return $this->financialSummary()['total_payments'];
    }

    public function getBalanceAttribute(): string
    {
        return $this->financialSummary()['remaining_balance'];
    }

    public function getOriginalAmountAttribute(): string
    {
        return $this->financialSummary()['original_amount'];
    }

    public function getTotalPaymentsAttribute(): string
    {
        return $this->financialSummary()['total_payments'];
    }

    public function getRemainingBalanceAttribute(): string
    {
        return $this->financialSummary()['remaining_balance'];
    }

    public function getOverdueDaysAttribute(): int
    {
        return $this->financialSummary()['overdue_days'];
    }

    public function getAccumulatedLateFeeAttribute(): string
    {
        return $this->financialSummary()['accumulated_late_fee'];
    }

    public function getRemainingLateFeeAttribute(): string
    {
        return $this->financialSummary()['remaining_late_fee'];
    }

    public function getTotalOutstandingAttribute(): string
    {
        return $this->financialSummary()['total_outstanding'];
    }

    public function getFutureDatedPaymentTotalAttribute(): string
    {
        return $this->financialSummary()['future_dated_payment_total'];
    }

    public function getPaymentStatusAttribute(): string
    {
        $balance = $this->outstandingInCents();
        if ($balance === 0) {
            return 'paid';
        }

        if (
            $this->due_date->toDateString() <
            now(config('app.timezone', 'UTC'))->toDateString()
        ) {
            return 'overdue';
        }

        return $this->financialSummary()['_total_payments_cents'] > 0
            ? 'partially_paid'
            : 'unpaid';
    }

    public function getIsVoidedAttribute(): bool
    {
        return $this->voided_at !== null;
    }

    public function amountPaidInCents(): int
    {
        return $this->financialSummary()['_total_payments_cents'];
    }

    public function balanceInCents(): int
    {
        return $this->financialSummary()['_remaining_balance_cents'];
    }

    public function outstandingInCents(): int
    {
        return $this->financialSummary()['_total_outstanding_cents'];
    }

    public function financialSummary(): array
    {
        return app(RentalBillBalanceCalculator::class)->calculate($this);
    }

    public static function toCents(string|int|float $amount): int
    {
        $decimal = number_format((float) $amount, 2, '.', '');
        [$whole, $fraction] = explode('.', $decimal);

        return ((int) $whole * 100) + (int) $fraction;
    }

}
