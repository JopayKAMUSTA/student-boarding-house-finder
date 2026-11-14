<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('tenant_id')->constrained('tenants')->restrictOnDelete();
            $table->foreignId('boarding_house_id')
                ->constrained('boarding_houses')
                ->restrictOnDelete();
            $table->timestamps();

            $table->unique(
                ['owner_id', 'tenant_id', 'boarding_house_id'],
                'conversations_owner_tenant_house_unique'
            );
            $table->index(['owner_id', 'updated_at']);
            $table->index(['tenant_id', 'updated_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversations');
    }
};
