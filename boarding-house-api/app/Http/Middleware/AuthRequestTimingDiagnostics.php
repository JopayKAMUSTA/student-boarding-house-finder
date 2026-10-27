<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class AuthRequestTimingDiagnostics
{
    public function handle(Request $request, Closure $next): Response
    {
        $path = $request->path();

        if (! config('app.auth_timing_diagnostics') ||
            ! in_array($path, ['api/login', 'api/logout'], true)) {
            return $next($request);
        }

        $startedAt = hrtime(true);
        $response = null;

        try {
            $response = $next($request);

            return $response;
        } finally {
            Log::info('auth.request_timing', [
                'method' => $request->method(),
                'path' => $path,
                'status' => $response?->getStatusCode(),
                'total_ms' => round((hrtime(true) - $startedAt) / 1_000_000, 2),
            ]);
        }
    }
}
