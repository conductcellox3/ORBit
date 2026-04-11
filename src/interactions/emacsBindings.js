import { appSettings } from '../core/settings.js';

/**
 * Handles Emacs-lite shortcuts for plain text contentEditable environments.
 */
export function handleEmacsKeydown(e, element) {
    if (!appSettings.getEmacsEditingEnabled()) return false;
    
    // Safe guard during Japanese IME composition
    if (e.isComposing || e.keyCode === 229) return false;

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;

    // Movement (Ctrl: A, E, F, B, N, P | Alt: F, B)
    if (!e.shiftKey && !e.altKey && e.ctrlKey) {
        switch (e.key.toLowerCase()) {
            case 'a':
                e.preventDefault();
                e.stopPropagation();
                sel.modify('move', 'backward', 'lineboundary');
                return true;
            case 'e':
                e.preventDefault();
                e.stopPropagation();
                sel.modify('move', 'forward', 'lineboundary');
                return true;
            case 'f':
                e.preventDefault();
                e.stopPropagation();
                sel.modify('move', 'forward', 'character');
                return true;
            case 'b':
                e.preventDefault();
                e.stopPropagation();
                sel.modify('move', 'backward', 'character');
                return true;
            case 'n':
                e.preventDefault();
                e.stopPropagation();
                sel.modify('move', 'forward', 'line');
                return true;
            case 'p':
                e.preventDefault();
                e.stopPropagation();
                sel.modify('move', 'backward', 'line');
                return true;
        }
    }

    if (!e.shiftKey && !e.ctrlKey && e.altKey) {
        switch (e.key.toLowerCase()) {
            case 'f':
                e.preventDefault();
                e.stopPropagation();
                sel.modify('move', 'forward', 'word');
                return true;
            case 'b':
                e.preventDefault();
                e.stopPropagation();
                sel.modify('move', 'backward', 'word');
                return true;
        }
    }

    // Deletion (Ctrl: D, H, K | Alt: D, Backspace)
    if (!e.shiftKey && !e.altKey && e.ctrlKey) {
        switch (e.key.toLowerCase()) {
            case 'd':
                e.preventDefault();
                e.stopPropagation();
                document.execCommand('forwardDelete', false, null);
                return true;
            case 'h':
                e.preventDefault();
                e.stopPropagation();
                document.execCommand('delete', false, null);
                return true;
            case 'k':
                if (killLineNative(sel)) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                return true;
        }
    }

    if (!e.shiftKey && !e.ctrlKey && e.altKey) {
        switch (e.key.toLowerCase()) {
            case 'd':
                e.preventDefault();
                e.stopPropagation();
                sel.modify('extend', 'forward', 'word');
                document.execCommand('forwardDelete', false, null);
                return true;
            case 'backspace':
                e.preventDefault();
                e.stopPropagation();
                sel.modify('extend', 'backward', 'word');
                document.execCommand('delete', false, null);
                return true;
        }
    }

    return false;
}

/**
 * Native kill line logic that correctly merges blocks AND preserves the Browser's Undo stack (Ctrl+Z).
 */
function killLineNative(selection) {
    // If text is explicitly highlighted by the user, just delete it.
    if (!selection.isCollapsed) {
        document.execCommand('forwardDelete', false, null);
        return true;
    }

    // 1. Try extending to the end of the visual line natively.
    selection.modify('extend', 'forward', 'lineboundary');

    if (!selection.isCollapsed) {
        // We successfully grabbed text up to the end of the current line.
        document.execCommand('forwardDelete', false, null);
        return true;
    }

    // 2. We were already at the end of the line!
    // Simply natively forwardDelete to chew the newline/block-boundary and join lines natively.
    document.execCommand('forwardDelete', false, null);
    return true;
}
