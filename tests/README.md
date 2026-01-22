# Window Maximizer - Unit Tests

## Overview

This directory contains a simple unit test framework for the Window Maximizer FoundryVTT module. The tests verify core functionality of `WindowStateRegistry` and layout calculations without requiring a full FoundryVTT environment.

## Files

- `window-maximizer.test.js` - Main test suite with TestRunner class and all test cases
- `test-runner.html` - Standalone HTML test runner for running tests in a browser
- `README.md` - This file

## Running Tests

### Method 1: Standalone HTML Runner (Recommended for Local Testing)

1. Open `test-runner.html` in a web browser
2. Click "Run All Tests" or individual test suite buttons
3. View detailed results with pass/fail status

### Method 2: FoundryVTT Console

1. Load FoundryVTT with the Window Maximizer module enabled
2. Open browser console (F12)
3. Run tests:

```javascript
// Run all tests
await window.windowMaximizerTests.runAllTests()

// Run individual test suites
await window.windowMaximizerTests.runRegistryTests()
await window.windowMaximizerTests.runLayoutTests()
await window.windowMaximizerTests.runIntegrationTests()

// Quick test (minimal output)
await window.windowMaximizerTests.runQuickTests()
```

### Method 3: Node.js (for CI/CD)

```bash
# Using Node.js (requires ES module support)
node tests/window-maximizer.test.js
```

## Test Suites

### WindowStateRegistry Tests (`testWindowStateRegistry`)

Tests the core window state registry functionality:

- `getState` returns null for unknown apps
- `registerSnap` and `getState` work correctly
- `markClosed`/`markOpen` update state correctly
- `removeState` deletes states
- `hasSnappedWindows` returns correct status
- `getSnappedCount` returns accurate count
- `getOpenSnappedCount` and `getClosedSnappedCount` track correctly
- `getAllStatesArray` returns all states
- `clearAll` removes all states
- `getAppKey` handles different app ID types
- `extractDocumentInfo` handles apps with/without documents

### Layout Calculations Tests (`testLayoutCalculations`)

Tests zone rectangle calculations for different layouts:

- Full screen zone on 1920x1080
- Quarter screen zones (2x2 grid)
- 2-column split zones (left/right)
- Different screen sizes (1280x720)
- Invalid layout/zone handling
- Layout availability based on screen size
- Zone position verification (no overlaps, boundary checks)

### Integration Tests (`testSnapLayouterIntegration`)

Tests higher-level functionality:

- SnapLayouter initialization
- Zone position boundary checks
- Calculation consistency
- Area verification (zones sum to full screen)

## Test Framework

The test framework includes:

### TestRunner Class

```javascript
const runner = new TestRunner();
runner.test('test name', async () => {
    // Test code here
});
await runner.run();
```

### Assertion Helpers

- `assert(condition, message)` - Basic assertion
- `assertEqual(actual, expected, message)` - Strict equality check
- `assertDeepEqual(actual, expected, message)` - Deep equality for objects
- `assertNull(value, message)` - Check for null/undefined
- `assertNotNull(value, message)` - Check for non-null values
- `assertThrows(fn, message)` - Verify function throws error

## Mock Classes

### MockSnapLayouter

Simplified `SnapLayouter` implementation for testing layout calculations:

```javascript
const layouter = new MockSnapLayouter(screenWidth, screenHeight);
const rect = layouter.calculateZoneRect('grid-2x2', 'tl');
```

### WindowStateRegistry (Inline)

Full `WindowStateRegistry` implementation included inline for standalone testing.

## Adding New Tests

To add new tests, edit `window-maximizer.test.js`:

```javascript
// In testWindowStateRegistry() or testLayoutCalculations()
runner.test('your test name', () => {
    // Setup
    const registry = new WindowStateRegistry();

    // Execute
    registry.registerSnap(mockApp, position, zoneInfo);

    // Assert
    const result = registry.getState(mockApp);
    assertNotNull(result, 'Should return state');
    assertEqual(result.originalPosition.left, 100, 'Position should match');
});
```

## Test Output

### Successful Test Run

```
=== Window Maximizer Test Suite ===

--- Running WindowStateRegistry Tests ---
✓ getState returns null for unknown app
✓ registerSnap and getState work correctly
✓ markClosed sets isOpen to false
...

--- Running Layout Calculations Tests ---
✓ calculateZoneRect returns full screen for 1920x1080
✓ calculateZoneRect returns quarter screen for 2x2 grid top-left
...

--- Final Test Summary ---
✓ All 35 tests passed! (100.0%)
```

### Failed Test Run

```
✗ Some test name
Error: Expected 100, got 200

Failed tests:
  - Registry: Some test name
  - Layout: Other test name
```

## Troubleshooting

### Tests Not Loading in FoundryVTT

If tests don't appear in console:

1. Check browser console for JavaScript errors
2. Verify module is enabled in FoundryVTT
3. Try loading test file manually:

```javascript
const script = document.createElement('script');
script.src = '/modules/window-maximizer/tests/window-maximizer.test.js';
document.head.appendChild(script);
```

### HTML Runner Not Working

1. Ensure `window-maximizer.test.js` is in the same directory as `test-runner.html`
2. Check browser console for errors (F12)
3. Try a different browser (Chrome/Firefox recommended)

## Future Enhancements

Potential improvements to the test framework:

- [ ] Add code coverage tracking
- [ ] Implement test mocking for DOM APIs
- [ ] Add visual regression tests for overlay rendering
- [ ] Create performance benchmarks
- [ ] Add CI/CD integration (GitHub Actions)
- [ ] Test against multiple FoundryVTT versions
- [ ] Add E2E tests with Playwright/Puppeteer

## License

Same license as the Window Maximizer module.
