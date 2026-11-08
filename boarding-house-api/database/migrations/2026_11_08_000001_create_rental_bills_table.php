<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rental_bills', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_assignment_id')
                ->constrained('room_assignments')
                ->restrictOnDelete();
            $table->decimal('amount', 10, 2);
            $table->date('rental_period_start');
            $table->date('rental_period_end');
            $table->date('due_date');
            $table->timestamp('voided_at')->nullable();
            $table->string('void_reason', 1000)->nullable();
            $table->foreignId('voided_by')
                ->nullable()
                ->constrained('users')
                ->restrictOnDelete();
            $table->timestamps();

            $table->unique(
                ['room_assignment_id', 'rental_period_start'],
                'rental_bills_assignment_period_unique'
            );
            $table->index('due_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rental_bills');
    }
};
