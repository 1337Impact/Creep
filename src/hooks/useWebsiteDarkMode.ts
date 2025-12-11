import { useState, useEffect } from 'react';

/**
 * Custom hook to detect if the website is in dark mode.
 * Checks multiple signals: CSS media query, common dark mode classes/attributes,
 * and background color luminance.
 */
export function useWebsiteDarkMode() {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        const checkDarkMode = () => {
            // Check CSS media query
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

            // Check common dark mode indicators on html/body
            const html = document.documentElement;
            const body = document.body;
            const hasDarkClass = html.classList.contains('dark') || body.classList.contains('dark');
            const hasDarkAttribute = html.getAttribute('data-theme') === 'dark' || body.getAttribute('data-theme') === 'dark';

            // Check background color luminance
            const bgColor = window.getComputedStyle(body).backgroundColor;
            const rgb = bgColor.match(/\d+/g);
            let isBackgroundDark = false;
            if (rgb && rgb.length >= 3) {
                const luminance = (0.299 * parseInt(rgb[0]) + 0.587 * parseInt(rgb[1]) + 0.114 * parseInt(rgb[2])) / 255;
                isBackgroundDark = luminance < 0.5;
            }

            setIsDark(prefersDark || hasDarkClass || hasDarkAttribute || isBackgroundDark);
        };

        checkDarkMode();

        // Listen for system preference changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', checkDarkMode);

        // Observe DOM changes for class/attribute changes
        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
        observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });

        return () => {
            mediaQuery.removeEventListener('change', checkDarkMode);
            observer.disconnect();
        };
    }, []);

    return isDark;
}
