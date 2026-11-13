<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class AdminReportsController extends Controller
{
    public function index(Request $request)
    {
        // Only administrators can access reports.
        if (!$request->user() || $request->user()->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Admin access required.'
            ], 403);
        }

        $year = now()->year;

        // USER STATISTICS
        $totalUsers = DB::table('users')->count();

        $totalStudents = DB::table('users')
            ->where('role', 'student')
            ->count();

        $totalOwners = DB::table('users')
            ->where('role', 'owner')
            ->count();

        $totalAdmins = DB::table('users')
            ->where('role', 'admin')
            ->count();

        $activeUsers = DB::table('users')
            ->where('status', 'active')
            ->count();

        // BOARDING HOUSE STATISTICS
        $totalBoardingHouses = DB::table('boarding_houses')->count();

        $pendingBoardingHouses = DB::table('boarding_houses')
            ->where('status', 'pending')
            ->count();

        $approvedBoardingHouses = DB::table('boarding_houses')
            ->where('status', 'approved')
            ->count();

        $rejectedBoardingHouses = DB::table('boarding_houses')
            ->where('status', 'rejected')
            ->count();

        // MONTHLY USER REGISTRATIONS
        $monthlyUsers = DB::table('users')
            ->selectRaw('MONTH(created_at) as month, COUNT(*) as total')
            ->whereYear('created_at', $year)
            ->groupByRaw('MONTH(created_at)')
            ->pluck('total', 'month');

        // MONTHLY BOARDING HOUSE SUBMISSIONS
        $monthlyBoardingHouses = DB::table('boarding_houses')
            ->selectRaw('MONTH(created_at) as month, COUNT(*) as total')
            ->whereYear('created_at', $year)
            ->groupByRaw('MONTH(created_at)')
            ->pluck('total', 'month');

        $monthlyReports = [];

        for ($month = 1; $month <= 12; $month++) {
            $monthlyReports[] = [
                'month' => Carbon::create($year, $month, 1)->format('M'),
                'users' => (int) ($monthlyUsers[$month] ?? 0),
                'boarding_houses' => (int) ($monthlyBoardingHouses[$month] ?? 0),
            ];
        }

        return response()->json([
            'success' => true,
            'data' => [
                'users' => [
                    'total' => $totalUsers,
                    'students' => $totalStudents,
                    'owners' => $totalOwners,
                    'admins' => $totalAdmins,
                    'active' => $activeUsers,
                ],

                'boarding_houses' => [
                    'total' => $totalBoardingHouses,
                    'pending' => $pendingBoardingHouses,
                    'approved' => $approvedBoardingHouses,
                    'rejected' => $rejectedBoardingHouses,
                ],

                'monthly_reports' => $monthlyReports,
                'year' => $year,
            ],
        ]);
    }
}
