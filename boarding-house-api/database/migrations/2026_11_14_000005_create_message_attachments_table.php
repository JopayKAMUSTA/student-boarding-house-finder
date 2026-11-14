<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('message_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained()->cascadeOnDelete();
            $table->text('original_filename');
            $table->string('stored_path')->unique();
            $table->string('mime_type', 127);
            $table->unsignedBigInteger('file_size');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['message_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('message_attachments');
    }
};
