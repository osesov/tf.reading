// source: https://stackoverflow.com/a/57926311

import { Inputs, useEffect, useRef } from "preact/hooks";

type Handler<E extends Event> = (event: E) => void;

// Hook
export function useEventListener<E extends Event>(element: EventTarget | null | undefined, eventName: string, handler: Handler<E>, inputs: Inputs) {
    // Create a ref that stores handler
    const savedHandler = useRef<Handler<E>>();

    // Update ref.current value if handler changes.
    // This allows our effect below to always get latest handler ...
    // ... without us needing to pass it in effect deps array ...
    // ... and potentially cause effect to re-run every render.
    useEffect(() => {
        savedHandler.current = handler;
    }, [handler]);

    useEffect(
        () => {
            // Make sure element supports addEventListener
            // On
            const isSupported = element && element.addEventListener;
            if (!isSupported)
                return;

            // Create event listener that calls handler function stored in ref
            const eventListener = (event: Event) => {savedHandler.current?.(event as E) }

            console.log("Attach ", eventName, element);
            // Add event listener
            element.addEventListener(eventName, eventListener);

            // Remove event listener on cleanup
            return () => {
                console.log("Detach ", eventName, element);
                element.removeEventListener(eventName, eventListener);
            };
        },
        [eventName, element, ...inputs] // Re-run if eventName or element changes
    );
};
