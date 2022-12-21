<?php

namespace App\Http\Controllers\Account\Security;

use App\Actions\DisableTwoFactorAuth;
use App\Actions\EnableTwoFactorAuth;
use App\Contracts\TwoFactorAuthenticationProvider;
use App\Helpers\Helpers;
use App\Http\Controllers\Controller;
use App\Http\Requests\Account\Security\PasswordUpdateRequest;
use App\Models\ApiKey;
use Hash;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Response;
use Inertia\ResponseFactory;
use PragmaRX\Google2FA\Exceptions\IncompatibleWithGoogleAuthenticatorException;
use PragmaRX\Google2FA\Exceptions\InvalidCharactersException;
use PragmaRX\Google2FA\Exceptions\SecretKeyTooShortException;

class AccessController extends Controller {
    /* Shows the access dashboard */
    public function index(Request $request): Response|ResponseFactory {
        return inertia('Account/Security/Access', [
            'api_keys' => fn () => ApiKey::whereBelongsTo($request->user())->paginate(10),
        ]);
    }

    /* Updates the current password to the given one */
    public function updatePassword(PasswordUpdateRequest $request): RedirectResponse {
        $request->user()->update([
            'password' => Hash::make($request->password),
        ]);

        return back();
    }

    /**
     * Shows the 2FA setup page.
     *
     * @throws IncompatibleWithGoogleAuthenticatorException
     * @throws SecretKeyTooShortException
     * @throws InvalidCharactersException
     */
    public function twoFactorSetup(Request $request, EnableTwoFactorAuth $enableTwoFactorAuth): Response|ResponseFactory|RedirectResponse {
        $user = $request->user();
        if (!$user->two_factor_enabled && $user->two_factor_secret == null) {
            $enableTwoFactorAuth($user);
        }
        $qr_url = app(TwoFactorAuthenticationProvider::class)->qrCodeUrl($user->email, $user->two_factor_secret);

        return inertia('Account/Security/TwoFactorSetup', [
            'secret' => fn () => $user->two_factor_enabled ? 'hidden' : $user->two_factor_secret,
            'qr_url' => fn () => $qr_url,
            'recovery_codes' => fn () => $user->two_factor_recovery_codes,
        ]);
    }

    /* Regenerates the 2FA Secret */
    public function regenerateTwoFactorSecret(Request $request, EnableTwoFactorAuth $enableTwoFactorAuth): RedirectResponse {
        $user = $request->user();
        $enableTwoFactorAuth($user);

        return back()->with('success', 'The 2FA secret has been regenerated!');
    }

    /* Disables 2FA */
    public function disableTwoFactor(Request $request, DisableTwoFactorAuth $disableTwoFactorAuth): RedirectResponse {
        $user = $request->user();
        $disableTwoFactorAuth($user);

        return back()->with('success', '2FA has been disabled!');
    }

    /* Validates the 2FA code */
    public function validateTwoFactor(Request $request): RedirectResponse {
        $user = $request->user();

        if ($user->validate2FA($request->one_time_password)) {
            if ($user->two_factor_verified_at == null) {
                $user->update([
                    'two_factor_verified_at' => now(),
                ]);
            }

            return back()->with('success', 'The entered code is valid :)');
        }

        return back()->withErrors(['Invalid 2FA Code! Please try again.']);
    }

    /* Regenerate Used Codes */
    public function regenerateRecoveryCodes(Request $request): RedirectResponse {
        $user = $request->user();
        $collection = collect($user->two_factor_recovery_codes);
        if ($collection->contains('USED') === false) {
            // Regenerate every code if none of them is used
            $user->update([
                'two_factor_recovery_codes' => $collection->map(fn () => Helpers::generateRecoveryCode()),
            ]);

            return back()->with('success', 'Recovery codes have been regenerated!');
        }
        // Replace all the recovery codes with new ones. The used codes values are 'USED'
        $user->update([
            'two_factor_recovery_codes' => $collection->map(fn ($code) => $code === 'USED' ? Helpers::generateRecoveryCode() : $code),
        ]);

        return back()->with('success', 'Used recovery codes have been regenerated!');
    }
}
