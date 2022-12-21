<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class NotificationsController extends Controller {
    /* Shows the notifications page */
    public function index(Request $request) {
        $user = $request->user();

        return inertia('Account/Notifications', [
            'notifications' => fn () => $user->readNotifications()->paginate(
                $request->input('notifications_per_page', 5) ?? 5,
                ['*'],
                'notifications_page',
            ),
            'unreadNotifications' => fn () => $user->unreadNotifications()->paginate(
                $request->input('unread_notifications_per_page', 5) ?? 5,
                ['*'],
                'unread_notifications_page',
            ),
        ]);
    }

    /* Mark the given notification as read */
    public function markAsRead($notification) {
        \Auth::user()->notifications()->find($notification)->markAsRead();

        return redirect()->back();
    }

    /* Delete the given notification */
    public function delete($notification) {
        \Auth::user()->notifications()->find($notification)->delete();

        return redirect()->back();
    }
}
