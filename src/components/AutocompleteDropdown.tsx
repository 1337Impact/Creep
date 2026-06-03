import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { COMMANDS, Command } from '../commands';
import { cn } from '../utils';

interface AutocompleteDropdownProps {
    inputValue: string;
    onSelect: (command: Command) => void;
    onClose: () => void;
}

export interface AutocompleteDropdownHandle {
    handleKeyDown: (e: React.KeyboardEvent) => boolean;
    hasMatches: boolean;
}

const AutocompleteDropdown = forwardRef<AutocompleteDropdownHandle, AutocompleteDropdownProps>(({
    inputValue,
    onSelect,
    onClose: _onClose,
}, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [filteredCommands, setFilteredCommands] = useState<Command[]>([]);

    useEffect(() => {
        if (inputValue.startsWith('/')) {
            const search = inputValue.toLowerCase();
            const filtered = COMMANDS.filter(c => c.id.startsWith(search));
            setFilteredCommands(filtered);
            setSelectedIndex(0);
        } else {
            setFilteredCommands([]);
        }
    }, [inputValue]);

    const hasMatches = filteredCommands.length > 0;

    useImperativeHandle(ref, () => ({
        hasMatches,
        handleKeyDown: (e: React.KeyboardEvent): boolean => {
            if (!hasMatches) return false;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
                return true;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
                return true;
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                if (filteredCommands[selectedIndex]) {
                    onSelect(filteredCommands[selectedIndex]);
                }
                return true;
            } else if (e.key === 'Escape') {
                // onClose();
                setFilteredCommands([]); // Hide
                return true;
            }
            return false;
        }
    }));

    if (!hasMatches) return null;

    return (
        <div className={cn(
            "absolute z-[10002] bottom-full left-0 w-full mb-2 rounded-lg shadow-xl overflow-hidden text-sm bg-gray-800 border border-gray-700"
        )}>
            {filteredCommands.map((cmd, idx) => (
                <div
                    key={cmd.id}
                    onClick={() => onSelect(cmd)}
                    className={cn(
                        "w-full text-left px-3 py-2 flex flex-col transition-colors cursor-pointer",
                        idx === selectedIndex ? "bg-blue-900/50 text-blue-400" : "hover:bg-gray-700"
                    )}
                    role="button"
                >
                    <span className="font-medium">{cmd.id}</span>
                    <span className={cn("text-xs mt-1 text-gray-500")}>{cmd.description}</span>
                </div>
            ))}
        </div>
    );
});

AutocompleteDropdown.displayName = 'AutocompleteDropdown';

export default AutocompleteDropdown;
