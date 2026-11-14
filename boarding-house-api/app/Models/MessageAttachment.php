<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MessageAttachment extends Model
{
    public $timestamps = false;

    protected $hidden = [
        'stored_path',
    ];

    protected $fillable = [
        'message_id',
        'original_filename',
        'stored_path',
        'mime_type',
        'file_size',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'file_size' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }
}
