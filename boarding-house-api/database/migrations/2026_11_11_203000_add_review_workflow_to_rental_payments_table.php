<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rental_payments', function (Blueprint $table) {
            $table->string('status', 20)->default('approved');
            $table->decimal('submitted_amount', 10, 2)->nullable();
            $table->date('submitted_payment_date')->nullable();
            $table->string('proof_path')->nullable();
            $table->foreignId('reviewed_by')
                ->nullable()
                ->constrained('users')
                ->restrictOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('rejection_reason', 1000)->nullable();
            $table->string('amount_adjustment_reason', 1000)->nullable();

            $table->index(['rental_bill_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('rental_payments', function (Blueprint $table) {
            $table->dropForeign(['reviewed_by']);
            $table->dropIndex(['rental_bill_id', 'status']);
            $table->dropColumn([
                'status',
                'submitted_amount',
                'submitted_payment_date',
                'proof_path',
                'reviewed_by',
                'reviewed_at',
                'rejection_reason',
                'amount_adjustment_reason',
            ]);
        });
    }
};
