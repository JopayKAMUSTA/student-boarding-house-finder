<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('boarding_houses', function (Blueprint $table) {
            $table->decimal('late_payment_fee', 10, 2)->default(0);
            $table->unsignedInteger('grace_period_days')->default(0);
            $table->text('rules')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('boarding_houses', function (Blueprint $table) {
            $table->dropColumn([
                'late_payment_fee',
                'grace_period_days',
                'rules',
            ]);
        });
    }
};
