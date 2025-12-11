export interface Command {
    id: string;
    label: string;
    description: string;
    prompt: string;
    useGoogleSearch?: boolean;
}

export const COMMANDS: Command[] = [
    {
        id: '/fact-check',
        label: 'Fact Check',
        description: 'Verify with Google Search',
        prompt: 'Verify this information: {text}. {args}',
        useGoogleSearch: true,
    },
    {
        id: '/translate',
        label: 'Translate',
        description: 'Translate text',
        prompt: 'Translate this to {args}: {text}',
    },
];
