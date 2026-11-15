
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('owner_profiles', function (Blueprint $table) {
            $table->string('valid_id_front')->nullable();
            $table->string('valid_id_back')->nullable();
            $table->text('rejection_reason')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('owner_profiles', function (Blueprint $table) {
            $table->dropColumn([
                'valid_id_front',
                'valid_id_back',
                'rejection_reason',
            ]);
        });
    }
};
