# Testing with Vitest

This project now uses [Vitest](https://vitest.dev/) for unit testing, providing a fast and modern testing experience with excellent TypeScript support.

## Available Test Scripts

- `npm run test:unit` - Run all unit tests once
- `npm run test:unit:watch` - Run tests in watch mode (reruns when files change)
- `npm run test:unit:ui` - Open the Vitest UI for interactive testing
- `npm test` - Run the full test suite (lint, format check, build, package, grammar tests, and unit tests)

## Test Structure

### Unit Tests
- Located in `tests/` directory
- Use `.test.ts` or `.spec.ts` suffix
- Written using Vitest's `describe`, `it`, and `expect` APIs

### Current Tests
- `tests/errorParser.test.ts` - Tests for WIT error parsing functionality

## Writing Tests

```typescript
import { describe, it, expect } from 'vitest';
import { yourFunction } from '../src/yourModule';

describe('Your Module', () => {
    it('should do something', () => {
        const result = yourFunction('input');
        expect(result).toBe('expected output');
    });
});
```

## Error Parser Tests

The `errorParser.test.ts` file contains comprehensive tests for the WIT error parsing regex, including:

- Extraction from real WIT error stacks
- Handling invalid/malformed stacks
- Edge cases with large line/column numbers
- Different file path formats
- Stacks with and without "Caused by" sections

## Configuration

The Vitest configuration is in `vitest.config.ts` and includes:
- TypeScript support out of the box
- Node.js environment
- Path aliases for cleaner imports
- Automatic file discovery for tests

## VS Code Integration

Vitest works great with VS Code. You can:
1. Install the [Vitest extension](https://marketplace.visualstudio.com/items?itemName=ZixuanChen.vitest-explorer)
2. Run tests directly from the editor
3. See test results inline
4. Debug tests with breakpoints
