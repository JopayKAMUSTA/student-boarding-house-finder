<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $rental_bill_id
 * @property string $amount
 * @property \Illuminate\Support\Carbon|null $payment_date
 * @property \Illuminate\Support\Carbon|null $voided_at
 */
class RentalPayment extends Model
{
    protected $hidden = [
        'proof_path',
    ];

    protected $appends = [
        'is_future_dated',
        'proof_url',
    ];

    protected $fillable = [
        'rental_bill_id',
        'amount',
        'status',
        'submitted_amount',
        'submitted_payment_date',
        'proof_path',
        'payment_date',
        'notes',
        'recorded_by',
        'reviewed_by',
        'reviewed_at',
        'rejection_reason',
        'amount_adjustment_reason',
        'voided_at',
        'void_reason',
        'voided_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'submitted_amount' => 'decimal:2',
            'submitted_payment_date' => 'date:Y-m-d',
            'payment_date' => 'date:Y-m-d',
            'reviewed_at' => 'datetime',
            'voided_at' => 'datetime',
        ];
    }

    public function bill(): BelongsTo
    {
        return $this->belongsTo(RentalBill::class, 'rental_bill_id');
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function voidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by');
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function getIsFutureDatedAttribute(): bool
    {
        if ($this->status !== 'approved' || !$this->payment_date) {
            return false;
        }

        return $this->payment_date->toDateString() >
            now(config('app.timezone', 'UTC'))->toDateString();
    }

    public function getProofUrlAttribute(): ?string
    {
        return $this->proof_path
            ? url('/api/rental-payments/'.$this->id.'/proof')
            : null;
    }
}
