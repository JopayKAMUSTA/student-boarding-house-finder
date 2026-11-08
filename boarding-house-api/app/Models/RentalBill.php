<?php

namespace App\Models;

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
        'payment_status',
        'is_voided',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
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
        return self::formatCents($this->amountPaidInCents());
    }

    public function getBalanceAttribute(): string
    {
        return self::formatCents($this->balanceInCents());
    }

    public function getPaymentStatusAttribute(): string
    {
        $balance = $this->balanceInCents();
        if ($balance === 0) {
            return 'paid';
        }

        if ($this->due_date->toDateString() < today()->toDateString()) {
            return 'overdue';
        }

        return $this->amountPaidInCents() > 0 ? 'partially_paid' : 'unpaid';
    }

    public function getIsVoidedAttribute(): bool
    {
        return $this->voided_at !== null;
    }

    public function amountPaidInCents(): int
    {
        $payments = $this->relationLoaded('payments')
            ? $this->getRelation('payments')
            : $this->payments()->get();

        return $payments
            ->whereNull('voided_at')
            ->sum(fn (RentalPayment $payment): int => self::toCents($payment->amount));
    }

    public function balanceInCents(): int
    {
        return max(0, self::toCents($this->amount) - $this->amountPaidInCents());
    }

    public static function toCents(string|int|float $amount): int
    {
        $decimal = number_format((float) $amount, 2, '.', '');
        [$whole, $fraction] = explode('.', $decimal);

        return ((int) $whole * 100) + (int) $fraction;
    }

    private static function formatCents(int $amount): string
    {
        return number_format($amount / 100, 2, '.', '');
    }
}
