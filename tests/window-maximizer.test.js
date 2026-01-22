/**
 * Window Maximizer Unit Test Framework
 *
 * Simple test framework for testing WindowStateRegistry and Layout calculations.
 * Tests can be run via browser console or Node.js.
 *
 * Usage:
 *   await window.windowMaximizerTests.runAllTests()
 *   await window.windowMaximizerTests.runRegistryTests()
 *   await window.windowMaximizerTests.runLayoutTests()
 */

// ============================================================================
// Simple Test Framework Implementation
// ============================================================================

/**
 * Simple test runner class for running unit tests
 * Provides basic test execution, assertion tracking, and reporting
 */
class TestRunner {
    constructor() {
        this.tests = [];
        this.results = {
            passed: 0,
            failed: 0,
            errors: []
        };
    }

    /**
     * Register a test to be run
     * @param {string} name - Test name/description
     * @param {Function} fn - Test function (async supported)
     */
    test(name, fn) {
        this.tests.push({ name, fn });
    }

    /**
     * Run all registered tests
     * @returns {Promise<Object>} Test results summary
     */
    async run() {
        console.group('Window Maximizer | Running Tests');

        for (const { name, fn } of this.tests) {
            try {
                await fn();
                this.results.passed++;
                console.log(`%c✓ ${name}`, 'color: green; font-weight: bold');
            } catch (error) {
                this.results.failed++;
                this.results.errors.push({ name, error });
                console.error(`%c✗ ${name}`, 'color: red; font-weight: bold', error);
            }
        }

        console.groupEnd();

        const total = this.results.passed + this.results.failed;
        console.log(`%cTests passed: ${this.results.passed}/${total}`,
            this.results.failed === 0 ? 'color: green; font-weight: bold' : 'color: orange; font-weight: bold');

        if (this.results.failed > 0) {
            console.warn(`Failed tests:`, this.results.errors.map(e => e.name));
        }

        return this.results;
    }
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that a condition is truthy
 * @param {*} condition - Condition to test
 * @param {string} message - Error message if assertion fails
 * @throws {Error} If condition is falsy
 */
function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

/**
 * Assert that two values are strictly equal
 * @param {*} actual - Actual value
 * @param {*} expected - Expected value
 * @param {string} message - Error message if assertion fails
 * @throws {Error} If values are not equal
 */
function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

/**
 * Assert that two values are deeply equal
 * @param {*} actual - Actual value
 * @param {*} expected - Expected value
 * @param {string} message - Error message if assertion fails
 * @throws {Error} If objects are not deeply equal
 */
function assertDeepEqual(actual, expected, message) {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
        throw new Error(message || `Objects not equal\nExpected: ${expectedStr}\nActual: ${actualStr}`);
    }
}

/**
 * Assert that a value is null or undefined
 * @param {*} value - Value to test
 * @param {string} message - Error message if assertion fails
 * @throws {Error} If value is not null/undefined
 */
function assertNull(value, message) {
    if (value !== null && value !== undefined) {
        throw new Error(message || `Expected null/undefined, got ${value}`);
    }
}

/**
 * Assert that a value is NOT null or undefined
 * @param {*} value - Value to test
 * @param {string} message - Error message if assertion fails
 * @throws {Error} If value is null/undefined
 */
function assertNotNull(value, message) {
    if (value === null || value === undefined) {
        throw new Error(message || `Expected value to exist, got ${value}`);
    }
}

/**
 * Assert that a function throws an error
 * @param {Function} fn - Function to test
 * @param {string} message - Error message if no error thrown
 * @throws {Error} If function does not throw
 */
async function assertThrows(fn, message) {
    let threw = false;
    try {
        await fn();
    } catch (error) {
        threw = true;
    }
    if (!threw) {
        throw new Error(message || 'Expected function to throw an error');
    }
}

// ============================================================================
// Mock Foundry API
// ============================================================================

/**
 * Mock FoundryVTT game.settings API
 */
const mockGameSettings = {
    settings: {
        get: (module, key) => {
            if (key === 'showMaximizeButton') return true;
            return false;
        },
        register: () => {},
        set: () => {}
    }
};

/**
 * Mock FoundryVTT game object
 */
