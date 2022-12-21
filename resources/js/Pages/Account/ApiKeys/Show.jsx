import {handleError, fixForms, handleChange, capitalize} from '@/js/Utils/Utils'
import { useForm } from '@inertiajs/inertia-react'

import AccountLayout from "@/js/Layouts/AccountLayout";
import Label from '@/js/Components/Forms/Label';
import Input from '@/js/Components/Forms/Input';
import Checkbox from '@/js/Components/Forms/Checkbox';
import Button from '@/js/Components/Button';

export default function Show({ apiKey }) {
    const meta = [
        { property: 'og:title', content: 'Account > API Keys > Create | FranciscoSolis' },
    ];

    const { patch, data, setData } = useForm(fixForms({
        name: apiKey.name,
        permissions: apiKey.permissions,
    }));

    const setPermission = (permission, value) => {
        setData('permissions', {
            ...data.permissions,
            [permission]: value,
        });
    }

    const submit = (e) => {
        e.stopPropagation()
        e.preventDefault()

        patch(route('account.settings.api-keys.update', { apiKey: apiKey.id }), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('API Key updated successfully.');
            },
            onError: (error) => {
                handleError(error, 'There was an error updating your API Key.');
            },
        });
    }

    return (
        <AccountLayout title="API Keys > Create" meta={meta}>
            <div className="flex flex-col w-full items-start">
                <form onSubmit={submit} className="mb-5 w-full">
                    <h2 className="text-xl">Create API Key</h2>
                    <hr className="w-1/4 border-0 border-t-2 border-gray-500 mb-10"/>

                    {/* Name */}
                    <div className="flex flex-col w-1/3">
                        <Label forInput="name" value="Name" info="This will be the name of your API Key."/>

                        <Input
                            type="text"
                            name="name"
                            placeholder="My API Key"
                            className="mt-1 w-full"
                            handleChange={(e) => handleChange(setData, e)}
                            value={data.name}
                            required
                        />
                    </div>

                    {/* Permissions */}
                    {data.permissions.map((permission, index) => (
                        <div key={index} className="flex flex-col mt-5">
                            <Checkbox center={false} name={permission} value={data.permissions[permission]} handleChange={(e) => handleChange(setPermission, e)} label={capitalize(permission.replace('.', ' '))} info="If enabled everyone will be able to see if you're online or not." />
                        </div>
                    ))}

                    {/* Submit */}
                    <div className="flex w-full justify-end">
                        <div className="block justify-end items-end mt-5">
                            <Button type="submit" color={300}>Create API Key</Button>
                        </div>
                    </div>
                </form>
            </div>
        </AccountLayout>
    );

}
