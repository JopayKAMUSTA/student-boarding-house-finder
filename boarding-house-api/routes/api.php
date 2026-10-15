
<?php

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;



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
            'errors' => $validator-> errors(),
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
            'errors' => $validator->error(),
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




Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