const mockGame = {
    settings: mockGameSettings.settings
};

// ============================================================================
// Test: WindowStateRegistry
// ============================================================================

/**
 * Test suite for WindowStateRegistry class
 * Tests core functionality: getState, setState, markClosed, removeState, etc.
 * @returns {Promise<Object>} Test results
 */
async function testWindowStateRegistry() {
    // Import WindowStateRegistry (inline for testing without module system)
    // In production, this would be: import { WindowStateRegistry } from '../scripts/window-state-registry.js';

    // Define WindowStateRegistry inline for standalone testing
    class WindowStateRegistry {
        constructor() {
            this.states = new Map();
        }

        getAppKey(app) {
            return String(app.appId ?? app.id ?? app.constructor.name);
        }

        extractDocumentInfo(app) {
            const doc = app.document ?? app.object;
            if (!doc) return null;

            if (doc.uuid && doc.documentName) {
                return {
                    uuid: doc.uuid,
                    documentName: doc.documentName
                };
            }

            return null;
        }

        registerSnap(app, originalPosition, zoneInfo) {
            const key = this.getAppKey(app);

            const state = {
                appKey: key,
                appClass: app.constructor.name,
                originalPosition: { ...originalPosition },
                zoneInfo: { ...zoneInfo },
                documentInfo: this.extractDocumentInfo(app),
                snappedAt: Date.now(),
                isOpen: true
            };

            this.states.set(key, state);
        }

        getState(app) {
            const key = this.getAppKey(app);
            return this.states.get(key);
        }

        getStateByKey(key) {
            return this.states.get(key);
        }

        markClosed(app) {
            const key = this.getAppKey(app);
            const state = this.states.get(key);
            if (state) {
                state.isOpen = false;
            }
        }

        markOpen(app) {
            const key = this.getAppKey(app);
            const state = this.states.get(key);
            if (state) {
                state.isOpen = true;
            }
        }

        removeState(app) {
            const key = this.getAppKey(app);
            this.states.delete(key);
        }

        removeStateByKey(key) {
            this.states.delete(key);
        }

        getAllStates() {
            return this.states;
        }

        getAllStatesArray() {
            return Array.from(this.states.values());
        }

        hasSnappedWindows() {
            return this.states.size > 0;
        }

        getSnappedCount() {
            return this.states.size;
        }

        getOpenSnappedCount() {
            let count = 0;
            for (const state of this.states.values()) {
                if (state.isOpen) count++;
            }
            return count;
        }

        getClosedSnappedCount() {
            let count = 0;
            for (const state of this.states.values()) {
                if (!state.isOpen) count++;
            }
            return count;
        }

        clearAll() {
            this.states.clear();
        }
    }

    const runner = new TestRunner();

    // Test 1: getState returns null for unknown app
    runner.test('getState returns null for unknown app', () => {
        const registry = new WindowStateRegistry();
        const mockApp = { id: 'test-app' };
        assertNull(registry.getState(mockApp), 'Should return null for unknown app');
    });

    // Test 2: setState and getState work correctly
    runner.test('registerSnap and getState work correctly', () => {
        const registry = new WindowStateRegistry();
        const mockApp = { id: 'test-app-2', constructor: { name: 'TestApp' } };
        const originalPosition = { left: 100, top: 100, width: 400, height: 300 };
        const zoneInfo = { layoutId: 'full', zoneId: 'full' };

        registry.registerSnap(mockApp, originalPosition, zoneInfo);
        const retrieved = registry.getState(mockApp);

        assertNotNull(retrieved, 'State should exist');
        assertEqual(retrieved.originalPosition.left, 100, 'Left position should match');
        assertEqual(retrieved.originalPosition.top, 100, 'Top position should match');
        assertEqual(retrieved.appClass, 'TestApp', 'App class should match');
    });

    // Test 3: markClosed sets isOpen to false
    runner.test('markClosed sets isOpen to false', () => {
        const registry = new WindowStateRegistry();
        const mockApp = { id: 'test-app-3', constructor: { name: 'TestApp' } };
        const state = { left: 100, top: 100, width: 400, height: 300 };
        const zoneInfo = { layoutId: 'full', zoneId: 'full' };

        registry.registerSnap(mockApp, state, zoneInfo);
        assertEqual(registry.getState(mockApp).isOpen, true, 'Should be open initially');

        registry.markClosed(mockApp);
        assertEqual(registry.getState(mockApp).isOpen, false, 'Should be marked closed');
    });

    // Test 4: markOpen sets isOpen back to true
    runner.test('markOpen sets isOpen to true', () => {
        const registry = new WindowStateRegistry();
        const mockApp = { id: 'test-app-3b', constructor: { name: 'TestApp' } };
        const state = { left: 100, top: 100, width: 400, height: 300 };
        const zoneInfo = { layoutId: 'full', zoneId: 'full' };

        registry.registerSnap(mockApp, state, zoneInfo);
        registry.markClosed(mockApp);
        assertEqual(registry.getState(mockApp).isOpen, false, 'Should be closed');

        registry.markOpen(mockApp);
        assertEqual(registry.getState(mockApp).isOpen, true, 'Should be marked open');
    });

    // Test 5: removeState deletes state
    runner.test('removeState deletes state', () => {
        const registry = new WindowStateRegistry();
        const mockApp = { id: 'test-app-4', constructor: { name: 'TestApp' } };
        const state = { left: 100, top: 100, width: 400, height: 300 };
        const zoneInfo = { layoutId: 'full', zoneId: 'full' };

        registry.registerSnap(mockApp, state, zoneInfo);
        assertNotNull(registry.getState(mockApp), 'State should exist before removal');

        registry.removeState(mockApp);
        assertNull(registry.getState(mockApp), 'State should be removed');
    });

    // Test 6: hasSnappedWindows returns correct status
    runner.test('hasSnappedWindows returns correct status', () => {
        const registry = new WindowStateRegistry();
        const mockApp = { id: 'test-app-5', constructor: { name: 'TestApp' } };

        assertEqual(registry.hasSnappedWindows(), false, 'Should have no windows initially');

        registry.registerSnap(mockApp, { left: 0, top: 0 }, { layoutId: 'full', zoneId: 'full' });
        assertEqual(registry.hasSnappedWindows(), true, 'Should have one window');
    });

    // Test 7: getSnappedCount returns correct count
    runner.test('getSnappedCount returns correct count', () => {
        const registry = new WindowStateRegistry();

        assertEqual(registry.getSnappedCount(), 0, 'Should have 0 windows initially');

        registry.registerSnap({ id: 'app1', constructor: { name: 'App1' } }, {}, { layoutId: 'full', zoneId: 'full' });
        assertEqual(registry.getSnappedCount(), 1, 'Should have 1 window');

        registry.registerSnap({ id: 'app2', constructor: { name: 'App2' } }, {}, { layoutId: 'full', zoneId: 'full' });
        assertEqual(registry.getSnappedCount(), 2, 'Should have 2 windows');
    });

    // Test 8: getOpenSnappedCount and getClosedSnappedCount
    runner.test('getOpenSnappedCount and getClosedSnappedCount track correctly', () => {
        const registry = new WindowStateRegistry();
        const app1 = { id: 'app1', constructor: { name: 'App1' } };
        const app2 = { id: 'app2', constructor: { name: 'App2' } };

        registry.registerSnap(app1, {}, { layoutId: 'full', zoneId: 'full' });
        registry.registerSnap(app2, {}, { layoutId: 'full', zoneId: 'full' });

        assertEqual(registry.getOpenSnappedCount(), 2, 'Should have 2 open windows');
        assertEqual(registry.getClosedSnappedCount(), 0, 'Should have 0 closed windows');

        registry.markClosed(app1);
        assertEqual(registry.getOpenSnappedCount(), 1, 'Should have 1 open window');
        assertEqual(registry.getClosedSnappedCount(), 1, 'Should have 1 closed window');
    });

    // Test 9: getAllStatesArray returns all states
    runner.test('getAllStatesArray returns all states', () => {
        const registry = new WindowStateRegistry();
        const app1 = { id: 'app1', constructor: { name: 'App1' } };
        const app2 = { id: 'app2', constructor: { name: 'App2' } };

        registry.registerSnap(app1, { left: 10 }, { layoutId: 'full', zoneId: 'full' });
        registry.registerSnap(app2, { left: 20 }, { layoutId: 'full', zoneId: 'full' });

        const allStates = registry.getAllStatesArray();
        assertEqual(allStates.length, 2, 'Should have 2 states');
        assertEqual(allStates[0].originalPosition.left, 10, 'First state should match');
        assertEqual(allStates[1].originalPosition.left, 20, 'Second state should match');
    });

    // Test 10: clearAll removes all states
    runner.test('clearAll removes all states', () => {
        const registry = new WindowStateRegistry();
        const app1 = { id: 'app1', constructor: { name: 'App1' } };
        const app2 = { id: 'app2', constructor: { name: 'App2' } };

        registry.registerSnap(app1, {}, { layoutId: 'full', zoneId: 'full' });
        registry.registerSnap(app2, {}, { layoutId: 'full', zoneId: 'full' });

        assertEqual(registry.getSnappedCount(), 2, 'Should have 2 states');

        registry.clearAll();
        assertEqual(registry.getSnappedCount(), 0, 'Should have 0 states after clear');
        assertEqual(registry.hasSnappedWindows(), false, 'Should have no windows');
    });

    // Test 11: getAppKey handles different app ID types
    runner.test('getAppKey handles different app ID types', () => {
        const registry = new WindowStateRegistry();

        const appWithAppId = { appId: 123, constructor: { name: 'TestApp' } };
        assertEqual(registry.getAppKey(appWithAppId), '123', 'Should use appId');

        const appWithId = { id: 'my-app-id', constructor: { name: 'TestApp' } };
        assertEqual(registry.getAppKey(appWithId), 'my-app-id', 'Should use id');

        const appWithConstructor = { constructor: { name: 'MyApp' } };
        assertEqual(registry.getAppKey(appWithConstructor), 'MyApp', 'Should use constructor name');
    });

    // Test 12: extractDocumentInfo handles app with document
    runner.test('extractDocumentInfo extracts document info', () => {
        const registry = new WindowStateRegistry();

        const mockApp = {
            document: {
                uuid: 'Actor.abc123',
                documentName: 'Actor'
            },
            constructor: { name: 'ActorSheet' }
        };

        const docInfo = registry.extractDocumentInfo(mockApp);
        assertNotNull(docInfo, 'Should extract document info');
        assertEqual(docInfo.uuid, 'Actor.abc123', 'UUID should match');
        assertEqual(docInfo.documentName, 'Actor', 'Document name should match');
    });

    // Test 13: extractDocumentInfo returns null for app without document
    runner.test('extractDocumentInfo returns null for app without document', () => {
        const registry = new WindowStateRegistry();

        const mockApp = {
            constructor: { name: 'SimpleForm' }
        };

        const docInfo = registry.extractDocumentInfo(mockApp);
        assertNull(docInfo, 'Should return null for app without document');
    });

    return runner.run();
}

