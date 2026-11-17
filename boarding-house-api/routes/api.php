<?php

    use App\Models\User;
    use Illuminate\Http\Request;
    use Illuminate\Support\Facades\Route;
    use Illuminate\Support\Facades\Hash;
    use Illuminate\Support\Facades\Validator;
    use Illuminate\Support\Facades\DB;
    use Illuminate\Support\Facades\Log;
    use App\Models\StudentProfile;
    use App\Models\Boardinghouse;
    use App\Models\OwnerProfile;

    use App\Http\Controllers\AdminAuthController;
    use App\Http\Controllers\AdminBoardinghouseController;
    use App\Http\Controllers\AdminOwnerController;
    use App\Http\Controllers\AdminReportsController;
    use App\Http\Controllers\AdminReportedInformationController;
    use App\Http\Controllers\OwnerBoardingHouseRoomController;
    use App\Http\Controllers\OwnerBoardingHousePaymentMethodController;
    use App\Http\Controllers\OwnerConversationController;
    use App\Http\Controllers\OwnerRentalBillController;
    use App\Http\Controllers\OwnerRentalPaymentReviewController;
    use App\Http\Controllers\StudentRentalPaymentController;
    use App\Http\Controllers\StudentRentalBillController;
    use App\Http\Controllers\StudentBoardingHousePaymentMethodController;
    use App\Http\Controllers\StudentConversationController;
    use App\Http\Controllers\OwnerTenantController;
    use App\Http\Controllers\AdminDashboardController;
    use App\Http\Controllers\OwnerProfileController;
    use Illuminate\Support\Facades\Mail;
    use App\Http\Controllers\ReportController;

    /*
    |--------------------------------------------------------------------------
    | TEST ROUTE
    |--------------------------------------------------------------------------
    */

    Route::get('/test', function () {
        return response()->json([
            'success' => true,
            'message' => 'Student Boarding House Finder API is working!',
        ]);
    });

    /*
    |--------------------------------------------------------------------------
    | STUDENT LOGIN
    |--------------------------------------------------------------------------
    */

    Route::post('/login', function (Request $request) {

        $diagnosticsEnabled = (bool) config('app.auth_timing_diagnostics');
        $startedAt = hrtime(true);
        $timings = [];

        $recordTiming = function (string $outcome) use (
            $diagnosticsEnabled,
            $startedAt,
            &$timings
        ): void {
            if (!$diagnosticsEnabled) {
                return;
            }

            Log::info('auth.login_stage_timing', [
                'outcome' => $outcome,
                'total_ms' => round((hrtime(true) - $startedAt) / 1_000_000, 2),
                'stages_ms' => $timings,
            ]);
        };

        $stageStartedAt = hrtime(true);

        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $timings['validation_ms'] = round(
            (hrtime(true) - $stageStartedAt) / 1_000_000,
            2
        );

        if ($validator->fails()) {
            $recordTiming('validation_failed');

            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $stageStartedAt = hrtime(true);

        $user = User::where('email', $request->email)->first();

        $timings['user_lookup_ms'] = round(
            (hrtime(true) - $stageStartedAt) / 1_000_000,
            2
        );

        $stageStartedAt = hrtime(true);

        $credentialsValid = $user && Hash::check(
            $request->password,
            $user->password
        );

        $timings['credential_check_ms'] = round(
            (hrtime(true) - $stageStartedAt) / 1_000_000,
            2
        );

        if (!$credentialsValid) {
            $recordTiming('invalid_credentials');

            return response()->json([
                'success' => false,
                'message' => 'Invalid email or password.',
            ], 401);
        }

        if ($user->status !== 'active') {
            $recordTiming('inactive_account');

            return response()->json([
                'success' => false,
                'message' => 'Your account is not active.',
            ], 403);
        }

        $stageStartedAt = hrtime(true);

        $token = $user->createToken(
            'student-boarding-house-app'
        )->plainTextToken;

        $timings['token_creation_ms'] = round(
            (hrtime(true) - $stageStartedAt) / 1_000_000,
            2
        );

        $recordTiming('success');

        return response()->json([
            'success' => true,
            'message' => 'Login successful.',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'first_name' => $user->first_name,
                'middle_name' => $user->middle_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'role' => $user->role,
                'status' => $user->status,
                'token' => $token,
            ],
        ]);
    });

    /*
    |--------------------------------------------------------------------------
    | ADMIN LOGIN
    |--------------------------------------------------------------------------
    */

    Route::post('/admin/login', [
        AdminAuthController::class,
        'login',
    ]);

    /*
    |--------------------------------------------------------------------------
    | ADMIN ROUTES
    |--------------------------------------------------------------------------
    */

    Route::middleware('auth:sanctum')->prefix('admin')->group(function () {

        // ADMIN DASHBOARD
        Route::get('/dashboard', [
            AdminDashboardController::class,
            'index',
        ]);
               // REPORTED INFORMATION MANAGEMENT
        Route::get('/reported-information', [
            AdminReportedInformationController::class,
            'index',
        ]);

        Route::get('/reported-information/{report}', [
            AdminReportedInformationController::class,
            'show',
        ]);

        Route::patch('/reported-information/{report}', [
            AdminReportedInformationController::class,
            'update',
        ]);

 // ADMIN OWNER MANAGEMENT
    // ADMIN OWNER MANAGEMENT
    Route::get('/owners', [
        AdminOwnerController::class,
        'index',
    ]);

    Route::get('/owners/{owner}', [
        AdminOwnerController::class,
        'show',
    ]);

    Route::get('/owners/{owner}/identity-documents/{side}', [
        AdminOwnerController::class,
        'viewIdentityDocument',
    ]);

        Route::patch('/owners/{owner}/verification', [
        AdminOwnerController::class,
        'updateVerification',
    ]);

    // ADMIN BOARDING HOUSES
    Route::get('/boarding-houses', [
        AdminBoardinghouseController::class,
        'index',
    ]);

    Route::get('/boarding-houses/{boardingHouse}', [
        AdminBoardinghouseController::class,
        'show',
    ]);

        Route::patch('/boarding-houses/{boardingHouse}/status', [
            AdminBoardinghouseController::class,
            'updateStatus',
        ]);

        Route::get(
            '/boarding-houses/{boardingHouse}/rooms/{room}/images/{image}',
            [
                AdminBoardinghouseController::class,
                'showImage',
            ]
        )->name('admin.boarding-houses.rooms.images.show');

        // ADMIN REPORTS
        Route::get('/reports', [
            AdminReportsController::class,
            'index',
        ]);

    });
    /*
    |--------------------------------------------------------------------------
    | ADMIN USER MANAGEMENT
    |--------------------------------------------------------------------------
    */

    Route::middleware('auth:sanctum')->get('/users', function (Request $request) {

        if ($request->user()->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Admin access required.',
            ], 403);
        }

        $users = User::query()
            ->select([
                'id',
                'name',
                'first_name',
                'middle_name',
                'last_name',
                'email',
                'role',
                'status',
                'created_at',
            ])
            ->when($request->filled('search'), function ($query) use ($request) {
                $search = $request->search;

                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->when($request->filled('role'), function ($query) use ($request) {
                $query->where('role', $request->role);
            })
            ->when($request->filled('status'), function ($query) use ($request) {
                $query->where('status', $request->status);
            })
            ->latest()
            ->paginate(10);

        return response()->json([
            'success' => true,
            'data' => $users,
        ]);
    });

    /*
    |--------------------------------------------------------------------------
    | STUDENT REGISTRATION
    |--------------------------------------------------------------------------
    */

    Route::post('/register', function (Request $request) {

        $validator = Validator::make($request->all(), [
            'first_name' => 'required|string|max:100',
            'middle_name' => 'nullable|string|max:100',
            'last_name' => 'required|string|max:100',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => 'required|string|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = User::create([
            'name' => trim(
                $request->first_name . ' ' .
                ($request->middle_name
                    ? $request->middle_name . ' '
                    : '') .
                $request->last_name
            ),
            'first_name' => $request->first_name,
            'middle_name' => $request->middle_name,
            'last_name' => $request->last_name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'role' => 'student',
            'status' => 'active',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Student registered successfully.',
            'data' => $user,
        ], 201);
    });

    /*
    |--------------------------------------------------------------------------
    | OWNER REGISTRATION
    |--------------------------------------------------------------------------
    */

