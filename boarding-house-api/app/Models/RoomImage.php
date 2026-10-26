<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RoomImage extends Model
{
    protected $fillable = [
        'boarding_house_room_id',
        'image_path',
    ];

    public function room(): BelongsTo
    {
        return $this->belongsTo(BoardinghouseRoom::class, 'boarding_house_room_id');
    }

}