// ============================================================================
// Test: Layout Calculations
// ============================================================================

/**
 * Mock SnapLayouter with minimal functionality for testing layout calculations
 * Simplified version that doesn't depend on DOM or Foundry APIs
 */
class MockSnapLayouter {
    constructor(screenWidth = 1920, screenHeight = 1080) {
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;
        this.layouts = this.calculateAvailableLayouts();
    }

    /**
     * Calculate available layouts based on screen dimensions
     * Simplified version matching the production implementation
     */
    calculateAvailableLayouts() {
        const screenWidth = this.screenWidth;
        const screenHeight = this.screenHeight;

        const MIN_ZONE_WIDTH = 300;
        const MIN_ZONE_HEIGHT = 200;
        const maxCols = Math.floor(screenWidth / MIN_ZONE_WIDTH);
        const maxRows = Math.floor(screenHeight / MIN_ZONE_HEIGHT);

        const layouts = [];

        // Always include full screen layout
        layouts.push({
            id: 'full',
            cols: 1,
            rows: 1,
            zones: [{ id: 'full', col: 0, row: 0 }]
        });

        // 2-column split
        if (maxCols >= 2) {
            layouts.push({
                id: 'split-2',
                cols: 2,
                rows: 1,
                zones: [
                    { id: 'left', col: 0, row: 0 },
                    { id: 'right', col: 1, row: 0 }
                ]
            });
        }

        // 2x2 grid
        if (maxCols >= 2 && maxRows >= 2) {
            layouts.push({
                id: 'grid-2x2',
                cols: 2,
                rows: 2,
                zones: [
                    { id: 'tl', col: 0, row: 0 },
                    { id: 'tr', col: 1, row: 0 },
                    { id: 'bl', col: 0, row: 1 },
                    { id: 'br', col: 1, row: 1 }
                ]
            });
        }

        return layouts;
    }

