<?php

namespace App\Models;

use App\Contracts\TwoFactorAuthenticationProvider;
use App\Helpers\Helpers;
use App\Helpers\UserSettings;
use App\Traits\HasProfilePhoto;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasPermissions;
use Spatie\Permission\Traits\HasRoles;
use Spatie\Sluggable\HasSlug;
use Spatie\Sluggable\SlugOptions;

class User extends Authenticatable implements MustVerifyEmail {
    use HasFactory,
        HasSlug,
        HasApiTokens,
        Notifiable,
        HasRoles,
        HasPermissions,
        HasProfilePhoto;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'profile_photo_path',
        'gravatar_email',
        'last_activity_at',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'two_factor_verified_at',
        'settings',
    ];

    /**
     * The attributes that should be appended to arrays.
     *
     * @var array<int, string>
     */
    protected $appends = [
        'profile_photo_url',
        'two_factor_enabled',
        'is_online',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'two_factor_verified_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'last_activity_at' => 'datetime',
        'two_factor_verified_at' => 'datetime',
        'settings' => 'array',
    ];

    protected static function booted() {
        // Ensure that the user has a settings attribute and it's has all the keys.
        static::creating(function(User $user) {
            $user->settings = array_merge(UserSettings::$defaultSettings, $user->settings ?: []);
        });

        static::updating(function(User $user) {
            $user->settings = array_merge(UserSettings::$defaultSettings, $user->settings ?: []);
        });

        static::saving(function(User $user) {
            $user->settings = array_merge(UserSettings::$defaultSettings, $user->settings ?: []);
        });

        static::retrieved(function(User $user) {
            $user->settings = array_merge(UserSettings::$defaultSettings, $user->settings ?: []);
        });
    }

    public function getSlugOptions(): SlugOptions {
        return SlugOptions::create()
            ->generateSlugsFrom('name')
            ->saveSlugsTo('slug');
    }

    public function receivesBroadcastNotificationsOn(): string {
        return "User.{$this->id}";
    }

    public function getTwoFactorEnabledAttribute() {
        return !is_null($this->two_factor_secret) && !is_null($this->two_factor_verified_at);
    }

    /**
     * Interact with the user's two-factor secret.
     *
     * @return Attribute
     */
    protected function twoFactorSecret(): Attribute {
        return new Attribute(
            get: fn ($value) => $value != null ? decrypt($value) : null,
            set: fn ($value) => $value != null ? encrypt($value) : null,
        );
    }

    /**
     * Interact with the user's two-factor recovery codes.
     *
     * @return null|array|Attribute
     */
    protected function twoFactorRecoveryCodes(): Attribute {
        return new Attribute(
            get: fn ($value) => $value != null ? json_decode(decrypt($value)) : null,
            set: fn ($value) => $value != null ? encrypt(json_encode($value)) : null,
        );
    }

    /**
     * Validate the given two-factor authentication code.
     *
     * @param string $input
     */
    public function validate2FA(string $input): bool {
        if (!preg_match('/[0-9]{6}|[A-Za-z0-9]{6}\.[A-Za-z0-9]{4}\.[A-Za-z0-9]{6}\.[A-Za-z0-9]{4}/', $input)) {
            return false;
        }

        if (app(TwoFactorAuthenticationProvider::class)->verify($this->two_factor_secret, $input)) {
            return true;
        }

        if (collect($this->two_factor_recovery_codes)->filter(fn ($it) => preg_match('/[0-9]{6}|[A-Za-z0-9]{6}\.[A-Za-z0-9]{4}\.[A-Za-z0-9]{6}\.[A-Za-z0-9]{4}/', $it))->contains($input)) {
            // Replace the used code with a new one
            $this->update([
                'two_factor_recovery_codes' => collect($this->two_factor_recovery_codes)->map(fn ($it) => $it == $input ? Helpers::generateRecoveryCode() : $it),
            ]);

            return true;
        }

        return false;
    }

    /* Check if the user is online (in the last 5 minutes) */
    public function getIsOnlineAttribute(): bool {
        return $this->last_activity_at->diffInMinutes(now()) < 5;
    }

    /* Updates the given settings */
    public function updateSettings(array $settings) {
        foreach ($settings as $key => $value) {
            if (UserSettings::$defaultSettings[$key]) {
                $this->settings[$key] = $value ?: UserSettings::$defaultSettings[$key];
            }
        }
        $this->save();
    }

    /* Updates the given setting */
    public function updateSetting($key, $value = null) {
        if (UserSettings::$defaultSettings[$key]) {
            $this->settings[$key] = $value ?: UserSettings::$defaultSettings[$key];
            $this->save();
        }
    }

    /* Gets the API keys */
    public function apiKeys() {
        return $this->hasMany(ApiKey::class);
    }
}
