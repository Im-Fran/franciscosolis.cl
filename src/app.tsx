import {Component} from "solid-js";
import Routes from "./routes";
import {createSignal} from "solid-js";
import {boolFromStr} from "./utils/utils";

const App: Component = () => {
    const [isDarkModeEnabled, setDarkModeEnabled] = createSignal(localStorage.getItem('dark-mode-enabled') != null ? boolFromStr(localStorage.getItem('dark-mode-enabled')) : window.matchMedia("(prefers-color-scheme: dark)").matches)

    const toggleDarkMode = () => {
        const newMode = !isDarkModeEnabled()
        localStorage.setItem('dark-mode-enabled', newMode.toString())
        setDarkModeEnabled(newMode)
    }

    // Listen for ALT+K / Option+K to toggle dark mode
    window.addEventListener('keydown', (e) => {
        if (e.altKey && e.key === 'k') {
            console.log('Toggling dark mode...')
            toggleDarkMode()
        }
    });

    return <div class={`${isDarkModeEnabled() ? 'dark' : ''}`}>
        <div class={"bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 transition-color duration-300"}>
            <Routes/>
        </div>
    </div>
}

export default App;