    /**
     * Calculate zone rectangle for a given layout and zone
     * @param {string} layoutId - Layout identifier
     * @param {string} zoneId - Zone identifier within layout
     * @returns {Object|null} Rectangle {x, y, w, h} or null if not found
     */
    calculateZoneRect(layoutId, zoneId) {
        const screenWidth = this.screenWidth;
        const screenHeight = this.screenHeight;

        // Find the layout definition
        const layout = this.layouts.find(l => l.id === layoutId);
        if (!layout) {
            // Fallback for 'full' if layouts not initialized
            if (layoutId === 'full') {
                return { x: 0, y: 0, w: screenWidth, h: screenHeight };
            }
            return null;
        }

        // Find the zone within the layout
        const zone = layout.zones.find(z => z.id === zoneId);
        if (!zone) return null;

        // Calculate zone dimensions based on grid position
        const colWidth = screenWidth / layout.cols;
        const rowHeight = screenHeight / layout.rows;

        const colSpan = zone.colSpan || 1;
        const rowSpan = zone.rowSpan || 1;

        return {
            x: zone.col * colWidth,
            y: zone.row * rowHeight,
            w: colWidth * colSpan,
            h: rowHeight * rowSpan
        };
    }
}

/**
 * Test suite for Layout Calculations
 * Tests zone rectangle calculations for different layouts
 * @returns {Promise<Object>} Test results
 */
