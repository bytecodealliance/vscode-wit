/**
 * Utility functions for parsing WIT validation errors
 */

/**
 * Regex patterns to extract error information from WIT validation errors
 */

/**
 * Pattern for errors with file location information
 * Groups: 1=main error, 2=detailed error, 3=file path, 4=row, 5=column
 */
const witErrorWithLocationRegex =
    /Error:\s*([^\n]+)(?:\n\nCaused by:\s*\n\s*([^\n]+(?:\n[^\n-]+)*?))?[\s\S]*?-->\s*([^:]+):(\d+):(\d+)/;

/**
 * Pattern for errors without file location information
 * Groups: 1=main error
 */
const witErrorWithoutLocationRegex = /Error:\s*([^\n]+)/;

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
    // First try to match errors with file location
    let match = errorStack.match(witErrorWithLocationRegex);

    if (match) {
        const [, mainError, detailedError, filePath, rowStr, columnStr] = match;
        return {
            mainError: mainError.trim(),
            detailedError: detailedError?.trim(),
            filePath: filePath.trim(),
            row: parseInt(rowStr, 10),
            column: parseInt(columnStr, 10),
        };
    }

    // If no location match, try simple error format
    match = errorStack.match(witErrorWithoutLocationRegex);

    if (match) {
        const [, mainError] = match;
        return {
            mainError: mainError.trim(),
            detailedError: undefined,
            filePath: undefined,
            row: undefined,
            column: undefined,
        };
    }

    return null;
}
