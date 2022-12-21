<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class AccountController extends Controller {
    /* Show the account overview page */
    public function index(Request $request) {
        return inertia('Account/Index', [
            'notifications' => fn () => $request->user()->unreadNotifications()->limit(5)->get(),
            'notificationsCount' => fn () => $request->user()->unreadNotifications()->count() - 5,
        ]);
    }
}