Route::post('/owner/register/send-verification-code', function (Request $request) {
    $request->merge([
        'email' => strtolower(trim($request->email ?? '')),
    ]);

    $validator = Validator::make($request->all(), [
        'email' => 'required|string|email:rfc|max:255|unique:users,email',
    ]);

    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'errors' => $validator->errors(),
        ], 422);
    }

    $code = (string) random_int(100000, 999999);

    DB::table('owner_registration_email_verifications')->updateOrInsert(
        ['email' => $request->email],
        [
            'code_hash' => Hash::make($code),
            'expires_at' => now()->addMinutes(10),
            'verified_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]
    );

    Mail::raw("Your TagStay email verification code is: {$code}\n\nThis code expires in 10 minutes. Do not share it with anyone.", function ($message) use ($request) {
        $message->to($request->email)
            ->subject('TagStay Email Verification');
    });

    return response()->json([
        'success' => true,
        'message' => 'Verification code sent to your email.',
    ]);
})->middleware('throttle:3,10');


Route::post('/owner/register/verify-email', function (Request $request) {
    $request->merge([
        'email' => strtolower(trim($request->email ?? '')),
    ]);

    $validator = Validator::make($request->all(), [
        'email' => 'required|email:rfc',
        'code' => 'required|digits:6',
    ]);

    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'errors' => $validator->errors(),
        ], 422);
    }

    $verification = DB::table('owner_registration_email_verifications')
        ->where('email', $request->email)
        ->first();

    if (!$verification || !$verification->code_hash) {
        return response()->json([
            'success' => false,
            'message' => 'Please request a verification code first.',
        ], 422);
    }

    if (now()->greaterThan($verification->expires_at)) {
        return response()->json([
            'success' => false,
            'message' => 'Your verification code has expired. Please request a new one.',
        ], 422);
    }

    if (!Hash::check($request->code, $verification->code_hash)) {
        return response()->json([
            'success' => false,
            'message' => 'Invalid verification code.',
        ], 422);
    }

    DB::table('owner_registration_email_verifications')
        ->where('email', $request->email)
        ->update([
            'verified_at' => now(),
            'updated_at' => now(),
        ]);

    return response()->json([
        'success' => true,
        'message' => 'Email verified successfully.',
    ]);
})->middleware('throttle:10,1');


    Route::post('/owner/register', function (Request $request) {
        $request->merge([
    'email' => strtolower(trim($request->email ?? '')),
]);
        $validator = Validator::make($request->all(), [
            'first_name' => 'required|string|max:100',
            'middle_name' => 'nullable|string|max:100',
            'last_name' => 'required|string|max:100',
'email' => [
    'required',
    'string',
    'email:rfc',
    'max:255',
    'unique:users,email',
],   
'password' => [
    'required',
    'string',
    'min:8',
    'regex:/[A-Z]/',
    'regex:/[a-z]/',
    'regex:/[0-9]/',
    'regex:/[^A-Za-z0-9]/',
    'confirmed',
],
'contact_number' => [
    'required',
    'string',
    'regex:/^09[0-9]{9}$/',
],

'business_name' => 'nullable|string|max:255',
            'business_address' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $emailVerified = DB::table('owner_registration_email_verifications')
    ->where('email', $request->email)
    ->whereNotNull('verified_at')
    ->where('expires_at', '>', now())
    ->exists();

if (!$emailVerified) {
    return response()->json([
        'success' => false,
        'message' => 'Please verify your email address before registering.',
    ], 422);
}

        $user = DB::transaction(function () use ($request) {

            $user = User::create([
                'name' => trim(
                    $request->first_name . ' ' .
                    ($request->middle_name
                        ? $request->middle_name . ' '
                        : '') .
                    $request->last_name
                ),
                'first_name' => $request->first_name,
                'middle_name' => $request->middle_name,
                'last_name' => $request->last_name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'role' => 'owner',
                'status' => 'active',
            ]);

            $user->ownerProfile()->create([
                'contact_number' => $request->contact_number,
                'business_name' => $request->business_name,
                'business_address' => $request->business_address,
                'verification_status' => 'pending',
            ]);
            DB::table('owner_registration_email_verifications')
    ->where('email', $request->email)
    ->delete();

            return $user;
        });

        return response()->json([
            'success' => true,
            'message' => 'Owner registered successfully. You can log in and submit your boarding house for review.',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'status' => $user->status,
                'verification_status' => $user->ownerProfile->verification_status,
            ],
        ], 201);
    });

    /*
    |--------------------------------------------------------------------------
    | USER PROFILE
    |--------------------------------------------------------------------------
    */

    Route::middleware('auth:sanctum')->get('/profile', function (Request $request) {

        $user = $request->user();

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'first_name' => $user->first_name,
                'middle_name' => $user->middle_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'role' => $user->role,
                'status' => $user->status,
            ],
        ]);
    });

    /*
    |--------------------------------------------------------------------------
    | LOGOUT
    |--------------------------------------------------------------------------
    */

    Route::middleware('auth:sanctum')->post('/logout', function (Request $request) {

        $startedAt = hrtime(true);
        $stageStartedAt = hrtime(true);

        $request->user()->currentAccessToken()->delete();

        if (config('app.auth_timing_diagnostics')) {
            Log::info('auth.logout_stage_timing', [
                'token_delete_ms' => round(
                    (hrtime(true) - $stageStartedAt) / 1_000_000,
                    2
                ),
                'route_ms' => round(
                    (hrtime(true) - $startedAt) / 1_000_000,
                    2
                ),
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Logout successful',
        ]);
    });

    /*
    |--------------------------------------------------------------------------
    | STUDENT PROFILE AND RENTAL PAYMENT ROUTES
    |--------------------------------------------------------------------------
    */

    Route::middleware('auth:sanctum')->group(function () {

        Route::get('/student/notifications', [
            \App\Http\Controllers\StudentNotificationController::class,
            'index',
        ]);

        Route::patch('/student/notifications/{notification}/read', [
            \App\Http\Controllers\StudentNotificationController::class,
            'markAsRead',
        ]);

        Route::patch('/student/notifications/read-all', [
            \App\Http\Controllers\StudentNotificationController::class,
            'markAllAsRead',
        ]);
        Route::get('/student/conversations/unread-count', [
            StudentConversationController::class,
            'unreadCount',
        ]);

            Route::post('/student/reported-information', [
            ReportController::class,
                'store',
            ]);

        Route::get('/student/conversations', [
            StudentConversationController::class,
            'index',
        ]);

        Route::post('/student/conversations', [
            StudentConversationController::class,
            'store',
        ]);

        Route::get('/student/conversations/{conversation}', [
            StudentConversationController::class,
            'show',
        ]);

        Route::get('/student/conversations/{conversation}/messages', [
            StudentConversationController::class,
            'messages',
        ]);

        Route::post('/student/conversations/{conversation}/messages', [
            StudentConversationController::class,
            'send',
        ]);

        Route::post('/student/conversations/{conversation}/read', [
            StudentConversationController::class,
            'markRead',
        ]);

        Route::get(
            '/student/conversations/{conversation}/attachments/{attachment}',
            [StudentConversationController::class, 'attachment']
        )->name('student.conversations.attachments.show');

        Route::get('/student/rental-bills', [
            StudentRentalBillController::class,
            'index',
        ]);

        Route::post('/student/rental-bills/{bill}/payment-submissions', [
            StudentRentalPaymentController::class,
            'submit',
        ]);

        Route::get('/student/rental-bills/{bill}/payment-methods', [
            StudentBoardingHousePaymentMethodController::class,
            'index',
        ]);

        Route::get('/student/rental-bills/{bill}/payment-methods/{paymentMethod}/qr', [
            StudentBoardingHousePaymentMethodController::class,
            'showQr',
        ])->name('student.rental-bills.payment-methods.qr');

        Route::get('/rental-payments/{payment}/proof', [
            OwnerRentalPaymentReviewController::class,
            'proof',
        ]);

        Route::get('/student-profile', function (Request $request) {

            $user = $request->user();

            if ($user->role !== 'student') {
                return response()->json([
                    'success' => false,
                    'message' => 'Only students can access this profile.',
                ], 403);
            }

            $profile = StudentProfile::where(
                'user_id',
                $user->id
            )->first();

            return response()->json([
                'success' => true,
                'data' => $profile,
            ]);
        });

        Route::put('/student-profile', function (Request $request) {

            $user = $request->user();

            if ($user->role !== 'student') {
                return response()->json([
                    'success' => false,
                    'message' => 'Only students can update this profile.',
                ], 403);
            }

            $validated = $request->validate([
                'student_number' => 'nullable|string|max:50',
                'school_name' => 'nullable|string|max:255',
                'course' => 'nullable|string|max:255',
                'year_level' => 'nullable|string|max:50',
                'contact_number' => 'nullable|string|max:30',
                'birthdate' => 'nullable|date|before_or_equal:today',
                'gender' => 'nullable|string|max:30',
                'current_address' => 'nullable|string|max:500',
                'emergency_contact_name' => 'nullable|string|max:255',
                'emergency_contact_number' => 'nullable|string|max:30',
            ]);

            $profile = StudentProfile::updateOrCreate(
                ['user_id' => $user->id],
                $validated
            );

            return response()->json([
                'success' => true,
                'message' => 'Student profile saved successfully.',
                'data' => $profile,
            ]);
        });
    });


    
/*
|--------------------------------------------------------------------------
| PUBLIC BOARDING HOUSE LISTINGS
|--------------------------------------------------------------------------
*/

Route::get('/boarding-houses', function (Request $request) {

    $request->validate([
        'city' => ['nullable', 'string', 'max:100'],
        'room_type' => ['nullable', 'string', 'max:100'],
        'max_rent' => ['nullable', 'numeric', 'min:0'],
    ]);

    $boardingHouses = Boardinghouse::query()
        ->where('status', 'approved')
        ->with([
            'rooms.images',
        ])
        ->when($request->filled('city'), function ($query) use ($request) {
            $query->where(
                'city',
                'like',
                '%' . $request->city . '%'
            );
        })
        ->when($request->filled('room_type'), function ($query) use ($request) {
            $query->where('room_type', $request->room_type);
        })
        ->when($request->filled('max_rent'), function ($query) use ($request) {
            $query->where('monthly_rent', '<=', $request->max_rent);
        })
        ->orderBy('monthly_rent')
        ->paginate(10);

    $boardingHouses->getCollection()->transform(function ($house) {

        $allImages = $house->rooms
            ->flatMap(function ($room) {

                return $room->images->map(function ($image) {

                    return [
                        'id' => $image->id,
                        'boarding_house_room_id' => $image->boarding_house_room_id,
                        'image_path' => $image->image_path,
                        'url' => \Illuminate\Support\Facades\Storage::disk('public')
                            ->url($image->image_path),
                    ];

                });

            })
            ->values();

        $house->setAttribute('images', $allImages);

        $house->setAttribute(
            'cover_image_url',
            $allImages->first()['url'] ?? null
        );

        return $house;
    });

    return response()->json([
        'success' => true,
        'data' => $boardingHouses,
    ]);

});


Route::get('/boarding-houses/{id}', function ($id) {

    $boardingHouse = Boardinghouse::query()
        ->where('status', 'approved')
        ->with([
            'rooms.images',
        ])
        ->find($id);

    if (!$boardingHouse) {

        return response()->json([
            'success' => false,
            'message' => 'Boarding house not found.',
        ], 404);

    }

    $allImages = $boardingHouse->rooms
        ->flatMap(function ($room) {

            return $room->images->map(function ($image) {

                return [
                    'id' => $image->id,
                    'boarding_house_room_id' => $image->boarding_house_room_id,
                    'image_path' => $image->image_path,
                    'url' => \Illuminate\Support\Facades\Storage::disk('public')
                        ->url($image->image_path),
                ];

            });

        })
        ->values();

    $boardingHouse->setAttribute('images', $allImages);

    $boardingHouse->setAttribute(
        'cover_image_url',
        $allImages->first()['url'] ?? null
    );

    return response()->json([
        'success' => true,
        'data' => $boardingHouse,
    ]);

});


    /*
    |--------------------------------------------------------------------------
    | OWNER ROUTES
    |--------------------------------------------------------------------------
    */

    

    Route::middleware('auth:sanctum')
        ->prefix('owner')
        ->group(function () {

        // Owner Profile
    Route::get('/profile', [
        OwnerProfileController::class,
        'show',
    ]);

    Route::post('/profile/identity-documents', [
    OwnerProfileController::class,
    'submitIdentityDocuments',
]);


    Route::put('/profile/password', [
    OwnerProfileController::class,
    'changePassword',
]);

    Route::put('/profile', [
        OwnerProfileController::class,
        'update',
    ]);
Route::post('/reported-information', [
    ReportController::class,
    'store',
]);
            // Owner-tenant messaging
            Route::get('/conversations/recipients', [
                OwnerConversationController::class,
                'recipients',
            ]);

            Route::get('/conversations/unread-count', [
                OwnerConversationController::class,
                'unreadCount',
            ]);

            Route::get('/conversations', [
                OwnerConversationController::class,
                'index',
            ]);

            Route::post('/conversations', [
                OwnerConversationController::class,
                'store',
            ]);

            Route::get('/conversations/{conversation}', [
                OwnerConversationController::class,
                'show',
            ]);

            Route::get('/conversations/{conversation}/messages', [
                OwnerConversationController::class,
                'messages',
            ]);

            Route::post('/conversations/{conversation}/messages', [
                OwnerConversationController::class,
                'send',
            ]);

            Route::post('/conversations/{conversation}/read', [
                OwnerConversationController::class,
                'markRead',
            ]);

            Route::get(
                '/conversations/{conversation}/attachments/{attachment}',
                [OwnerConversationController::class, 'attachment']
            )->name('owner.conversations.attachments.show');

            // Tenant management
            Route::get('/tenants', [
                OwnerTenantController::class,
                'index',
            ]);

            Route::post('/tenants', [
                OwnerTenantController::class,
                'store',
            ]);

            Route::get('/tenants/{tenant}', [
                OwnerTenantController::class,
                'show',
            ]);

            Route::put('/tenants/{tenant}', [
                OwnerTenantController::class,
                'update',
            ]);

            Route::post('/tenants/{tenant}/assignments', [
                OwnerTenantController::class,
                'assign',
            ]);

            Route::post('/tenants/{tenant}/transfer', [
                OwnerTenantController::class,
                'transfer',
            ]);

            Route::patch('/tenants/{tenant}/move-out', [
                OwnerTenantController::class,
                'moveOut',
            ]);

            // Rental bills
            Route::get('/rental-bills', [
                OwnerRentalBillController::class,
                'index',
            ]);

            Route::post('/tenants/{tenant}/rental-bills', [
                OwnerRentalBillController::class,
                'store',
            ]);

            Route::get('/rental-bills/generation-status', [
                OwnerRentalBillController::class,
                'generationStatus',
            ]);

            Route::get('/rental-bills/{bill}', [
                OwnerRentalBillController::class,
                'show',
            ]);

            Route::post('/rental-bills/{bill}/payments', [
                OwnerRentalBillController::class,
                'recordPayment',
            ]);

            // Rental payment review
            Route::get('/rental-payment-submissions', [
                OwnerRentalPaymentReviewController::class,
                'index',
            ]);

            Route::patch('/rental-payments/{payment}/approve', [
                OwnerRentalPaymentReviewController::class,
                'approve',
            ]);

            Route::patch('/rental-payments/{payment}/reject', [
                OwnerRentalPaymentReviewController::class,
                'reject',
            ]);

            Route::patch('/rental-payments/{payment}/void', [
                OwnerRentalBillController::class,
                'voidPayment',
            ]);

            Route::get('/boarding-houses/{boardingHouse}/payment-methods', [
                OwnerBoardingHousePaymentMethodController::class,
                'index',
            ]);

            Route::post('/boarding-houses/{boardingHouse}/payment-methods', [
                OwnerBoardingHousePaymentMethodController::class,
                'store',
            ]);

            Route::put('/boarding-houses/{boardingHouse}/payment-methods/{paymentMethod}', [
                OwnerBoardingHousePaymentMethodController::class,
                'update',
            ]);

            Route::patch('/boarding-houses/{boardingHouse}/payment-methods/{paymentMethod}/status', [
                OwnerBoardingHousePaymentMethodController::class,
                'updateStatus',
            ]);

            Route::delete('/boarding-houses/{boardingHouse}/payment-methods/{paymentMethod}', [
                OwnerBoardingHousePaymentMethodController::class,
                'destroy',
            ]);

            Route::get('/boarding-houses/{boardingHouse}/payment-methods/{paymentMethod}/qr', [
                OwnerBoardingHousePaymentMethodController::class,
                'showQr',
            ])->name('owner.boarding-houses.payment-methods.qr');

            // Boarding-house room management
            Route::get('/boarding-houses/{boardingHouse}/rooms', [
                OwnerBoardingHouseRoomController::class,
                'index',
            ]);

            Route::post('/boarding-houses/{boardingHouse}/rooms', [
                OwnerBoardingHouseRoomController::class,
                'store',
            ]);

            Route::get('/boarding-houses/{boardingHouse}/rooms/{room}', [
                OwnerBoardingHouseRoomController::class,
                'show',
            ]);

            Route::put('/boarding-houses/{boardingHouse}/rooms/{room}', [
                OwnerBoardingHouseRoomController::class,
                'update',
            ]);

            Route::delete('/boarding-houses/{boardingHouse}/rooms/{room}', [
                OwnerBoardingHouseRoomController::class,
                'destroy',
            ]);

            Route::post('/boarding-houses/{boardingHouse}/rooms/{room}/images', [
                OwnerBoardingHouseRoomController::class,
                'uploadImages',
            ]);

            Route::delete('/boarding-houses/{boardingHouse}/rooms/{room}/images/{image}', [
                OwnerBoardingHouseRoomController::class,
                'destroyImage',
            ]);

            Route::get('/boarding-houses/{boardingHouse}/rooms/{room}/images/{image}', [
                OwnerBoardingHouseRoomController::class,
                'showImage',
            ])->name('owner.boarding-houses.rooms.images.show');

            // Owner boarding-house listings
            Route::get('/boarding-houses', function (Request $request) {

                if ($request->user()->role !== 'owner') {
                    return response()->json([
                        'success' => false,
                        'message' => 'Only owners can access this feature.',
                    ], 403);
                }

                return response()->json([
                    'success' => true,
                    'data' => Boardinghouse::where(
                        'owner_id',
                        $request->user()->id
                    )->latest()->paginate(10),
                ]);
            });

            Route::post('/boarding-houses', function (Request $request) {

                if ($request->user()->role !== 'owner') {
                    return response()->json([
                        'success' => false,
                        'message' => 'Only owners can create listings.',
                    ], 403);
                }

                $validated = $request->validate([
                    'name' => ['required', 'string', 'max:255'],
                    'description' => ['nullable', 'string'],
                    'rules' => ['nullable', 'string', 'max:10000'],
                    'city' => ['required', 'string', 'max:255'],
                    'barangay' => ['nullable', 'string', 'max:100'],
                    'address' => ['required', 'string', 'max:255'],
                    'monthly_rent' => ['required', 'numeric', 'min:0'],
                    'security_deposit' => ['nullable', 'numeric', 'min:0'],
                    'advance_payment' => ['nullable', 'numeric', 'min:0'],
                    'late_payment_fee' => [
                        'nullable',
                        'numeric',
                        'decimal:0,2',
                        'min:0',
                        'max:99999999.99',
                    ],
                    'grace_period_days' => ['nullable', 'integer', 'min:0'],
                    'available_rooms' => ['required', 'integer', 'min:0'],
                    'total_rooms' => ['required', 'integer', 'min:1'],
                    'room_type' => ['nullable', 'string', 'max:100'],
                    'billing_policy' => [
                        'sometimes',
                        'required',
                        'string',
                        'in:full_monthly,prorated',
                    ],
                    'amenities' => ['nullable', 'array'],
                    'amenities.*' => ['string', 'max:100'],
                ]);

                if ($validated['available_rooms'] > $validated['total_rooms']) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Available rooms cannot exceed total rooms.',
                    ], 422);
                }

                $boardingHouse = Boardinghouse::create([
                    ...$validated,
                    'owner_id' => $request->user()->id,
                    'security_deposit' => $validated['security_deposit'] ?? 0,
                    'advance_payment' => $validated['advance_payment'] ?? 0,
                    'billing_policy' => $validated['billing_policy'] ?? 'full_monthly',
                    'late_payment_fee' => $validated['late_payment_fee'] ?? 0,
                    'grace_period_days' => $validated['grace_period_days'] ?? 0,
                    'status' => 'pending',
                ]);

                return response()->json([
                    'success' => true,
                    'message' => 'Boarding house submitted for admin approval.',
                    'data' => $boardingHouse,
                ], 201);
            });

            // Boarding-house settings
            Route::patch('/boarding-houses/{boardingHouse}/settings', function (
                Request $request,
                Boardinghouse $boardingHouse
            ) {

                if ($request->user()->role !== 'owner') {
                    return response()->json([
                        'success' => false,
                        'message' => 'Only owners can update boarding-house settings.',
                    ], 403);
                }

                abort_unless(
                    (int) $boardingHouse->owner_id === (int) $request->user()->id,
                    404
                );

                $validated = $request->validate([
                    'late_payment_fee' => [
                        'sometimes',
                        'required',
                        'numeric',
                        'decimal:0,2',
                        'min:0',
                        'max:99999999.99',
                    ],
                    'grace_period_days' => [
                        'sometimes',
                        'required',
                        'integer',
                        'min:0',
                    ],
                    'rules' => [
                        'sometimes',
                        'nullable',
                        'string',
                        'max:10000',
                    ],
                ]);

                $boardingHouse->update($validated);

                return response()->json([
                    'success' => true,
                    'message' => 'Boarding-house settings updated successfully.',
                    'data' => $boardingHouse->refresh(),
                ]);
            });

            // Billing policy
            Route::patch('/boarding-houses/{boardingHouse}/billing-policy', function (
                Request $request,
                Boardinghouse $boardingHouse
            ) {

                if ($request->user()->role !== 'owner') {
                    return response()->json([
                        'success' => false,
                        'message' => 'Only owners can update boarding-house billing policies.',
                    ], 403);
                }

                abort_unless(
                    (int) $boardingHouse->owner_id === (int) $request->user()->id,
                    404
                );

                $validated = $request->validate([
                    'billing_policy' => [
                        'required',
                        'string',
                        'in:full_monthly,prorated',
                    ],
                ]);

                $boardingHouse->update([
                    'billing_policy' => $validated['billing_policy'],
                ]);

                return response()->json([
                    'success' => true,
                    'message' => 'Boarding-house billing policy updated successfully.',
                    'data' => $boardingHouse->refresh(),
                ]);
            });
        });

    /*
    |--------------------------------------------------------------------------
    | AUTHENTICATED USER ROUTE
    |--------------------------------------------------------------------------
    */

    Route::get('/user', function (Request $request) {
        return $request->user();
    })->middleware('auth:sanctum');

