/* @refresh reload */
import "tailwindcss/tailwind.css";
import {render} from "solid-js/web";
import App from './app'

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
    throw new Error("Root element not found! Please make sure there's a body inside index.html and that it's not being hidden by CSS.");
}

render(() => <App/>, root!);