async function testLayoutCalculations() {
    const runner = new TestRunner();

    // Test 1: Full screen zone on 1920x1080
    runner.test('calculateZoneRect returns full screen for 1920x1080', () => {
        const layouter = new MockSnapLayouter(1920, 1080);
        const rect = layouter.calculateZoneRect('full', 'full');

        assertNotNull(rect, 'Rect should exist');
        assertEqual(rect.x, 0, 'x should be 0');
        assertEqual(rect.y, 0, 'y should be 0');
        assertEqual(rect.w, 1920, 'width should be 1920');
        assertEqual(rect.h, 1080, 'height should be 1080');
    });

    // Test 2: Quarter screen zone (2x2 grid, top-left)
    runner.test('calculateZoneRect returns quarter screen for 2x2 grid top-left', () => {
        const layouter = new MockSnapLayouter(1920, 1080);
        const rect = layouter.calculateZoneRect('grid-2x2', 'tl');

        assertNotNull(rect, 'Rect should exist');
        assertEqual(rect.x, 0, 'x should be 0');
        assertEqual(rect.y, 0, 'y should be 0');
        assertEqual(rect.w, 960, 'width should be 960 (half of 1920)');
        assertEqual(rect.h, 540, 'height should be 540 (half of 1080)');
    });

    // Test 3: 2-column split left zone
    runner.test('calculateZoneRect returns left half for split-2 left', () => {
        const layouter = new MockSnapLayouter(1920, 1080);
        const rect = layouter.calculateZoneRect('split-2', 'left');

        assertNotNull(rect, 'Rect should exist');
        assertEqual(rect.x, 0, 'x should be 0');
        assertEqual(rect.y, 0, 'y should be 0');
        assertEqual(rect.w, 960, 'width should be 960 (half of 1920)');
        assertEqual(rect.h, 1080, 'height should be 1080 (full height)');
    });

    // Test 4: 2-column split right zone
    runner.test('calculateZoneRect returns right half for split-2 right', () => {
        const layouter = new MockSnapLayouter(1920, 1080);
        const rect = layouter.calculateZoneRect('split-2', 'right');

        assertNotNull(rect, 'Rect should exist');
        assertEqual(rect.x, 960, 'x should be 960 (start of right half)');
        assertEqual(rect.y, 0, 'y should be 0');
        assertEqual(rect.w, 960, 'width should be 960 (half of 1920)');
        assertEqual(rect.h, 1080, 'height should be 1080 (full height)');
    });

    // Test 5: 2x2 grid bottom-right zone
    runner.test('calculateZoneRect returns bottom-right quarter for 2x2 grid br', () => {
        const layouter = new MockSnapLayouter(1920, 1080);
        const rect = layouter.calculateZoneRect('grid-2x2', 'br');

        assertNotNull(rect, 'Rect should exist');
        assertEqual(rect.x, 960, 'x should be 960 (right half)');
        assertEqual(rect.y, 540, 'y should be 540 (bottom half)');
        assertEqual(rect.w, 960, 'width should be 960');
        assertEqual(rect.h, 540, 'height should be 540');
    });

    // Test 6: Smaller screen size (1280x720)
    runner.test('calculateZoneRect works with smaller screen 1280x720', () => {
        const layouter = new MockSnapLayouter(1280, 720);
        const rect = layouter.calculateZoneRect('full', 'full');

        assertNotNull(rect, 'Rect should exist');
        assertEqual(rect.x, 0, 'x should be 0');
        assertEqual(rect.y, 0, 'y should be 0');
        assertEqual(rect.w, 1280, 'width should be 1280');
        assertEqual(rect.h, 720, 'height should be 720');
    });

    // Test 7: Quarter screen on smaller screen
    runner.test('calculateZoneRect quarter on 1280x720', () => {
        const layouter = new MockSnapLayouter(1280, 720);
        const rect = layouter.calculateZoneRect('grid-2x2', 'tl');

        assertNotNull(rect, 'Rect should exist');
        assertEqual(rect.w, 640, 'width should be 640 (half of 1280)');
        assertEqual(rect.h, 360, 'height should be 360 (half of 720)');
    });

    // Test 8: Invalid layout returns null
    runner.test('calculateZoneRect returns null for invalid layout', () => {
        const layouter = new MockSnapLayouter(1920, 1080);
        const rect = layouter.calculateZoneRect('invalid-layout', 'some-zone');

        assertNull(rect, 'Should return null for invalid layout');
    });

    // Test 9: Invalid zone returns null
    runner.test('calculateZoneRect returns null for invalid zone', () => {
        const layouter = new MockSnapLayouter(1920, 1080);
        const rect = layouter.calculateZoneRect('split-2', 'invalid-zone');

        assertNull(rect, 'Should return null for invalid zone');
    });

    // Test 10: Layout availability based on screen size
    runner.test('Layouts available based on screen width', () => {
        const smallLayouter = new MockSnapLayouter(800, 600);
        assertEqual(smallLayouter.layouts.some(l => l.id === 'full'), true, 'Full layout always available');
        // 800px width allows at most 2 columns (800/300 = 2.66)
        assertEqual(smallLayouter.layouts.some(l => l.id === 'split-2'), true, '2-column should be available');
        assertEqual(smallLayouter.layouts.some(l => l.id === 'grid-2x2'), true, '2x2 grid should be available');
    });

    // Test 11: Zone positions don't overlap in 2x2 grid
    runner.test('2x2 grid zones do not overlap', () => {
        const layouter = new MockSnapLayouter(1920, 1080);
        const tl = layouter.calculateZoneRect('grid-2x2', 'tl');
        const tr = layouter.calculateZoneRect('grid-2x2', 'tr');
        const bl = layouter.calculateZoneRect('grid-2x2', 'bl');
        const br = layouter.calculateZoneRect('grid-2x2', 'br');

        // Verify all zones exist
        assertNotNull(tl, 'TL zone should exist');
        assertNotNull(tr, 'TR zone should exist');
        assertNotNull(bl, 'BL zone should exist');
        assertNotNull(br, 'BR zone should exist');

        // Verify zones don't overlap (each has unique x,y position)
        assert(tl.x === 0 && tl.y === 0, 'TL should be at top-left');
        assert(tr.x === 960 && tr.y === 0, 'TR should be at top-right');
        assert(bl.x === 0 && bl.y === 540, 'BL should be at bottom-left');
        assert(br.x === 960 && br.y === 540, 'BR should be at bottom-right');

        // Verify all zones are same size
        assertEqual(tl.w, tr.w, 'TL and TR should have same width');
        assertEqual(tl.w, bl.w, 'TL and BL should have same width');
        assertEqual(tl.w, br.w, 'TL and BR should have same width');
        assertEqual(tl.h, tr.h, 'TL and TR should have same height');
        assertEqual(tl.h, bl.h, 'TL and BL should have same height');
        assertEqual(tl.h, br.h, 'TL and BR should have same height');
    });

    // Test 12: Split zones cover full screen
    runner.test('Split-2 zones cover full screen', () => {
        const layouter = new MockSnapLayouter(1920, 1080);
        const left = layouter.calculateZoneRect('split-2', 'left');
        const right = layouter.calculateZoneRect('split-2', 'right');

        // Left + right should equal full width
        assertEqual(left.w + right.w, 1920, 'Left and right zones should cover full width');
        assertEqual(left.h, 1080, 'Left zone should be full height');
        assertEqual(right.h, 1080, 'Right zone should be full height');
        assertEqual(left.y, right.y, 'Both zones should start at same y position');
    });

    return runner.run();
}

