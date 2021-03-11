
import $ from 'jquery';

import { useState, useEffect } from 'react';

// Called every time from render(). This function can conventially be called 
// only from another use* or from render.
export function usePrompt() {
    // Get state (prompt) and setter function for this state.
    const [prompt, setPrompt] = useState(global.mudprompt || {});

    // Subscribe to prompt events only after initial render.
    // Describe the function to be called when 2nd argument changes, 
    // in this case called only once. 
    useEffect(() => {
        // This event handler will cause the state (prompt) to change.
        const handlePromptUpdate = (e, b) => setPrompt($.extend({}, prompt, b));

        // Subscribes to the custom rpc-prompt event, triggering prompt state change every time.
        $('#rpc-events').on('rpc-prompt', handlePromptUpdate);

        // This function will be called when a component (that uses this state) is about to be unmounted.
        return () => $('#rpc-events').off('rpc-prompt', handlePromptUpdate);
    });

    // Returns current state value, to be used inside a component's render() function.
    return prompt;
}

