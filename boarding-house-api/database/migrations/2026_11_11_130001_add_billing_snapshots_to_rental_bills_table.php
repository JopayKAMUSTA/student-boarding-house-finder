<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rental_bills', function (Blueprint $table) {
            $table->string('billing_policy')->nullable();
            $table->decimal('monthly_rent_snapshot', 10, 2)->nullable();
            $table->unsignedSmallInteger('billable_days')->nullable();
            $table->unsignedSmallInteger('days_in_month')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('rental_bills', function (Blueprint $table) {
            $table->dropColumn([
                'billing_policy',
                'monthly_rent_snapshot',
                'billable_days',
                'days_in_month',
            ]);
        });
    }
};
