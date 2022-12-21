<?php

namespace App\Providers;

use App\Contracts\TwoFactorAuthenticationProvider as TwoFactorAuthContract;
use Illuminate\Contracts\Cache\Repository;
use Illuminate\Support\ServiceProvider;
use PragmaRX\Google2FA\Google2FA;

class AppServiceProvider extends ServiceProvider {
    /**
     * Register any application services.
     */
    public function register() {
        if (app()->isLocal()) {
            app()->register(\Barryvdh\LaravelIdeHelper\IdeHelperServiceProvider::class);
        }

        // Register the 2FA Auth Provider
        app()->singleton(TwoFactorAuthContract::class, fn ($app) => new TwoFactorAuthProvider(
            $app->make(Google2FA::class),
            $app->make(Repository::class),
        ));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot() {
    }
}
