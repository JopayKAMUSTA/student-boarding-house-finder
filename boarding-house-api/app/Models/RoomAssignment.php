<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $tenant_id
 * @property int $boarding_house_room_id
 * @property \Illuminate\Support\Carbon $move_in_date
 * @property \Illuminate\Support\Carbon|null $move_out_date
 * @property string $status
 */
class RoomAssignment extends Model
{
    protected $fillable = [
        'tenant_id',
        'boarding_house_room_id',
        'move_in_date',
        'move_out_date',
        'monthly_rent',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'move_in_date' => 'date',
            'move_out_date' => 'date',
            'monthly_rent' => 'decimal:2',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function boardingHouseRoom(): BelongsTo
    {
        return $this->belongsTo(BoardinghouseRoom::class, 'boarding_house_room_id');
    }

    public function rentalBills(): HasMany
    {
        return $this->hasMany(RentalBill::class);
    }
}
