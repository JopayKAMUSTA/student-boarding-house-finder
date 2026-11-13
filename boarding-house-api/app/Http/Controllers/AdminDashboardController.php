<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AdminDashboardController extends Controller
{
    public function index(Request $request)
    {
        // Check administrator access.
        if (
            !$request->user() ||
            $request->user()->role !== 'admin'
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Admin access required.',
            ], 403);
        }

        // USER STATISTICS
        $totalUsers = DB::table('users')->count();

        // BOARDING HOUSE STATISTICS
        $houseTableExists = Schema::hasTable('boarding_houses');

        $totalHouses = 0;
        $approvedListings = 0;
        $pendingApprovals = 0;
        $recentSubmissions = [];

        if ($houseTableExists) {

            $totalHouses = DB::table('boarding_houses')->count();

            if (Schema::hasColumn('boarding_houses', 'status')) {

                $approvedListings = DB::table('boarding_houses')
                    ->where('status', 'approved')
                    ->count();

                $pendingApprovals = DB::table('boarding_houses')
                    ->where('status', 'pending')
                    ->count();
            }

            if (Schema::hasColumn('boarding_houses', 'created_at')) {

                $recentSubmissions = DB::table('boarding_houses')
                    ->select([
                        'id',
                        'name',
                        'city',
                        'address',
                        'monthly_rent',
                        'status',
                        'created_at',
                    ])
                    ->latest('created_at')
                    ->limit(5)
                    ->get();
            }
        }

        return response()->json([
            'success' => true,
            'data' => [
                'stats' => [
                    'total_users' => $totalUsers,
                    'total_boarding_houses' => $totalHouses,
                    'approved_listings' => $approvedListings,
                    'pending_approvals' => $pendingApprovals,
                ],

                'recent_submissions' => $recentSubmissions,
            ],
        ]);
    }
}