/**
 * Utility functions for parsing WIT validation errors
 */

/**
 * Regex pattern to extract error information from WIT validation errors
 * Groups:
 * 1. Main error message (after "Error: ")
 * 2. Detailed error message (after "Caused by:")
 * 3. File path (from the arrow line)
 * 4. Row number
 * 5. Column number
 */
const witErrorRegex =
    /Error:\s*([^\n]+)(?:\n\nCaused by:\s*\n\s*([^\n]+(?:\n[^\n-]+)*?))?[\s\S]*?-->\s*([^:]+):(\d+):(\d+)/;

/**
 * Extracts error information from a WIT validation error stack trace
 * @param errorStack - The error stack trace string
 * @returns Object containing extracted error information or null if no match
 */
export function extractErrorInfo(errorStack: string): {
    mainError?: string;
    detailedError?: string;
    filePath?: string;
    row?: number;
    column?: number;
} | null {
    const match = errorStack.match(witErrorRegex);

    if (!match) {
        return null;
    }

    const [, mainError, detailedError, filePath, rowStr, columnStr] = match;

    return {
        mainError: mainError.trim(),
        detailedError: detailedError?.trim(),
        filePath: filePath.trim(),
        row: parseInt(rowStr, 10),
        column: parseInt(columnStr, 10),
    };
}
