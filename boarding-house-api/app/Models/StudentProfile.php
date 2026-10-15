<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\belongsTo;

class StudentProfile extends Model
{
    protected $fillable = [
        'user_id',
        'student_number',
        'school_name',
        'course',
        'year_level',
        'contact_number',
        'birthdate',
        'gender',
        'current_address',
        'emergency_contact_name',
        'emergency_contact_number',
    ];

    protected function casts():array
    {
        return [
            'birthdate' => 'date',
        ];
    }

    public function user(): BelongsTo 
    {
        return $this->belongsTo(User::class);
    }
}