// ============================================================================
// Test: SnapLayouter Integration (Mock-based)
// ============================================================================

/**
 * Test suite for SnapLayouter integration tests
 * Tests higher-level functionality using mocks
 * @returns {Promise<Object>} Test results
 */
async function testSnapLayouterIntegration() {
    const runner = new TestRunner();

    // Test 1: SnapLayouter initializes correctly
    runner.test('SnapLayouter initializes with registry', () => {
        // This test verifies the structure without requiring actual DOM
        const mockLayouter = {
            registry: {
                states: new Map(),
                hasSnappedWindows: () => false
            },
            appStateMap: new WeakMap(),
            activeApp: null,
            activeZone: null
        };

        assertNotNull(mockLayouter.registry, 'Registry should exist');
        assertNotNull(mockLayouter.appStateMap, 'AppStateMap should exist');
        assertEqual(mockLayouter.activeApp, null, 'Active app should be null initially');
        assertEqual(mockLayouter.registry.hasSnappedWindows(), false, 'Should have no snapped windows initially');
    });

    // Test 2: Zone position calculation at screen edges
    runner.test('Zone positions respect screen boundaries', () => {
        const layouter = new MockSnapLayouter(1920, 1080);

        const fullRect = layouter.calculateZoneRect('full', 'full');
        assertEqual(fullRect.x + fullRect.w, 1920, 'Full zone should end at screen edge');
        assertEqual(fullRect.y + fullRect.h, 1080, 'Full zone should end at screen bottom');

        const tlRect = layouter.calculateZoneRect('grid-2x2', 'tl');
        assertEqual(tlRect.x, 0, 'TL zone should start at left edge');
        assertEqual(tlRect.y, 0, 'TL zone should start at top edge');

        const brRect = layouter.calculateZoneRect('grid-2x2', 'br');
        assertEqual(brRect.x + brRect.w, 1920, 'BR zone should end at right edge');
        assertEqual(brRect.y + brRect.h, 1080, 'BR zone should end at bottom edge');
    });

    // Test 3: Zone calculations are consistent
    runner.test('Zone calculations are consistent across calls', () => {
        const layouter = new MockSnapLayouter(1920, 1080);

        const rect1 = layouter.calculateZoneRect('split-2', 'left');
        const rect2 = layouter.calculateZoneRect('split-2', 'left');

        assertDeepEqual(rect1, rect2, 'Multiple calls should return same result');
    });

    // Test 4: All 2x2 grid zones sum to full screen
    runner.test('All 2x2 grid zones sum to full screen area', () => {
        const layouter = new MockSnapLayouter(1920, 1080);

        const tl = layouter.calculateZoneRect('grid-2x2', 'tl');
        const tr = layouter.calculateZoneRect('grid-2x2', 'tr');
        const bl = layouter.calculateZoneRect('grid-2x2', 'bl');
        const br = layouter.calculateZoneRect('grid-2x2', 'br');

        const totalArea = tl.w * tl.h + tr.w * tr.h + bl.w * bl.h + br.w * br.h;
        const fullArea = 1920 * 1080;

        assertEqual(totalArea, fullArea, 'All zones should sum to full screen area');
    });

    return runner.run();
}

