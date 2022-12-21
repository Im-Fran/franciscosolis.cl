<?php

use App\Http\Controllers;
use App\Http\Controllers\Account;
use App\Http\Controllers\Account\Settings as AccountSettings;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

Route::get('/', [Controllers\MainController::class, 'home'])->name('home');

Route::prefix('/account')->middleware(['auth', '2fa', 'verified'])->group(function() {
    Route::get('/', [Account\AccountController::class, 'index'])->name('account');

    /* Settings */
    Route::prefix('/settings')->group(function() {
        Route::get('/', [AccountSettings\SettingsController::class, 'index'])->name('account.settings');
        Route::patch('/', [AccountSettings\SettingsController::class, 'update'])->name('account.settings.update');

        /* Profile Photo */
        Route::prefix('/profilephoto')->group(function() {
            Route::post('/', [AccountSettings\ImagesController::class, 'uploadProfilePhoto'])->name('account.settings.profilephoto');
            Route::delete('/', [AccountSettings\ImagesController::class, 'clearProfilePhoto'])->name('account.settings.profilephoto.delete');
        });

        /* Api Keys */
        Route::prefix('/api-keys')->group(function() {
            Route::get('/', [Account\Security\ApiKeysController::class, 'create'])->name('account.settings.api-keys.create');
            Route::post('/', [Account\Security\ApiKeysController::class, 'createApiKey']);
            Route::get('/{apiKey}', [Account\Security\ApiKeysController::class, 'show'])->name('account.settings.api-keys.show');
            Route::patch('/{apiKey}', [Account\Security\ApiKeysController::class, 'updateApiKey'])->name('account.settings.api-keys.update');
            Route::delete('/{apiKey}', [Account\Security\ApiKeysController::class, 'deleteApiKey'])->name('account.settings.api-keys.delete');
        });

        /* Privacy */
        Route::post('/privacy', [AccountSettings\PrivacyController::class, 'update'])->name('account.settings.privacy.update');
    });

    /* Security */
    Route::prefix('/security')->group(function() {
        /* Access */
        Route::prefix('/access')->group(function() {
            Route::get('/', [Account\Security\AccessController::class, 'index'])->name('account.security.access');
            Route::patch('/password', [Account\Security\AccessController::class, 'updatePassword'])->middleware(['password.confirm'])->name('account.security.access.password');

            Route::get('/two-factor-auth', [Account\Security\AccessController::class, 'twoFactorSetup'])->name('account.security.access.two-factor-auth.setup');
            Route::post('/two-factor-auth', [Account\Security\AccessController::class, 'validateTwoFactor'])->name('account.security.access.two-factor-auth.validate');
            Route::patch('/two-factor-auth/secret', [Account\Security\AccessController::class, 'regenerateTwoFactorSecret'])->name('account.security.access.two-factor-auth.secret.regenerate')->middleware(['password.confirm']);
            Route::patch('/two-factor-auth/codes', [Account\Security\AccessController::class, 'regenerateRecoveryCodes'])->name('account.security.access.two-factor-auth.recovery-codes.regenerate')->middleware(['password.confirm']);
            Route::delete('/two-factor-auth', [Account\Security\AccessController::class, 'disableTwoFactor'])->name('account.security.access.two-factor-auth.delete')->middleware(['password.confirm']);

            Route::get('/devices', [Account\Security\DevicesController::class, 'index'])->name('account.security.access.devices');
            Route::delete('/devices', [Account\Security\DevicesController::class, 'destroy'])->name('account.security.access.devices.delete')->middleware(['password.confirm']);
        });
    });

    /* Notifications */
    Route::prefix('/notifications')->group(function() {
        Route::get('/', [Account\NotificationsController::class, 'index'])->name('account.notifications');
        Route::post('/{notification}', [Account\NotificationsController::class, 'markAsRead'])->name('account.notifications.markasread');
        Route::delete('/{notification}', [Account\NotificationsController::class, 'delete'])->name('account.notifications.delete');
    });
});

require __DIR__.'/auth.php';

Broadcast::routes();
