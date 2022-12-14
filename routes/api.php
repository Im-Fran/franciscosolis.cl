<?php

use App\Http\Controllers\API as Controllers;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/

Route::prefix('activity-status')->middleware(['auth:sanctum'])->group(function() {
    Route::get('/{user}', [Controllers\ActivityController::class, 'getActivity'])
        ->name('activity-status.get');
});
