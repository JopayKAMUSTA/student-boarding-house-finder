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
        Schema::table('users', function (Blueprint $table) {
            $table->string('first_name', 100)->nullable();
            $table->string('middle_name', 100)->nullable();
            $table->string('last_name', 100)->nullable();

            $table->string('google_id')->nullable()->unique();

            $table->enum('role',['student','owner', 'admin'])-> default('student');

            $table->enum('status', ['pending','active', 'suspended'])->default('pending');

            $table->timestamp('last_login_at')->nullable();

        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            
        $table->dropunique(['google_id']);

        $table->dropcolumn([
            'first_name',
            'middle_name',
            'last_name',
            'google_id',
            'role',
            'status',
            'last_login_at',
        ]);
        });
    }
};
