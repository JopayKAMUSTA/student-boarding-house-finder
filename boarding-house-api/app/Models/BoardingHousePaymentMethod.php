<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BoardingHousePaymentMethod extends Model
{
    protected $fillable = [
        'boarding_house_id',
        'provider',
        'account_name',
        'account_number',
        'qr_image_path',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function boardingHouse(): BelongsTo
    {
        return $this->belongsTo(Boardinghouse::class);
    }
}
