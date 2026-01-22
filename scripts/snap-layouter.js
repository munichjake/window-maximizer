import { WindowStateRegistry } from './window-state-registry.js';

// Debug logging system - conditional console logging for performance
// Uses FoundryVTT game setting for runtime configurability
function debugLog(...args) {
    // Safety check: ensure game and settings are available
    if (!game?.settings) return;

    try {
        if (game.settings.get('window-maximizer', 'debugMode')) {
            console.log('Window Maximizer |', ...args);
        }
    } catch (error) {
        // If setting doesn't exist yet, silently ignore (module initialization phase)
        // This prevents errors during module load before settings are registered
    }
}

// Minimum window size thresholds (in pixels)
const MIN_ZONE_WIDTH = 300;
const MIN_ZONE_HEIGHT = 200;

/**
 * PerformanceTracker - Optional performance metrics collection system
 * Tracks snap layout operations for performance analysis and optimization
 * Enables developers to identify bottlenecks and monitor system health
 */
class PerformanceTracker {
    constructor() {
        /**
         * Metrics collected by the tracker
         * @type {Object}
         * @property {number} dragCount - Total number of drag operations detected
         * @property {number} snapCount - Total number of successful snap operations
         * @property {number} restoreCount - Total number of restore operations
         * @property {number} overlayShowCount - Total number of overlay display operations
         * @property {number} totalDragTime - Accumulated time spent in drag operations (ms)
         * @property {number} averageDragTime - Average drag operation time (ms)
         * @property {number} lastReset - Timestamp when metrics were last reset
         */
        this.metrics = {
            dragCount: 0,
            snapCount: 0,
            restoreCount: 0,
            overlayShowCount: 0,
            totalDragTime: 0,
            averageDragTime: 0,
            lastReset: Date.now()
        };
        /**
         * Active timer storage for performance measurements
         * Maps timer IDs to their start timestamps
         * @type {Map<string, number>}
         */
        this.timings = new Map();
    }

    /**
     * Start a performance timer with the given identifier
     * @param {string} id - Unique identifier for this timer
     * @returns {boolean} - True if timer was started successfully
     */
    startTimer(id) {
        this.timings.set(id, performance.now());
        return true;
    }

    /**
     * End a performance timer and return the elapsed time
     * @param {string} id - Timer identifier to end
     * @returns {number} - Elapsed time in milliseconds, or 0 if timer not found
     */
    endTimer(id) {
        const start = this.timings.get(id);
        if (start) {
            const duration = performance.now() - start;
            this.timings.delete(id);
            return duration;
        }
        return 0;
    }

    /**
     * Record a drag operation with its duration
     * Updates drag count, total time, and calculates new average
     * @param {number} duration - Duration of the drag operation in milliseconds
     */
    recordDrag(duration) {
        this.metrics.dragCount++;
        this.metrics.totalDragTime += duration;
        this.metrics.averageDragTime = this.metrics.totalDragTime / this.metrics.dragCount;
    }

    /**
     * Record a successful snap operation
     * Increments the snap counter
     */
    recordSnap() {
        this.metrics.snapCount++;
    }

    /**
     * Record a restore operation
     * Increments the restore counter
     */
    recordRestore() {
        this.metrics.restoreCount++;
    }

    /**
     * Record an overlay display operation
     * Increments the overlay show counter
     */
    recordOverlayShow() {
        this.metrics.overlayShowCount++;
    }

    /**
     * Get current performance metrics including calculated uptime
     * @returns {Object} - Complete metrics object with uptime
     */
    getMetrics() {
        return {
            ...this.metrics,
            uptime: Date.now() - this.metrics.lastReset
        };
    }

    /**
     * Reset all metrics to initial values
     * Useful for starting fresh measurements or testing
     */
    reset() {
        this.metrics = {
            dragCount: 0,
            snapCount: 0,
            restoreCount: 0,
            overlayShowCount: 0,
            totalDragTime: 0,
            averageDragTime: 0,
            lastReset: Date.now()
        };
        this.timings.clear();
    }
}

/**
 * Calculate available layouts based on screen dimensions
 * @returns {Array<{id: string, class: string, cols: number, rows: number, zones: Array<{id: string, col: number, row: number, colSpan?: number, rowSpan?: number}>}>}
 */
