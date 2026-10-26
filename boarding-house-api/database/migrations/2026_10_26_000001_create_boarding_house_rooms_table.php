<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('boarding_house_rooms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('boarding_house_id')
                ->constrained('boarding_houses')
                ->cascadeOnDelete();
            $table->string('room_number', 100);
            $table->string('room_type', 50);
            $table->decimal('monthly_rent', 10, 2);
            $table->string('pricing_basis', 20);
            $table->unsignedInteger('max_occupants');
            $table->string('availability_status', 30)->default('available');
            $table->text('description')->nullable();
            $table->json('amenities')->nullable();
            $table->timestamps();

            $table->unique(['boarding_house_id', 'room_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('boarding_house_rooms');
    }
};
