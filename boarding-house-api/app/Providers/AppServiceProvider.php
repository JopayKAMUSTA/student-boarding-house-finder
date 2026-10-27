<?php

namespace App\Providers;

use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if (! config('app.auth_timing_diagnostics')) {
            return;
        }

        DB::listen(function (QueryExecuted $query): void {
            $request = request();
            $path = $request->path();

            if (! in_array($path, ['api/login', 'api/logout'], true)) {
                return;
            }

            Log::info('auth.query_timing', [
                'method' => $request->method(),
                'path' => $path,
                'connection' => $query->connectionName,
                'duration_ms' => $query->time,
            ]);
        });
    }
}
