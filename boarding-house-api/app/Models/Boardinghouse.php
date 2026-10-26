<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Boardinghouse extends Model
{
    protected $table = 'boarding_houses';

    protected $fillable = [
        'owner_id',
        'name',
        'description',
        'city',
        'barangay',
        'address',
        'monthly_rent',
        'security_deposit',
        'advance_payment',
        'available_rooms',
        'total_rooms',
        'room_type',
        'amenities',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'monthly_rent' => 'decimal:2',
            'security_deposit' => 'decimal:2',
            'advance_payment' => 'decimal:2',
            'amenities' => 'array',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function rooms(): HasMany
    {
        return $this->hasMany(BoardinghouseRoom::class, 'boarding_house_id');
    }
}
