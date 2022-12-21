<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ApiKey extends Model {
    use HasFactory;

    protected $fillable = [
        'user_id',
        'name',
        'key',
        'permissions',
        'last_used_at',
    ];

    protected $hidden = [
        'key',
    ];

    protected $casts = [
        'permissions' => 'array',
        'last_used_at' => 'datetime',
    ];

    public function user() {
        return $this->belongsTo(User::class);
    }

    public static function generateKey(): string {
        return sha1(bin2hex(random_bytes(32)));
    }

    protected static function booted() {
        static::creating(function(ApiKey $apiKey) {
            $apiKey->permissions = array_merge($apiKey->user->permissions->toArray(), $apiKey->permissions);
        });

        static::updating(function(ApiKey $apiKey) {
            $apiKey->permissions = array_merge($apiKey->user->permissions->toArray(), $apiKey->permissions);
        });

        static::saving(function(ApiKey $apiKey) {
            $apiKey->permissions = array_merge($apiKey->user->permissions->toArray(), $apiKey->permissions);
        });

        static::retrieved(function(ApiKey $apiKey) {
            $apiKey->permissions = array_merge($apiKey->user->permissions->toArray(), $apiKey->permissions);
        });
    }
}
