<?php

namespace App\Models;

use App\Helpers\Helpers;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class IpLocation extends Model {
    use HasFactory;

    protected $fillable = [
        'id',
        'ip_address',
        'location_data',
    ];

    protected $casts = [
        'location_data' => 'array',
    ];

    protected $appends = [
        'country_name',
        'country_code',
        'region_name',
        'region_code',
        'city_name',
        'area_code',
        'time_zone',
        'location_string',
    ];

    public function ipAddress(): Attribute {
        return new Attribute(
            get: fn ($value) => decrypt($value),
            set: fn ($value) => encrypt($value)
        );
    }

    public function getCountryNameAttribute(): string {
        return $this->location_data['countryName'] ?? '';
    }

    public function getCountryCodeAttribute(): string {
        return $this->location_data['countryCode'] ?? '';
    }

    public function getRegionNameAttribute(): string {
        return $this->location_data['regionName'] ?? '';
    }

    public function getRegionCodeAttribute(): string {
        return $this->location_data['regionCode'] ?? '';
    }

    public function getCityNameAttribute(): string {
        return $this->location_data['cityName'] ?? '';
    }

    public function getAreaCodeAttribute(): string {
        return $this->location_data['areaCode'] ?? '';
    }

    public function getTimeZoneAttribute(): string {
        return $this->location_data['timeZone'] ?? '';
    }

    public function getLocationStringAttribute(): string {
        return Helpers::locationStringFromIPLocation($this);
    }
}
