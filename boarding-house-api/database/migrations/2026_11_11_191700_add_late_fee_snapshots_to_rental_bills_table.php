<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rental_bills', function (Blueprint $table) {
            $table->decimal('daily_late_fee_snapshot', 10, 2)->nullable();
            $table->unsignedInteger('grace_period_days_snapshot')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('rental_bills', function (Blueprint $table) {
            $table->dropColumn([
                'daily_late_fee_snapshot',
                'grace_period_days_snapshot',
            ]);
        });
    }
};
