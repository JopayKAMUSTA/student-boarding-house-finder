<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('owner_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();

            $table->string('contact_number',30)->nullable();
            $table->string('business_name')->nullable();
            $table->string('business_address')->nullable();

            $table->enum('verification_status',[
                'pending',
                'approved',
                'rejected',
            ])->default('pending');

            $table->timestamp('verified-at')->nullable();

            $table->timestamp();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('owner_profiles');
    }
};
