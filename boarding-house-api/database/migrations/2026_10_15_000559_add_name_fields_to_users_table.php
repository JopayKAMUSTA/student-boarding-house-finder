
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('users', 'first_name')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('first_name', 100)->nullable();
            });
        }

        if (!Schema::hasColumn('users', 'middle_name')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('middle_name', 100)->nullable();
            });
        }

        if (!Schema::hasColumn('users', 'last_name')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('last_name', 100)->nullable();
            });
        }

        if (!Schema::hasColumn('users', 'google_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('google_id')->nullable()->unique();
            });
        }

        if (!Schema::hasColumn('users', 'role')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('role')->default('student');
            });
        }

        if (!Schema::hasColumn('users', 'status')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('status')->default('active');
            });
        }
    }

    public function down(): void
    {
       
    }
};
