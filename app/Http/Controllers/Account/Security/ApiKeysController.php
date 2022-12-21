<?php

namespace App\Http\Controllers\Account\Security;

use App\Http\Controllers\Controller;
use App\Http\Requests\Account\ApiKeys\CreateApiKeyRequest;
use App\Models\ApiKey;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Permission;

class ApiKeysController extends Controller {
    /* Shows the create form */
    public function create(Request $request) {
        return inertia('Account/ApiKeys/Create', [
            'permissions' => fn () => Permission::all()->map(fn ($permission) => [$permission->name => $request->user()->can($permission->name)]),
        ]);
    }

    /* Creates the api key */
    public function createApiKey(CreateApiKeyRequest $request) {
        $key = ApiKey::create([
            'user_id' => $request->user()->id,
            'name' => $request->name,
            'permissions' => $request->permissions,
            'key' => ApiKey::generateKey(),
        ]);
        session()->put("{$key->id}-show_key", true);

        return redirect()->route('account.settings.api-keys.show', ['apiKey' => $key->id])->with('success', 'API Key created successfully');
    }

    /* Shows the given api key */
    public function show(ApiKey $apiKey) {
        return inertia('Account/ApiKeys/Show', [
            'apiKey' => $apiKey,
        ]);
    }

    /* Delets the given api key */
    public function deleteApiKey(ApiKey $apiKey) {
        $apiKey->delete();

        return back()->with('success', 'API Key deleted successfully');
    }
}
