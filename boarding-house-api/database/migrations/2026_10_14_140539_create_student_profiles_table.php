
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('student_profiles', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->unique()
                ->constrained('users')
                ->cascadeOnDelete();

            $table->string('student_number', 100)->nullable();
            $table->string('school_name')->nullable();
            $table->string('course', 150)->nullable();
            $table->string('year_level', 50)->nullable();
            $table->string('contact_number', 30)->nullable();
            $table->date('birthdate')->nullable();
            $table->string('gender', 30)->nullable();
            $table->text('current_address')->nullable();
            $table->string('emergency_contact_name', 200)->nullable();
            $table->string('emergency_contact_number', 30)->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_profiles');
    }
};
