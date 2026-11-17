
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            // Allow conversations that do not belong to an existing tenant.
            $table->foreignId('tenant_id')
                ->nullable()
                ->change();

            // Identify the student who started the conversation.
            $table->foreignId('student_id')
                ->nullable()
                ->after('owner_id')
                ->constrained('users')
                ->nullOnDelete();

            $table->index(
                ['student_id', 'updated_at'],
                'conversations_student_updated_index'
            );

            // Prevent duplicate inquiries from the same student
            // about the same boarding house.
            $table->unique(
                ['student_id', 'boarding_house_id'],
                'conversations_student_house_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->dropUnique('conversations_student_house_unique');
            $table->dropIndex('conversations_student_updated_index');
            $table->dropConstrainedForeignId('student_id');
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->foreignId('tenant_id')
                ->nullable(false)
                ->change();
        });
    }
};
