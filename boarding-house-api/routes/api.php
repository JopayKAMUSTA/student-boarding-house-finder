
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
});

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