function calculateAvailableLayouts() {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    // Calculate maximum columns and rows that fit with minimum zone sizes
    const maxCols = Math.floor(screenWidth / MIN_ZONE_WIDTH);
    const maxRows = Math.floor(screenHeight / MIN_ZONE_HEIGHT);

    const layouts = [];

    // Always include full screen layout
    layouts.push({
        id: 'full',
        label: 'Full Screen',
        class: 'layout-full',
        cols: 1,
        rows: 1,
        zones: [{ id: 'full', col: 0, row: 0 }]
    });

    // 2-column split (needs at least 2 columns)
    if (maxCols >= 2) {
        layouts.push({
            id: 'split-2',
            label: '2 Columns',
            class: 'layout-cols-2',
            cols: 2,
            rows: 1,
            zones: [
                { id: 'left', col: 0, row: 0 },
                { id: 'right', col: 1, row: 0 }
            ]
        });
    }

    // 3-column layout (needs larger screens for optimal usability)
    if (screenWidth >= 1400 && maxCols >= 3) {
        layouts.push({
            id: 'split-3',
            label: '3 Columns',
            class: 'layout-cols-3',
            cols: 3,
            rows: 1,
            zones: [
                { id: 'left', col: 0, row: 0 },
                { id: 'center', col: 1, row: 0 },
                { id: 'right', col: 2, row: 0 }
            ]
        });
    }

    // 4-column layout (requires ultrawide screens for practical use)
    if (screenWidth >= 2560 && maxCols >= 4) {
        layouts.push({
            id: 'split-4',
            label: '4 Columns',
            class: 'layout-cols-4',
            cols: 4,
            rows: 1,
            zones: [
                { id: 'col-0', col: 0, row: 0 },
                { id: 'col-1', col: 1, row: 0 },
                { id: 'col-2', col: 2, row: 0 },
                { id: 'col-3', col: 3, row: 0 }
            ]
        });
    }

    // 6-column layout (reserved for extreme ultrawide configurations)
    if (screenWidth >= 3840 && maxCols >= 6) {
        layouts.push({
            id: 'split-6',
            label: '6 Columns',
            class: 'layout-cols-6',
            cols: 6,
            rows: 1,
            zones: [
                { id: 'col-0', col: 0, row: 0 },
                { id: 'col-1', col: 1, row: 0 },
                { id: 'col-2', col: 2, row: 0 },
                { id: 'col-3', col: 3, row: 0 },
                { id: 'col-4', col: 4, row: 0 },
                { id: 'col-5', col: 5, row: 0 }
            ]
        });
    }

    // 2-row layout (vertical split)
    if (maxRows >= 2) {
        layouts.push({
            id: 'rows-2',
            label: '2 Rows',
            class: 'layout-rows-2',
            cols: 1,
            rows: 2,
            zones: [
                { id: 'top', col: 0, row: 0 },
                { id: 'bottom', col: 0, row: 1 }
            ]
        });
    }

    // 2x2 quarters
    if (maxCols >= 2 && maxRows >= 2) {
        layouts.push({
            id: 'grid-2x2',
            label: '2×2 Grid',
            class: 'layout-grid-2x2',
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

    // 4x2 grid (requires 4K displays for practical column widths)
    if (screenWidth >= 3200 && maxCols >= 4 && maxRows >= 2) {
        layouts.push({
            id: 'grid-4x2',
            label: '4×2 Grid',
            class: 'layout-grid-4x2',
            cols: 4,
            rows: 2,
            zones: [
                { id: 'r0c0', col: 0, row: 0 },
                { id: 'r0c1', col: 1, row: 0 },
                { id: 'r0c2', col: 2, row: 0 },
                { id: 'r0c3', col: 3, row: 0 },
                { id: 'r1c0', col: 0, row: 1 },
                { id: 'r1c1', col: 1, row: 1 },
                { id: 'r1c2', col: 2, row: 1 },
                { id: 'r1c3', col: 3, row: 1 }
            ]
        });
    }

    // 3-row layout (optimized for extra-tall displays)
    if (screenHeight >= 1400 && maxRows >= 3) {
        layouts.push({
            id: 'rows-3',
            label: '3 Rows',
            class: 'layout-rows-3',
            cols: 1,
            rows: 3,
            zones: [
                { id: 'top', col: 0, row: 0 },
                { id: 'middle', col: 0, row: 1 },
                { id: 'bottom', col: 0, row: 2 }
            ]
        });
    }

    // 2x3 grid (requires extra-tall displays for usability)
    if (screenHeight >= 1400 && maxCols >= 2 && maxRows >= 3) {
        layouts.push({
            id: 'grid-2x3',
            label: '2×3 Grid',
            class: 'layout-grid-2x3',
            cols: 2,
            rows: 3,
            zones: [
                { id: 'r0c0', col: 0, row: 0 },
                { id: 'r0c1', col: 1, row: 0 },
                { id: 'r1c0', col: 0, row: 1 },
                { id: 'r1c1', col: 1, row: 1 },
                { id: 'r2c0', col: 0, row: 2 },
                { id: 'r2c1', col: 1, row: 2 }
            ]
        });
    }

    // 3x3 grid (reserved for ultra-wide and ultra-tall configurations)
    if (screenWidth >= 1400 && screenHeight >= 1400 && maxCols >= 3 && maxRows >= 3) {
        layouts.push({
            id: 'grid-3x3',
            label: '3×3 Grid',
            class: 'layout-grid-3x3',
            cols: 3,
            rows: 3,
            zones: [
                { id: 'r0c0', col: 0, row: 0 },
                { id: 'r0c1', col: 1, row: 0 },
                { id: 'r0c2', col: 2, row: 0 },
                { id: 'r1c0', col: 0, row: 1 },
                { id: 'r1c1', col: 1, row: 1 },
                { id: 'r1c2', col: 2, row: 1 },
                { id: 'r2c0', col: 0, row: 2 },
                { id: 'r2c1', col: 1, row: 2 },
                { id: 'r2c2', col: 2, row: 2 }
            ]
        });
    }

    return layouts;
}

// Minimum viewport dimensions for snap layout functionality
const MIN_VIEWPORT_WIDTH = 800;
const MIN_VIEWPORT_HEIGHT = 600;

export class SnapLayouter {
    constructor() {
        this.overlay = null;
        this.highlight = null;
        this.activeApp = null;
        this.activeZone = null;
        this.layouts = [];
        /** @type {WindowStateRegistry} Global registry for snapped window states */
        this.registry = new WindowStateRegistry();
        this.lastMousePosition = { x: 0, y: 0 };
        /** @type {WeakMap<Application|ApplicationV2, Object>} Map app instances to their snap state */
        this.appStateMap = new WeakMap();

        // Event Registry System: Track all event listeners for proper cleanup
        // Using Map allows for efficient lookup and removal by unique identifier
        // This prevents memory leaks when the module is disabled or windows are closed
        this.eventListeners = new Map();
        this.timers = new Set(); // Track setInterval/setTimeout IDs for cleanup
        this.resizeTimeout = null; // Debounce timer for resize events

        // Hook Registry System: Track all hook listeners for proper cleanup
        // Hooks.on() creates persistent listeners that must be removed with Hooks.off()
        this.hooks = new Map(); // Maps eventName -> Set of handler functions

        // Performance Metrics System: Optional performance tracking for optimization analysis
        /** @type {PerformanceTracker} Tracks snap layout performance metrics */
        this.performance = new PerformanceTracker();

        this.createOverlay();

        // Recalculate layouts on window resize - debounced for performance
        this.addTrackedListener(window, 'resize', () => {
            if (this.resizeTimeout) this.clearTrackedTimer(this.resizeTimeout);
            this.resizeTimeout = this.addTrackedTimer(setTimeout(() => this.rebuildOverlay(), 150));
        });

        // Track mouse position globally for zone activation - using tracked listener
        this.addTrackedListener(document, 'mousemove', (e) => {
            this.lastMousePosition = { x: e.clientX, y: e.clientY };
        });

        // Track window closes to update registry
        this.setupCloseTracking();

        // Register cleanup on module unload
        this.addTrackedHook('unload', () => this.cleanup());
    }

    /**
     * Add an event listener that will be tracked for cleanup
     * This ensures all event listeners can be properly removed to prevent memory leaks
     * @param {EventTarget} target - The DOM element to attach the listener to
     * @param {string} event - The event name (e.g., 'click', 'resize')
     * @param {Function} handler - The event handler function
     * @param {Object|boolean} [options] - Event listener options (capture, passive, etc.)
     * @returns {Symbol|null} - Unique identifier for this listener (can be used for manual removal), or null if invalid
     */
    addTrackedListener(target, event, handler, options) {
        if (!target || typeof target.addEventListener !== 'function') {
            debugLog('SnapLayouter.addTrackedListener: Invalid target', target);
            return null;
        }

        target.addEventListener(event, handler, options);
        const id = Symbol('eventListener');
        this.eventListeners.set(id, { target, event, handler, options });
        return id;
    }

    /**
     * Remove a specific tracked listener by its identifier
     * @param {Symbol} id - The identifier returned by addTrackedListener
     * @returns {boolean} - True if listener was found and removed
     */
    removeTrackedListener(id) {
        const listener = this.eventListeners.get(id);
        if (listener) {
            listener.target.removeEventListener(listener.event, listener.handler, listener.options);
            this.eventListeners.delete(id);
            return true;
        }
        return false;
    }

    /**
     * Track a timer (setTimeout or setInterval) for cleanup
     * @param {number} timerId - The timer ID returned by setTimeout or setInterval
     * @returns {number} - The timer ID for convenience
     */
    addTrackedTimer(timerId) {
        this.timers.add(timerId);
        return timerId;
    }

    /**
     * Clear a tracked timer and remove it from tracking
     * @param {number} timerId - The timer ID to clear
     */
    clearTrackedTimer(timerId) {
        if (this.timers.has(timerId)) {
            clearTimeout(timerId);
            clearInterval(timerId);
            this.timers.delete(timerId);
        }
    }

    /**
     * Add a tracked hook listener for FoundryVTT hook system
     * Hooks.on() creates persistent listeners that must be removed with Hooks.off()
     * @param {string} eventName - The hook event name (e.g., 'closeApplication')
     * @param {Function} handler - The hook handler function
     * @returns {Function} - The handler function (can be used for manual removal)
     */
    addTrackedHook(eventName, handler) {
        // Register the hook with Foundry's hook system
        Hooks.on(eventName, handler);

        // Track it for cleanup
        if (!this.hooks.has(eventName)) {
            this.hooks.set(eventName, new Set());
        }
        this.hooks.get(eventName).add(handler);

        return handler;
    }

    /**
     * Remove a tracked hook listener
     * @param {string} eventName - The hook event name
     * @param {Function} handler - The handler function to remove
     * @returns {boolean} - True if hook was found and removed
     */
    removeTrackedHook(eventName, handler) {
        const handlers = this.hooks.get(eventName);
        if (handlers && handlers.has(handler)) {
            Hooks.off(eventName, handler);
            handlers.delete(handler);
            if (handlers.size === 0) {
                this.hooks.delete(eventName);
            }
            return true;
        }
        return false;
    }

    /**
     * Set up hooks to track when snapped windows are closed
     */
    setupCloseTracking() {
        // AppV1 close hook
        this.addTrackedHook('closeApplication', (app, html) => {
            if (this.registry.getState(app)) {
                this.registry.markClosed(app);
            }
        });

        // AppV2 close hook
        this.addTrackedHook('closeApplicationV2', (app, html) => {
            if (this.registry.getState(app)) {
                this.registry.markClosed(app);
            }
        });
    }

    createOverlay() {
        // Create the main overlay container
        this.overlay = document.createElement('div');
        this.overlay.id = 'window-maximizer-overlay';

        // Create the bar containing layout options
        const bar = document.createElement('div');
        bar.id = 'window-maximizer-bar';

        this.overlay.appendChild(bar);
        document.body.appendChild(this.overlay);

        // Hide overlay when mouse leaves the overlay area - using tracked listener
        this.addTrackedListener(this.overlay, 'mouseleave', () => {
            if (this.activeApp) {
                this.hide();
            }
        });

        // Create highlight rect
        this.highlight = document.createElement('div');
        this.highlight.id = 'window-maximizer-highlight';
        document.body.appendChild(this.highlight);

        // Build the layout options
        this.buildLayoutOptions();
    }

    /**
     * Build layout option elements in the bar based on current screen size
     * Uses event delegation for zone listeners to prevent memory leaks
     */
    buildLayoutOptions() {
        const bar = this.overlay.querySelector('#window-maximizer-bar');
        bar.innerHTML = '';

        // Calculate available layouts for current screen
        this.layouts = calculateAvailableLayouts();

        this.layouts.forEach(layout => {
            const opt = document.createElement('div');
            opt.className = `layout-option ${layout.class}`;
            opt.dataset.layout = layout.id;
            opt.dataset.layoutLabel = layout.label; // For CSS tooltip
            opt.title = layout.label; // Native browser tooltip fallback

            // Set grid template based on cols/rows
            opt.style.gridTemplateColumns = `repeat(${layout.cols}, 1fr)`;
            opt.style.gridTemplateRows = `repeat(${layout.rows}, 1fr)`;

            layout.zones.forEach(zone => {
                const z = document.createElement('div');
                z.className = 'layout-zone';
                z.dataset.zone = zone.id;
                opt.appendChild(z);
            });

            bar.appendChild(opt);
        });

        // Set up event delegation for all zones using tracked listeners
        // This replaces individual zone listeners with 6 delegated listeners on the bar
        this.setupZoneEventDelegation(bar);

        debugLog(`Built ${this.layouts.length} layouts for ${window.innerWidth}x${window.innerHeight} screen`);
    }

    /**
     * Set up event delegation for zone interactions
     * Uses event.target.closest('.layout-zone') to find the zone
     * This prevents memory leaks by avoiding individual zone listeners
     * @param {HTMLElement} bar - The bar element containing all layout options
     */
    setupZoneEventDelegation(bar) {
        // Helper to find zone info from event target
        const getZoneInfo = (target) => {
            const zone = target.closest('.layout-zone');
            if (!zone) return null;
            const layout = zone.closest('.layout-option');
            if (!layout) return null;
            return {
                layoutId: layout.dataset.layout,
                zoneId: zone.dataset.zone
            };
        };

        // Mouse events (for AppV1 and general compatibility)
        this.addTrackedListener(bar, 'mouseenter', (e) => {
            const zoneInfo = getZoneInfo(e.target);
            if (zoneInfo) this.activateZone(zoneInfo.layoutId, zoneInfo.zoneId);
        }, true); // Use capture phase

        this.addTrackedListener(bar, 'mouseleave', (e) => {
            this.deactivateZone(); // Always deactivate when leaving the bar
        }, true);

        this.addTrackedListener(bar, 'mouseup', (e) => {
            const zoneInfo = getZoneInfo(e.target);
            if (zoneInfo) this.onZoneDrop(e, zoneInfo.layoutId, zoneInfo.zoneId);
        }, true);

        // Pointer events (for AppV2 drag system)
        this.addTrackedListener(bar, 'pointerenter', (e) => {
            const zoneInfo = getZoneInfo(e.target);
            if (zoneInfo) this.activateZone(zoneInfo.layoutId, zoneInfo.zoneId);
        }, true);

        this.addTrackedListener(bar, 'pointerleave', (e) => {
            this.deactivateZone(); // Always deactivate when leaving the bar
        }, true);

        this.addTrackedListener(bar, 'pointerup', (e) => {
            const zoneInfo = getZoneInfo(e.target);
            if (zoneInfo) this.onZoneDrop(e, zoneInfo.layoutId, zoneInfo.zoneId);
        }, true);
    }

    /**
     * Rebuild the overlay when screen size changes
     */
    rebuildOverlay() {
        this.buildLayoutOptions();
    }

    /**
     * Find which zone (if any) is at the given screen coordinates
     * @param {number} x - Screen X coordinate
     * @param {number} y - Screen Y coordinate
     * @returns {Object|null} - {layoutId, zoneId} or null
     */
    findZoneAtPosition(x, y) {
        const element = document.elementFromPoint(x, y);
        if (!element) {
            debugLog('No element at position', x, y);
            return null;
        }

        const zone = element.closest('.layout-zone');
        if (!zone) {
            debugLog('Element not in a zone:', element.className);
            return null;
        }

        const layoutOption = zone.closest('.layout-option');
        if (!layoutOption) {
            debugLog('Zone without layout option');
            return null;
        }

        const result = {
            layoutId: layoutOption.dataset.layout,
            zoneId: zone.dataset.zone
        };
        debugLog('Found zone at position:', result);
        return result;
    }

    show(app) {
        this.activeApp = app;
        this.overlay.classList.add('active');

        // Track overlay show operation for performance metrics
        this.performance.recordOverlayShow();

        // Activate zone under cursor if present (handles case where overlay appears under mouse)
        // Using tracked timer to prevent memory leaks
        this.addTrackedTimer(setTimeout(() => {
            const zoneInfo = this.findZoneAtPosition(this.lastMousePosition.x, this.lastMousePosition.y);
            if (zoneInfo) {
                this.activateZone(zoneInfo.layoutId, zoneInfo.zoneId);
            }
        }, 0));
    }

    hide() {
        this.overlay.classList.remove('active');
        this.deactivateZone(); // Use centralized method to clear zone state and minimap highlights
        this.activeApp = null;
    }

    activateZone(layoutId, zoneId) {
        this.activeZone = { layoutId, zoneId };

        // Calculate preview rectangle based on zone
        const rect = this.calculateZoneRect(layoutId, zoneId);
        if (rect) {
            this.highlight.style.display = 'block';
            this.highlight.style.top = rect.y + 'px';
            this.highlight.style.left = rect.x + 'px';
            this.highlight.style.width = rect.w + 'px';
            this.highlight.style.height = rect.h + 'px';
        }

        // Highlight the zone in the minimap
        this.highlightZoneInMinimap(layoutId, zoneId);
    }

    /**
     * Highlight a zone in the minimap layout bar
     * Adds visual feedback when hovering over zones
     * @param {string} layoutId - The layout identifier
     * @param {string} zoneId - The zone identifier within the layout
     */
    highlightZoneInMinimap(layoutId, zoneId) {
        // Remove active class from all zones first
        const allZones = this.overlay.querySelectorAll('.layout-zone');
        allZones.forEach(zone => zone.classList.remove('active'));

        // Add active class to the specific zone
        const layoutOption = this.overlay.querySelector(`.layout-option[data-layout="${layoutId}"]`);
        if (layoutOption) {
            const zone = layoutOption.querySelector(`.layout-zone[data-zone="${zoneId}"]`);
            if (zone) {
                zone.classList.add('active');
            }
        }
    }

    /**
     * Deactivate the currently active zone
     * Clears both the highlight overlay and minimap highlighting
     */
    deactivateZone() {
        // Clear active zone state
        this.activeZone = null;

        // Hide the highlight overlay
        this.highlight.style.display = 'none';

        // Remove active class from all zones in minimap
        const allZones = this.overlay.querySelectorAll('.layout-zone');
        allZones.forEach(zone => zone.classList.remove('active'));
    }

    onZoneDrop(event, layoutId, zoneId) {
        debugLog('Zone drop triggered:', layoutId, zoneId, 'activeApp:', this.activeApp?.constructor?.name);
        event.stopPropagation(); // Prevent normal drag drop
        if (!this.activeApp) {
            debugLog('No active app for zone drop');
            return;
        }

        const rect = this.calculateZoneRect(layoutId, zoneId);
        if (rect) {
            debugLog('Snapping to zone:', layoutId, zoneId, rect);
            this.snapApp(this.activeApp, rect, { layoutId, zoneId });
        } else {
            debugLog('Could not calculate rect for zone:', layoutId, zoneId);
        }
        this.hide();
    }

    calculateZoneRect(layoutId, zoneId) {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        // Find the layout definition
        const layout = this.layouts.find(l => l.id === layoutId);
        if (!layout) {
            // Fallback for 'full' if layouts not initialized (e.g., called from maximize button)
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

    /**
     * Check if an application is ApplicationV2 (not legacy Application)
     * @param {Application|ApplicationV2} app
     * @returns {boolean}
     */
    isAppV2(app) {
        if (!app) return false;

        // Method 1: Check prototype chain - most reliable for V13+
        // ApplicationV2 instances inherit from foundry.applications.api.ApplicationV2
        if (typeof foundry !== 'undefined' &&
            foundry.applications &&
            foundry.applications.api &&
            foundry.applications.api.ApplicationV2 &&
            app instanceof foundry.applications.api.ApplicationV2) {
            return true;
        }

        // Method 2: Check BASE_APPLICATION metadata (used by FoundryV11+)
        // This is set on ApplicationV2 subclass constructors
        if (app.constructor?.BASE_APPLICATION?.name === 'ApplicationV2') {
            return true;
        }

        // Method 3: Check for V2-specific class naming convention
        // Many third-party modules follow the "V2" suffix pattern
        if (app.constructor?.name?.endsWith('V2')) {
            // Additional check: V2 apps typically have a render method with specific signature
            // and use direct HTMLElement for element property
            const hasDirectElement = app.element instanceof HTMLElement;
            const hasV2StyleHooks = app._onRenderFirst !== undefined ||
                                    app._onRender !== undefined ||
                                    typeof app.getPosition === 'function';
            if (hasDirectElement || hasV2StyleHooks) {
                return true;
            }
        }

        // Method 4: Check foundry.applications.instances membership
        // ApplicationV2 instances are registered in this global registry
        if (foundry?.applications?.instances) {
            // Try to find the app in the instances collection
            for (const instance of foundry.applications.instances.values()) {
                if (instance === app) {
                    return true;
                }
            }
        }

        // Method 5: Negative check - explicitly exclude ApplicationV1
        // ApplicationV1 apps have jQuery-wrapped elements and specific structure
        if (app.element && !Array.isArray(app.element) &&
            typeof app.element.jquery === 'string') {
            // This is definitely a V1 app (jQuery object)
            return false;
        }

        return false;
    }

    /**
     * Get the HTMLElement from an application (handles both AppV1 and AppV2)
     * @param {Application|ApplicationV2} app
     * @returns {HTMLElement|null}
     */
    getAppElement(app) {
        if (!app.element) return null;
        // AppV1 uses jQuery, AppV2 uses direct HTMLElement
        return app.element instanceof HTMLElement ? app.element : app.element[0];
    }

    /**
     * Snap an application to a zone
     * @param {Application|ApplicationV2} app - The application to snap
     * @param {Object} rect - The target rectangle {x, y, w, h}
     * @param {Object} [zoneInfo] - Zone info {layoutId, zoneId} for registry
     */
    snapApp(app, rect, zoneInfo = { layoutId: 'full', zoneId: 'full' }) {
        // Validate app object before proceeding
        if (!app || !app.position || typeof app.setPosition !== 'function') {
            debugLog('Invalid app object provided to snapApp');
            return;
        }

        // Validate viewport dimensions
        if (window.innerWidth < MIN_VIEWPORT_WIDTH || window.innerHeight < MIN_VIEWPORT_HEIGHT) {
            debugLog('Screen too small for snap layout');
            return;
        }

        // Start performance timer for snap operation
        this.performance.startTimer('snap');

        // Get original position before snapping
        const pos = app.position;
        const originalPosition = {
            left: pos.left,
            top: pos.top,
            width: pos.width,
            height: pos.height
        };

        // Clamp rect to viewport bounds to prevent off-screen positioning
        rect.x = Math.max(0, Math.min(rect.x, window.innerWidth - 100));
        rect.y = Math.max(0, Math.min(rect.y, window.innerHeight - 100));
        rect.w = Math.min(rect.w, window.innerWidth - rect.x);
        rect.h = Math.min(rect.h, window.innerHeight - rect.y);

        // Store state in WeakMap to prevent global state pollution
        // This is the ONLY place we store snap state - no pollution of app object
        if (!this.appStateMap.has(app)) {
            this.appStateMap.set(app, {
                originalPosition: { ...originalPosition },
                zoneInfo
            });
        }

        // Register in the global registry (survives window closes)
        if (!this.registry.getState(app)) {
            this.registry.registerSnap(app, originalPosition, zoneInfo);
        }

        // Wrap setPosition in try-catch for error handling
        try {
            app.setPosition({
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h
            });
        } catch (error) {
            debugLog('Failed to set position:', error);
            ui.notifications?.error('Failed to maximize window');
            return;
        }

        // End performance timer and record snap operation
        const snapDuration = this.performance.endTimer('snap');
        this.performance.recordSnap();

        // Update header button to show restore icon
        // Use WeakMap check instead of polluting app object
        this.updateHeaderButton(app);
    }

    /**
     * Restore a single application to its original position
     * @param {Application|ApplicationV2} app - The application to restore
     */
    restoreApp(app) {
        // Validate app object before proceeding
        if (!app || !app.position || typeof app.setPosition !== 'function') {
            debugLog('Invalid app object provided to restoreApp');
            return;
        }

        // Record restore operation for performance metrics
        this.performance.recordRestore();

        // Get state from WeakMap
        const state = this.appStateMap.get(app);
        if (state) {
            // Wrap setPosition in try-catch for error handling
            try {
                app.setPosition(state.originalPosition);
            } catch (error) {
                debugLog('Failed to restore position:', error);
                ui.notifications?.error('Failed to restore window');
                // Don't return - still clean up state
            }
            this.appStateMap.delete(app);
            // No pollution of app object - state is only in WeakMap
            this.updateHeaderButton(app);
        }
        // Remove from global registry
        this.registry.removeState(app);
    }

    /**
     * Restore all snapped windows to their original positions
     * Re-opens closed windows if possible
     * Clears the registry after restore
     * @returns {Promise<Object>} Summary of restore operation
     */
    async restoreAll() {
        const states = this.registry.getAllStatesArray();
        let restoredOpen = 0;
        let reopened = 0;
        let skipped = 0;

        for (const state of states) {
            try {
                // Try to find the open application
                const app = this.findOpenApplication(state.appKey);

                if (app && state.isOpen) {
                    // Validate app before proceeding
                    if (!app || typeof app.setPosition !== 'function') {
                        debugLog('Invalid app during restore all:', state.appKey);
                        skipped++;
                        continue;
                    }

                    // Wrap setPosition in try-catch for error handling
                    // This ensures we continue to the next window even if one fails
                    try {
                        app.setPosition(state.originalPosition);
                        this.appStateMap.delete(app);
                        // No pollution of app object - state is only in WeakMap
                        this.updateHeaderButton(app);
                        restoredOpen++;
                    } catch (setPositionError) {
                        debugLog('Failed to setPosition during restore all:', state.appKey, setPositionError);
                        ui.notifications?.warn(`Failed to restore window: ${state.appKey}`);
                        skipped++;
                        // Continue to next window instead of failing entire operation
                    }
                } else if (!state.isOpen && state.documentInfo) {
                    // Window was closed - try to re-open it
                    const reopenedApp = await this.reopenDocument(state);
                    if (reopenedApp) {
                        reopened++;
                    } else {
                        skipped++;
                    }
                } else {
                    // No document info or other case - skip
                    skipped++;
                }
            } catch (error) {
                debugLog('Error restoring window:', state.appKey, error);
                skipped++;
            }
        }

        // Clear the registry
        this.registry.clearAll();

        const summary = {
            restoredOpen,
            reopened,
            skipped,
            total: states.length
        };

        debugLog(`Restore All: ${restoredOpen} open restored, ${reopened} reopened, ${skipped} skipped`, summary);

        return summary;
    }

    /**
     * Attempt to re-open a closed document and restore its position
     * @param {Object} state - The saved window state
     * @returns {Promise<Application|ApplicationV2|null>} The reopened application or null
     */
    async reopenDocument(state) {
        if (!state.documentInfo || !state.documentInfo.uuid) {
            debugLog(`Cannot reopen ${state.appKey}: no document info`);
            return null;
        }

        try {
            // Fetch the document by UUID
            const doc = await fromUuid(state.documentInfo.uuid);
            if (!doc) {
                debugLog(`Document not found for ${state.documentInfo.uuid} (may have been deleted)`);
                return null;
            }

            // Open the document's sheet with the original position
            const sheet = await doc.sheet.render(true, {
                left: state.originalPosition.left,
                top: state.originalPosition.top,
                width: state.originalPosition.width,
                height: state.originalPosition.height
            });

            debugLog(`Reopened ${state.documentInfo.documentName}: ${doc.name}`);
            return sheet;
        } catch (error) {
            debugLog(`Failed to reopen document ${state.documentInfo.uuid}:`, error);
            return null;
        }
    }

    /**
     * Find an open application by its registry key
     * @param {string} appKey - The application key from the registry
     * @returns {Application|ApplicationV2|null}
     */
    findOpenApplication(appKey) {
        // Check all open applications
        // ui.windows contains all AppV1 windows keyed by appId
        if (ui.windows) {
            for (const [id, app] of Object.entries(ui.windows)) {
                const key = this.registry.getAppKey(app);
                if (key === appKey) {
                    return app;
                }
            }
        }

        // Check AppV2 windows via foundry.applications if available
        if (foundry?.applications?.instances) {
            for (const app of foundry.applications.instances.values()) {
                const key = this.registry.getAppKey(app);
                if (key === appKey) {
                    return app;
                }
            }
        }

        return null;
    }

    /**
     * Check if there are any snapped windows to restore
     * @returns {boolean}
     */
    hasSnappedWindows() {
        return this.registry.hasSnappedWindows();
    }

    /**
     * Get the count of snapped windows
     * @returns {number}
     */
    getSnappedCount() {
        return this.registry.getSnappedCount();
    }

    updateHeaderButton(app) {
        const el = this.getAppElement(app);
        if (!el) return;

        // Check WeakMap for snapped state instead of polluting app object
        const isSnapped = this.appStateMap.has(app);
        const newIcon = isSnapped ? 'fa-window-restore' : 'fa-window-maximize';
        const oldIcon = isSnapped ? 'fa-window-maximize' : 'fa-window-restore';
        const newLabel = isSnapped ? 'Restore' : 'Maximize';

        // Try AppV1 button first (inline header button)
        const appV1Btn = el.querySelector('.window-maximizer-btn');
        if (appV1Btn) {
            // Update icon
            const icon = appV1Btn.querySelector('i');
            if (icon) {
                icon.classList.remove(oldIcon);
                icon.classList.add(newIcon);
            }
            // Update label text - AppV1 button structure: <a><i></i> Label</a>
            // Remove ALL existing text nodes and append new text to prevent accumulation
            const textNodes = Array.from(appV1Btn.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
            textNodes.forEach(node => node.remove());
            appV1Btn.appendChild(document.createTextNode(` ${newLabel}`));
            return;
        }

        // Try injected AppV2 visible button (our custom injection)
        const appV2VisibleBtn = el.querySelector('.window-maximizer-appv2-btn');
        if (appV2VisibleBtn) {
            // Update icon
            const icon = appV2VisibleBtn.querySelector('i');
            if (icon) {
                icon.classList.remove(oldIcon);
                icon.classList.add(newIcon);
            }
            // Update title attribute
            appV2VisibleBtn.title = newLabel;
        }

        // Also try AppV2 dropdown controls (may exist in addition to visible button)
        const appV2DropdownBtn = el.querySelector('[data-action="windowMaximizerToggle"]:not(.window-maximizer-appv2-btn)');
        if (appV2DropdownBtn) {
            // Update icon
            const icon = appV2DropdownBtn.querySelector('i');
            if (icon) {
                icon.classList.remove(oldIcon);
                icon.classList.add(newIcon);
            }
            // Update label - AppV2 button structure varies, look for label element or text
            const labelEl = appV2DropdownBtn.querySelector('.control-label, span');
            if (labelEl) {
                labelEl.textContent = newLabel;
            } else {
                // Fallback: remove ALL text nodes and append new text to prevent accumulation
                const textNodes = Array.from(appV2DropdownBtn.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
                textNodes.forEach(node => node.remove());
                appV2DropdownBtn.appendChild(document.createTextNode(newLabel));
            }
        }
    }

    /**
     * Cleanup all tracked event listeners, timers, and hooks
     * This should be called when the module is disabled or needs to be reset
     * Prevents memory leaks by removing all event listeners, clearing all timers,
     * and removing all hook listeners
     */
    cleanup() {
        // Remove all tracked event listeners
        for (const [id, { target, event, handler, options }] of this.eventListeners) {
            try {
                target.removeEventListener(event, handler, options);
            } catch (error) {
                debugLog('SnapLayouter.cleanup: Error removing event listener:', error);
            }
        }
        this.eventListeners.clear();

        // Clear all tracked timers
        for (const timerId of this.timers) {
            try {
                clearTimeout(timerId);
                clearInterval(timerId);
            } catch (error) {
                debugLog('SnapLayouter.cleanup: Error clearing timer:', error);
            }
        }
        this.timers.clear();

        // Remove all tracked hook listeners
        for (const [eventName, handlers] of this.hooks) {
            for (const handler of handlers) {
                try {
                    Hooks.off(eventName, handler);
                } catch (error) {
                    debugLog('SnapLayouter.cleanup: Error removing hook listener:', error);
                }
            }
        }
        this.hooks.clear();

        // Clean up DOM elements
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        if (this.highlight && this.highlight.parentNode) {
            this.highlight.parentNode.removeChild(this.highlight);
        }

        // Reset state
        this.overlay = null;
        this.highlight = null;
        this.activeApp = null;
        this.activeZone = null;

        debugLog('SnapLayouter.cleanup: All listeners, timers, and hooks removed');
    }

    /**
     * Get current performance metrics from the performance tracker
     * Provides access to usage statistics for analysis and optimization
     * @returns {Object} - Performance metrics including drag/snap/restore counts and timing data
     */
    getPerformanceMetrics() {
        return this.performance.getMetrics();
    }

    /**
     * Reset all performance metrics to initial values
     * Useful for starting fresh measurements or for testing scenarios
     */
    resetPerformanceMetrics() {
        this.performance.reset();
    }
}
