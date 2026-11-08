<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property int $id
 * @property int $owner_id
 * @property int|null $user_id
 * @property string $full_name
 * @property string $contact_number
 */
class Tenant extends Model
{
    protected $fillable = [
        'owner_id',
        'user_id',
        'full_name',
        'contact_number',
        'emergency_contact_name',
        'emergency_contact_number',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(RoomAssignment::class);
    }

    public function currentAssignment(): HasOne
    {
        return $this->hasOne(RoomAssignment::class)->where('status', 'active');
    }
}