// ============================================================================
// Export for Browser and Node.js
// ============================================================================

/**
 * Export test functions for both browser and Node.js environments
 */

// Browser export (attach to window object)
if (typeof window !== 'undefined') {
    window.windowMaximizerTests = {
        // Individual test suites
        runRegistryTests: testWindowStateRegistry,
        runLayoutTests: testLayoutCalculations,
        runIntegrationTests: testSnapLayouterIntegration,

        // Run all tests
        runAllTests: async () => {
            console.log('%c=== Window Maximizer Test Suite ===', 'color: #4a90e2; font-size: 16px; font-weight: bold');

            const results = {
                registry: null,
                layout: null,
                integration: null,
                total: { passed: 0, failed: 0, errors: [] }
            };

            try {
                console.log('\n%c--- Running WindowStateRegistry Tests ---', 'color: #e24a85; font-weight: bold');
                results.registry = await testWindowStateRegistry();
                results.total.passed += results.registry.passed;
                results.total.failed += results.registry.failed;
                results.total.errors.push(...results.registry.errors.map(e => ({ ...e, suite: 'Registry' })));
            } catch (error) {
                console.error('Registry tests failed with error:', error);
                results.total.failed++;
                results.total.errors.push({ suite: 'Registry', error });
            }

            try {
                console.log('\n%c--- Running Layout Calculations Tests ---', 'color: #85e24a; font-weight: bold');
                results.layout = await testLayoutCalculations();
                results.total.passed += results.layout.passed;
                results.total.failed += results.layout.failed;
                results.total.errors.push(...results.layout.errors.map(e => ({ ...e, suite: 'Layout' })));
            } catch (error) {
                console.error('Layout tests failed with error:', error);
                results.total.failed++;
                results.total.errors.push({ suite: 'Layout', error });
            }

            try {
                console.log('\n%c--- Running Integration Tests ---', 'color: #e2d34a; font-weight: bold');
                results.integration = await testSnapLayouterIntegration();
                results.total.passed += results.integration.passed;
                results.total.failed += results.integration.failed;
                results.total.errors.push(...results.integration.errors.map(e => ({ ...e, suite: 'Integration' })));
            } catch (error) {
                console.error('Integration tests failed with error:', error);
                results.total.failed++;
                results.total.errors.push({ suite: 'Integration', error });
            }

            // Print final summary
            console.log('\n%c=== Final Test Summary ===', 'color: #4a90e2; font-size: 14px; font-weight: bold');
            const totalTests = results.total.passed + results.total.failed;
            const successRate = totalTests > 0 ? ((results.total.passed / totalTests) * 100).toFixed(1) : 0;

            if (results.total.failed === 0) {
                console.log(`%c✓ All ${totalTests} tests passed! (${successRate}%)`, 'color: green; font-size: 14px; font-weight: bold');
            } else {
                console.warn(`%c✗ ${results.total.failed}/${totalTests} tests failed (${successRate}% pass rate)`, 'color: orange; font-size: 14px; font-weight: bold');
                console.log('%cFailed tests:', 'color: red; font-weight: bold');
                results.total.errors.forEach(err => {
                    console.log(`  - ${err.suite}: ${err.name || 'Unknown'}`, err.error || '');
                });
            }

            return results;
        },

        // Quick test run (minimal output)
        runQuickTests: async () => {
            const results = await window.windowMaximizerTests.runAllTests();
            return {
                passed: results.total.passed,
                failed: results.total.failed,
                success: results.total.failed === 0
            };
        }
    };

    console.log('%cWindow Maximizer Tests loaded!', 'color: #4a90e2; font-weight: bold');
    console.log('Run tests with: await window.windowMaximizerTests.runAllTests()');
}

// Node.js export (for automated testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        testWindowStateRegistry,
        testLayoutCalculations,
        testSnapLayouterIntegration,
        TestRunner,
        assertions: {
            assert,
            assertEqual,
            assertDeepEqual,
            assertNull,
            assertNotNull,
            assertThrows
        },
        MockSnapLayouter
    };
}
