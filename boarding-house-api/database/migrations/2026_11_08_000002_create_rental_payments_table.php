<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rental_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rental_bill_id')
                ->constrained('rental_bills')
                ->restrictOnDelete();
            $table->decimal('amount', 10, 2);
            $table->date('payment_date');
            $table->string('notes', 1000)->nullable();
            $table->foreignId('recorded_by')
                ->constrained('users')
                ->restrictOnDelete();
            $table->timestamp('voided_at')->nullable();
            $table->string('void_reason', 1000)->nullable();
            $table->foreignId('voided_by')
                ->nullable()
                ->constrained('users')
                ->restrictOnDelete();
            $table->timestamps();

            $table->index(['rental_bill_id', 'voided_at']);
            $table->index('payment_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rental_payments');
    }
};
