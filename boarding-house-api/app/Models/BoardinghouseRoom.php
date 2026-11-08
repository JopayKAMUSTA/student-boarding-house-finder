<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $boarding_house_id
 * @property string $availability_status
 * @property int $max_occupants
 * @property string $monthly_rent
 */
class BoardinghouseRoom extends Model
{
    protected $table = 'boarding_house_rooms';

    protected $fillable = [
        'boarding_house_id',
        'room_number',
        'room_type',
        'monthly_rent',
        'pricing_basis',
        'max_occupants',
        'availability_status',
        'description',
        'amenities',
    ];

    protected function casts(): array
    {
        return [
            'monthly_rent' => 'decimal:2',
            'max_occupants' => 'integer',
            'amenities' => 'array',
        ];
    }

    public function boardingHouse(): BelongsTo
    {
        return $this->belongsTo(Boardinghouse::class, 'boarding_house_id');
    }

    public function images(): HasMany
    {
        return $this->hasMany(RoomImage::class, 'boarding_house_room_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(RoomAssignment::class, 'boarding_house_room_id');
    }
}
