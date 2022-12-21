import {useState} from 'react';
import {useForm, usePage} from "@inertiajs/inertia-react";
import {Inertia} from '@inertiajs/inertia';
import {handleError, fixForms, handleChange} from '@/js/Utils/Utils'
import toast from 'react-hot-toast';

import { Cog6ToothIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import AccountLayout from "@/js/Layouts/AccountLayout";
import Label from "@/js/Components/Forms/Label";
import Input from "@/js/Components/Forms/Input";
import InputError from "@/js/Components/Forms/InputError";
import Button from '@/js/Components/Button';
import Checkbox from '@/js/Components/Forms/Checkbox';
import UserProfilePicture from '@/js/Components/UserProfilePicture';

export default function Settings() {
    const meta = [
        { property: 'og:title', content: 'Account > Settings | FranciscoSolis' },
    ];

    const { auth } = usePage().props;

    const { data, setData, errors, patch, clearErrors, setError } = useForm(`EditUserSettings:${auth.user.id}`, fixForms({
        name: auth.user.name,
        email: auth.user.email,
        gravatar_email: auth.user.gravatar_email,
    }));

    const privacyForm = useForm(`EditUserPrivacy:${auth.user.id}`,fixForms({
        'activity.public': auth.user.settings['activity.public'],
    }));

    const submitPrivacy = (e) => {
        e.preventDefault();
        e.stopPropagation();
        privacyForm.transform((form) => ({
            ...form,
            'activity.public': form['activity.public'] ? true : false,
        }));
        privacyForm.post(route('account.settings.privacy.update'), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Settings updated successfully.')
            },
            onError: (err) => {
                handleError(err, 'There was an error updating your settings.')
            },
            only: ['auth', 'flash', 'errors'],
        });
    }

    const submit = (e) => {
        e.preventDefault();
        e.stopPropagation();
        patch(route('account.settings.update'), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Settings updated successfully.')
            },
            onError: (err) => {
                handleError(err, 'There was an error updating your settings.')
            },
            only: ['auth', 'flash', 'errors'],
        });
    }

    const onBlurName = (e) => {
        const name = e.target.value || '';
        if(name.length < 4) {
            setError('name', 'Name must be at least 3 characters.');
        } else if(name.startsWith('.') || name.startsWith('_')) {
            setError('name', 'Name cannot start with a dot or underscore.');
        } else if(name.endsWith('.') || name.endsWith('_')) {
            setError('name', 'Name cannot end with a dot or underscore.');
        } else if ([0,1,2,3,4,5,6,7,8,9].filter(it => name.startsWith(`${it}`)).length > 0) {
            setError('name', 'Name cannot start with a number.');
        } else if(name.length > 255){
            setError('name', 'Name cannot be longer than 255 characters.');
        } else {
            clearErrors('name');
        }
    };

    /* Profile Photo */
    const [profilePhotoState, setProfilePhotoState] = useState('Edit');
    const onClickEditProfilePhoto = () => {
        document.getElementById('select-profilephoto').click();
    };

    const onProfilePhotoMouseEnter = (e) => {
        document.getElementById('profilePhotoEdit').classList.remove('h-0');
        document.getElementById('profilePhotoEdit').classList.add('h-1/4');
    };

    const onProfilePhotoMouseLeave = (e) => {
        if(profilePhotoState === 'Edit') {
            document.getElementById('profilePhotoEdit').classList.remove('h-1/4');
            document.getElementById('profilePhotoEdit').classList.add('h-0');
        }
    };

    const handleProfilePhotoUpload = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setProfilePhotoState('Uploading');
        let file = e.target.files[0];
        if (!file.type.startsWith('image/')) {
            toast.error('The file you uploaded is not an image! Please try again.', {
                duration: 5000,
            });
            console.log('Trying to upload a non-image file: ' + file.type);
        } else {
            Inertia.post(route('account.settings.profilephoto'), {
                profile_photo: file,
                gravatar: null,
            }, {
                preserveScroll: true,
                forceFormData: true,
                onError: (error) => {
                    handleError(error, 'There was an error uploading your profile photo. Please try again.')
                },
                onSuccess: () => {
                    toast.success('Profile photo updated successfully!', {
                        duration: 5000,
                    });
                },
                onFinish: () => {
                    setProfilePhotoState('Edit');
                    e.target.value = ''
                },
                only: ['auth', 'flash', 'errors'],
            })
        }
    };

    const clearProfilePhoto = () => {
        const { profile_photo_path } = auth.user;
        if(profile_photo_path === null){
            toast.error('You do not have a profile photo to clear!', {
                duration: 5000,
            });
        } else {
            Inertia.post(route('account.settings.profilephoto.delete'), {
                _method: 'delete', // We use this to show the toasts, if we use `Inertia.delete` for some reason it won't show the toasts.
            }, {
                preserveScroll: true,
                forceFormData: true,
                onError: (error) => {
                    handleError(error, 'There was an error uploading your profile photo. Please try again.')
                },
                onSuccess: () => {
                    setProfilePhotoState('Edit');
                    toast.success('Profile photo cleared successfully!', {
                        duration: 5000,
                    });
                },
                only: ['auth', 'flash', 'errors'],
            })
        }
    }

    const enableGravatar = () => {
        const {profile_photo_path} = auth.user;
        if(profile_photo_path === 'gravatar') {
            toast.error('You already have a gravatar set as your profile photo.', {
                duration: 5000,
            })
        } else {
            Inertia.post(route('account.settings.profilephoto'), {
                gravatar: true,
                profile_photo: null,
            }, {
                preserveScroll: true,
                forceFormData: true,
                onError: (error) => {
                    handleError(error, 'There was an error while setting the gravatar config. Please try again later.')
                },
                onSuccess: () => {
                    toast.success('Now using gravatar as image!', {
                        duration: 5000,
                    });
                },
                onFinish: () => {
                    setProfilePhotoState('Edit');
                },
                only: ['auth', 'flash', 'errors'],
            })
        }
    }


    return (
        <AccountLayout title="Settings" meta={meta}>
            <div className="flex flex-col w-full items-start">
                <form onSubmit={submit} className="mb-5 w-full">
                    <h2 className="flex text-xl"><Cog6ToothIcon className="w-6 h-6"/>&nbsp; Profile Settings</h2>
                    <hr className="w-1/4 border-0 border-t-2 border-gray-500 mb-10"/>

                    {/* Profile Photo */}
                    <div className="flex mb-5">
                        <button type="button" onClick={() => onClickEditProfilePhoto()} onMouseEnter={onProfilePhotoMouseEnter} onMouseLeave={onProfilePhotoMouseLeave} className="block flex-grow-0 flex-shrink-0 relative w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden bg-none box-border cursor-pointer">
                            <UserProfilePicture showStatus={false} user={auth.user} id="profilePhotoImage" sizeClass="w-24 h-24 md:w-32 md:h-32" size={128}/>
                            <div id="profilePhotoEdit" className={"absolute text-center text-xs md:text-base bg-gray-500 bg-opacity-50 transition-all ease-in-out duration-200 left-0 right-0 bottom-0 " + (profilePhotoState === 'Edit' ? 'h-0' : 'h-1/4')}>
                                {profilePhotoState}
                            </div>
                        </button>
                        <div className="flex flex-col ml-10">
                            <div><Button type="button" onClick={onClickEditProfilePhoto} className="!text-sm">Select New Profile Photo</Button></div>
                            <div><Button type="button" onClick={clearProfilePhoto} color={200} className="!text-sm mt-3">Clear Profile Photo</Button></div>
                            <div><Button type="button" onClick={enableGravatar} color={300} className="!text-sm mt-3">Use Gravatar</Button></div>
                            <input onChange={handleProfilePhotoUpload} id="select-profilephoto" name="profilephoto" type="file" hidden/>
                        </div>
                    </div>

                    {/* Account Name + Email */}
                    <div className="grid grid-cols-3 gap-12 mb-5">
                        {/* Name */}
                        <div className="flex flex-col">
                            <Label forInput="name" value="Name"/>

                            <Input
                                type="text"
                                name="name"
                                placeholder="Im.Fran_"
                                className="mt-1 w-full"
                                autoComplete="username"
                                pattern="([a-zA-Z]+[a-zA-Z0-9_\. ][a-zA-Z0-9]+){4,255}"
                                handleChange={(e) => handleChange(setData, e)}
                                handleBlur={onBlurName}
                                value={data.name}
                                required
                            />

                            <InputError message={errors.name} className="mt-2" />
                        </div>

                        {/* Email */}
                        <div className="flex flex-col">
                            <Label forInput="email" value="Email"/>

                            <Input
                                type="email"
                                name="email"
                                placeholder="fran@franciscosolis.cl"
                                className="mt-1 w-full"
                                autoComplete="email"
                                handleChange={(e) => handleChange(setData, e)}
                                value={data.email}
                                required
                            />

                            <InputError message={errors.email} className="mt-2" />
                        </div>

                        {/* Gravatar Email */}
                        <div className="flex flex-col">
                            <Label forInput="gravatar_email" value="Gravatar Email" info="If this is empty, your email will be used."/>

                            <Input
                                type="email"
                                name="gravatar_email"
                                placeholder="gravatar.fran@franciscosolis.cl"
                                className="mt-1 w-full"
                                autoComplete="email"
                                handleChange={(e) => handleChange(setData, e)}
                                value={data.gravatar_email}
                            />

                            <InputError message={errors.gravatar_email} className="mt-2" />
                        </div>
                    </div>

                    {/* Save button */}
                    <Button color={100} className="!text-sm">Save</Button>
                </form>

                <div className="my-10"/>

                <form onSubmit={submitPrivacy} className="mb-5 w-full">
                    <h2 className="flex text-xl"><ShieldCheckIcon className="w-6 h-6"/>&nbsp;Privacy Settings</h2>
                    <hr className="w-1/4 border-0 border-t-2 border-gray-500 mb-10"/>

                    {/* Activity Public */}
                    <div className="mt-4">
                        <Checkbox center={false} name="activity.public" value={privacyForm.data['activity.public']} handleChange={(e) => handleChange(privacyForm.setData, e)} label="Activity Public" info="If enabled everyone will be able to see if you're online or not." />
                    </div>

                    {/* Save button */}
                    <Button color={100} className="!text-sm">Save</Button>
                </form>
            </div>
        </AccountLayout>
    );
}
