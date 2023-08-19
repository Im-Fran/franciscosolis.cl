import {createSignal} from 'solid-js';

export default function TypeAnimation({ sequence = [], infinite = false, writingSpeed = 80, deletionSpeed = 150, style }) {
    const [display, setDisplay] = createSignal(sequence.filter(it => typeof it === 'string')[0]);
    const [typing, setTyping] = createSignal(false);
    const events = []

    const render = (sequenceIndex = 1) => {
        setTyping(false);
        if (infinite && sequenceIndex >= sequence.length) {
            return render(0);
        }

        const item = sequence[sequenceIndex];
        if (typeof item === 'number') {
            return events.push(setTimeout(() => render(sequenceIndex + 1), item))
        } else if (typeof item !== 'string') {
            // Continue
            return render(sequenceIndex + 1);
        }

        if(item === display()) {
            // Continue
            return render(sequenceIndex + 1);
        }

        // If the displayed string is empty, add one by one animated and recursively the characters
        const addCharacters = (index = 0) => {
            setTyping(true);
            if(index >= item.length) {
                return render(sequenceIndex + 1);
            }

            setDisplay(display() + item[index]);
            events.push(setTimeout(() => {
                addCharacters(index + 1);
            }, writingSpeed?.value ?? 100))
        }

        if(display() === '') {
            return addCharacters();
        }

        // If the next item starts with the current string, add one by one animated and recursively the characters
        if(item.startsWith(display())) {
            return addCharacters(display().length);
        }

        // Now we're sure the strings are not equal, so we need to remove the characters one by one
        const removeCharacters = (index = display().length - 1) => {
            setTyping(true);
            if(index < 0) {
                return addCharacters();
            }

            setDisplay(display().substring(0, index));
            events.push(setTimeout(() => {
                if (item.startsWith(display())) {
                    return addCharacters(display().length);
                }
                removeCharacters(index - 1);
            }, deletionSpeed?.value ?? 100))
        }

        return removeCharacters();
    }

    render()

    // On page leave, clear all timeouts
    window.addEventListener('beforeunload', () => events.forEach(clearTimeout));

    return <>
        {/* We always pre-render the first string */}
        <span class={"type-animation-container"}>
            {display()}
            <span class={typing() ? '' : 'animate-blink'} style={style}>|</span>
        </span>
    </>
}
