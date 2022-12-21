<?php

namespace App\Http\Requests\Account\ApiKeys;

use Auth;
use Illuminate\Foundation\Http\FormRequest;

class CreateApiKeyRequest extends FormRequest {
    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize() {
        return Auth::check();
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, mixed>
     */
    public function rules() {
        return [
            'name' => ['required', 'string', 'max:255'],
            'permissions.*' => ['required', 'boolean'],
        ];
    }
}
