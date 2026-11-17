<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

class StudentNotificationController extends Controller
{
    private function ensureStudent(Request $request)
    {
        if ($request->user()->role !== 'student') {
            return response()->json([
                'success' => false,
                'message' => 'Only students can access notifications.',
            ], 403);
        }

        return null;
    }

    public function index(Request $request)
    {
        if ($response = $this->ensureStudent($request)) {
            return $response;
        }

        $perPage = min(
            max((int) $request->query('per_page', 20), 1),
            100
        );

        $user = $request->user();

        return response()->json([
            'success' => true,
            'unread_count' => $user->unreadNotifications()->count(),
            'data' => $user->notifications()
                ->latest()
                ->paginate($perPage),
        ]);
    }

    public function markAsRead(Request $request, string $notification)
    {
        if ($response = $this->ensureStudent($request)) {
            return $response;
        }

        $record = $request->user()
            ->notifications()
            ->whereKey($notification)
            ->first();

        if (!$record) {
            return response()->json([
                'success' => false,
                'message' => 'Notification not found.',
            ], 404);
        }

        $record->markAsRead();

        return response()->json([
            'success' => true,
            'message' => 'Notification marked as read.',
        ]);
    }

    public function markAllAsRead(Request $request)
    {
        if ($response = $this->ensureStudent($request)) {
            return $response;
        }

        $request->user()
            ->unreadNotifications()
            ->update([
                'read_at' => now(),
                'updated_at' => now(),
            ]);

        return response()->json([
            'success' => true,
            'message' => 'All notifications marked as read.',
        ]);
    }
}
