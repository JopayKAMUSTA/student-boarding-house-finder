
<?php

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use App\Models\StudentProfile;
use App\Models\Boardinghouse;
use App\Models\OwnerProfile;
use App\Http\Controllers\OwnerBoardingHouseRoomController;



Route::get('/test', function () {
    return response()->json([
        'success' => true,
        'message' => 'Student Boarding House Finder API is working!',
    ]);
});




Route::get('/users',function () {
    return response()->json([
        'success'=>true,
        'data'=> DB::table('users')->select('id', 'name', 'email', 'created_at')->get(),
    ]);
});

Route::post('/login',function (Request $request){
    $validator = Validator::make($request->all(),[
        'email' => 'required|email',
        'password' => 'required|string',
    ]);

    if($validator->fails()) {
        return response() -> json([
            'success' => false,
            'errors' => $validator->errors(),
        ], 422);
    }

    $user = User::where('email',$request->email)->first();

    if(!$user || !Hash::check($request->password, $user->password)) {
        return response() -> json([
            'success' => false,
            'message' => 'Invalid email or password.',

        ], 401);
    }

    if($user->status !== 'active') {
        return response()->json([
            'success' => false,
            'message' => 'Your account is not active.',

        ], 403);
    }


    $token = $user->createToken('student-boarding-house-app')->plainTextToken;

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




Route::post('/register', function (Request $request){
    $validator = Validator::make($request->all(),[
        'first_name' => 'required|string|max:100',
        'middle_name' => 'nullable|string|max:100',
        'last_name' => 'required|string|max:100',
        'email' => 'required|email|max:255|unique:users,email',
        'password' => 'required|string|min:8|confirmed',
    ]);

    if($validator -> fails()) {
        return response()->json([
            'success' => false,
            'errors' => $validator->errors(),
        ], 422);
    }

    $user = User::create([
        'name' => trim(
            $request->first_name . ' '. 
            ($request->middle_name ? $request->middle_name . ' ' : '').
            $request-> last_name
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

Route::post('/owner/register', function (Request $request) {
    $validator = Validator::make($request->all(), [
        'first_name' => 'required|string|max:100',
        'middle_name' => 'nullable|string|max:100',
        'last_name' => 'required|string|max:100',
        'email' => 'required|email|max:255|unique:users,email',
        'password' => 'required|string|min:8|confirmed',
        'contact_number' => 'nullable|string|max:30',
        'business_name' => 'nullable|string|max:255',
        'business_address' => 'nullable|string|max:255',
    ]);

    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'errors' => $validator->errors(),
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



Route::middleware('auth:sanctum')->get('/profile', function (Request $request) {
    $user =$request->user();

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




Route::middleware('auth:sanctum')->post('/logout', function (Request $request){
    $request->user()->currentAccessToken()->delete();

    return response()->json([
        'success' => true,
        'message' => 'Logout successful',
    ]);
});





Route::middleware('auth:sanctum')->group(function() {

    Route::get('/student-profile', function(Request $request){
        $user = $request->user();

        if($user->role !== 'student') {
            return response()->json([
                'success' => false,
                'message' => 'Only students can access this profile.',

            ], 403);
        }

        $profile = StudentProfile::where('user_id', $user->id)->first();

        return response()->json([
            'success' => true,
            'data' => $profile,
        ]);
    });




     Route::put('/student-profile', function(Request $request){
        $user = $request->user();

        if($user->role !== 'student'){
            return response()->json([
                'success' => true,
                'message' => 'Only students can update this profile.',

            ], 403);
        }

        $validated = $request -> validate([
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
            'message' => 'Student profile save successfully.',
            'data' => $profile,
        ]);
    });

});







Route::get('/boarding-houses', function (Request $request) {
    $request->validate([
        'city' => ['nullable', 'string' , 'max:100'],
        'room_type' => ['nullable', 'string', 'max:100'],
        'max_rent' => ['nullable', 'numeric', 'min:0'],
    ]);


$boardingHouses = BoardingHouse::query()
    ->where('status', 'approved')
    ->when($request->filled('city'), function ($query) use ($request) {
        $query->where('city', 'like', '%' . $request->city . '%');
    })
    ->when($request->filled('room_type'), function ($query) use ($request) {
        $query->where('room_type', $request->room_type);
    })
    ->when($request->filled('max_rent'), function ($query) use ($request) {
        $query->where('monthly_rent', '<=', $request->max_rent);
    })
    ->orderBy('monthly_rent')
    ->paginate(10);


        return response()->json([
            'success' => true,
            'data' => $boardingHouses,
        ]);
});


Route::get('/boarding-houses/{id}',function ($id){
    $boardingHouses = BoardingHouse::query()
    ->where('status', 'approved')
    ->find($id);

    if(!$boardingHouses) {
        return response()->json([
            'success' => false,
            'message' => 'Boarding house not found.',
        ], 404);
    }

    return response()->json([
        'success' => true,
        'data' => $boardingHouses,
    ]);
});







Route::middleware('auth:sanctum')->prefix('owner')->group(function () {
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

    Route::get('/boarding-houses', function (Request $request) {
        if($request->user()->role !== 'owner') {
            return response()->json([
                'success' => false,
                'message' => 'Only owners can access this feature.',
            ], 403);
        }

        return response()->json([
            'success' => true,
            'data' => BoardingHouse::where(
                'owner_id',
                $request->user()->id
            )->latest()->paginate(10),
        ]);
    });



    Route::post('/boarding-houses', function (Request $request){
        if($request->user()->role !== 'owner') {
            return response()->json([
                'success' => false,
                'message' => 'Only owners can create listings',
            ], 403);
        }

        $validated = $request->validate([
            'name' => ['required','string','max:255'],
            'description' => ['nullable', 'string'],
            'city' => ['required', 'string', 'max:255'],
            'barangay' => ['nullable','string','max:100'],
            'address' => ['required','string','max:255'],
            'monthly_rent' => ['required', 'numeric', 'min:0'],
            'security_deposit' => ['nullable', 'numeric', 'min:0'],
            'advance_payment' => ['nullable', 'numeric', 'min:0'],
            'available_rooms' => ['required', 'integer', 'min:0'],
            'total_rooms' => ['required', 'integer', 'min:1'],
            'room_type' => ['nullable', 'string', 'max:100'],
            'amenities' => ['nullable', 'array'],
            'amenities.*' => ['string' , 'max:100'],
        ]);

        if($validated['available_rooms'] > $validated['total_rooms']) {
            return response()->json([
                'success' => false,
                'message' => 'Available rooms cannot exceed total rooms.',
            ], 422);
        }

        $boardingHouses = BoardingHouse::create([
            ...$validated,
            'owner_id' => $request->user()->id,
            'security_deposit' => $validated['security_deposit'] ?? 0,
            'advance_payment' => $validated['advance_payment'] ?? 0,
            'status' => 'pending',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Boarding house submitted for admin approval.',
            'data' => $boardingHouses,
        ], 201);
    });
});





Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
