import { usePage } from "@inertiajs/inertia-react";
import toast from "react-hot-toast";

// Handles the image size of the given url. This will allow us to show smaller/larger images and support all the 3rd party image providers.
export const handleImageSize = (url, size) => {
    // Check if is from gravatar
    const urlObj = new URL(url)
    if (urlObj.hostname.includes('gravatar.com')) {
        urlObj.searchParams.set("s", size);
        return urlObj.toString();
    } else if(urlObj.hostname.includes('ui-avatars.com')) {
        urlObj.searchParams.set("size", size);
        return urlObj.toString();
    } else {
        return url;
    }
}

// Handles the onChange event for the input types
export const handleChange = (setData, event) => {
    const { name, value, type } = event.target;
    setData(name, (type === "checkbox" ? event.target.checked : (type === "number" ? parseFloat(value) : value)) || '')
}

// Avoids the duplication of the error messages sent from the backend
export const handleError = (error, message) => {
    const { errors, flash } = usePage().props;
    if(Number.parseInt(errors.length) === 0 || flash.find(it => !!it.error).length === 0) {
        toast.error(message, {
            duration: 5000,
        })
        console.log({
            message,
            error,
        })
    }
}

// The data object is a key-value pair of the form data
// This method will fix the null values to empty strings
// And will fix it recursively
export const fixForms = (data) => {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
        if (value === null) {
            result[key] = '';
        } else if (typeof value === 'object') {
            result[key] = fixForms(value);
        } else {
            result[key] = value;
        }
    }
    return result;
}

// Checks if the current theme is dark mode or not
export const isDarkMode = () => {
    return document.getElementById('app').classList.contains('dark');
}

export const uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
}

export const ucFirst = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

export const capitalize = (string) => {
    return string.split(' ').map(it => ucFirst(it)).join(' ');
}
