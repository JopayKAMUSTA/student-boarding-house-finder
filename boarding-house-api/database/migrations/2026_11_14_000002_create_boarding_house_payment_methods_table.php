<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('boarding_house_payment_methods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('boarding_house_id')
                ->constrained('boarding_houses')
                ->cascadeOnDelete();
            $table->string('provider', 100);
            $table->string('account_name', 255);
            $table->string('account_number', 100);
            $table->string('qr_image_path');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['boarding_house_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('boarding_house_payment_methods');
    }
};
