/* @refresh reload */
import "tailwindcss/tailwind.css";
import { render } from "solid-js/web";
import Routes from "./routes";

const root = document.getElementById("root");

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
    throw new Error("Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?");
}

const App = () => {

    const darkClass = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "";

    return <div class={darkClass}>
        <div class={"bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100"}>
            <div class={"container mx-auto w-full min-h-screen"}>
                <Routes/>
            </div>
        </div>
    </div>
}

render(App, root!);
