<?php

namespace App\Http\Middleware;

use Auth;
use Cache;
use Closure;
use DB;
use Illuminate\Http\Request;

class LogoutDestroyedSession {
    /**
     * Handle an incoming request.
     *
     * @param \Illuminate\Http\Request $request
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     *
     * @return \Illuminate\Http\RedirectResponse|\Illuminate\Http\Response
     */
    public function handle(Request $request, Closure $next) {
        $user = $request->user();
        if (!$user) {
            return $next($request);
        }

        $logouts = Cache::rememberForever("logout-{$user->id}", fn () => collect());
        $sessionId = $request->session()->getId();
        if ($logouts->contains($sessionId)) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            $logouts->pull($sessionId);
            DB::connection(config('session.connection'))->table(config('session.table', 'session'))
                ->where('id', $sessionId)
                ->delete();
            Auth::logoutCurrentDevice();
            Cache::forever("logout-{$user->id}", $logouts);
        }

        return $next($request);
    }
}
