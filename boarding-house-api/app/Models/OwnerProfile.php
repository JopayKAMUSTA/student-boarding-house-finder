<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OwnerProfile extends Model
{
protected $fillable = [
    'user_id',
    'contact_number',
    'business_name',
    'business_address',
    'verification_status',
    'verified_at',
    'valid_id_front',
    'valid_id_back',
    'rejection_reason',
];

    protected function casts(): array
    {
        return [
            'verified_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
