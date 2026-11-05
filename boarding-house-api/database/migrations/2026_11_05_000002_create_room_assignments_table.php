<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('room_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->restrictOnDelete();
            $table->foreignId('boarding_house_room_id')
                ->constrained('boarding_house_rooms')
                ->restrictOnDelete();
            $table->date('move_in_date');
            $table->date('move_out_date')->nullable();
            $table->decimal('monthly_rent', 10, 2);
            $table->string('status', 20)->default('active');
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->index(['boarding_house_room_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('room_assignments');
    }
};
