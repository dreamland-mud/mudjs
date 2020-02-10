
import $ from 'jquery';

import { useState, useEffect } from 'react';

export function usePrompt() {
    const [prompt, setPrompt] = useState(global.mudprompt || {});

    // subscribe to prompt events only after initial render
    useEffect(() => {
        const handlePromptUpdate = (e, b) => setPrompt($.extend({}, prompt, b));

        $('#rpc-events').on('rpc-prompt', handlePromptUpdate);

        return () => $('#rpc-events').off('rpc-prompt', handlePromptUpdate);
    }, []);

    return prompt;
}

