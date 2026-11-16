<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class AdminReportsController extends Controller
{
    public function index(Request $request)
    {
        if (!$request->user() || $request->user()->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Admin access required.',
            ], 403);
        }

        // SUMMARY STATISTICS
        $summary = [
            'total_users' => DB::table('users')->count(),

            'total_students' => DB::table('users')
                ->where('role', 'student')
                ->count(),

            'total_owners' => DB::table('users')
                ->where('role', 'owner')
                ->count(),

            'total_admins' => DB::table('users')
                ->where('role', 'admin')
                ->count(),

            'total_boarding_houses' => DB::table('boarding_houses')->count(),

            'total_rooms' => DB::table('boarding_house_rooms')->count(),

            'total_tenants' => DB::table('tenants')->count(),

            'total_room_assignments' => DB::table('room_assignments')->count(),
        ];

        // USERS BY ROLE
        $usersByRole = DB::table('users')
            ->select('role')
            ->selectRaw('COUNT(*) as total')
            ->groupBy('role')
            ->pluck('total', 'role')
            ->all();

        // BOARDING HOUSES BY STATUS
        $housesByStatus = DB::table('boarding_houses')
            ->select('status')
            ->selectRaw('COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status')
            ->all();

        // ROOMS BY AVAILABILITY
        $roomsByStatus = DB::table('boarding_house_rooms')
            ->select('availability_status')
            ->selectRaw('COUNT(*) as total')
            ->groupBy('availability_status')
            ->pluck('total', 'availability_status')
            ->all();

        // MONTHLY ACTIVITY: LAST SIX MONTHS
        $firstMonth = now()->startOfMonth()->subMonths(5);

        $monthlyTrends = [];

        for ($i = 0; $i < 6; $i++) {
            $monthStart = $firstMonth->copy()->addMonths($i);
            $nextMonth = $monthStart->copy()->addMonth();

            $users = DB::table('users')
                ->where('created_at', '>=', $monthStart)
                ->where('created_at', '<', $nextMonth)
                ->count();

            $boardingHouses = DB::table('boarding_houses')
                ->where('created_at', '>=', $monthStart)
                ->where('created_at', '<', $nextMonth)
                ->count();

            $monthlyTrends[] = [
                'month' => $monthStart->format('Y-m'),
                'label' => $monthStart->format('M Y'),
                'users' => $users,
                'boarding_houses' => $boardingHouses,
            ];
        }

        return response()->json([
            'success' => true,
            'summary' => $summary,
            'users_by_role' => (object) $usersByRole,
            'boarding_houses_by_status' => (object) $housesByStatus,
            'rooms_by_status' => (object) $roomsByStatus,
            'monthly_trends' => $monthlyTrends,
        ]);
    }
}
