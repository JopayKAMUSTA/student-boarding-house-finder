
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reports', function (Blueprint $table) {
            $table->id();

            // Person who submitted the report
            $table->foreignId('reporter_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->string('reporter_role');

            // Person or information being reported
            // tenant, user, or boarding_house
            $table->string('target_type');
            $table->unsignedBigInteger('target_id');
            $table->string('target_name')->nullable();

            // Report information
            $table->string('category');
            $table->string('title');
            $table->text('description');

            // Report status
            $table->string('status')->default('submitted');

            // Admin review
            $table->text('admin_notes')->nullable();

            $table->foreignId('reviewed_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('reviewed_at')->nullable();

            $table->timestamps();

            $table->index(['target_type', 'target_id']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reports');
    }
};
