import { SnapLayouter } from './snap-layouter.js';

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

let layouter;

/**
 * Event Tracking System for drag tracking listeners
 * These listeners are set up on the document and need to be cleaned up
 * to prevent memory leaks when the module is disabled or reloaded
 * @type {Array<{target: EventTarget, event: string, handler: Function, options: any}>}
 */
const dragTrackingListeners = [];
const dragTrackingTimers = new Set(); // Track interval IDs for cleanup

/**
 * Button Listener Tracking System for AppV2 buttons
 * Uses WeakMap to track button listeners per application instance
 * This ensures proper cleanup when apps are destroyed
 * @type {WeakMap<Application|ApplicationV2, Set<{button: HTMLElement, handler: Function}>>}
 */
const buttonListenersMap = new WeakMap();

/**
 * Add a tracked event listener for drag tracking
 * Stores the listener info so it can be cleaned up later
 * @param {EventTarget} target - The DOM element to attach the listener to
 * @param {string} event - The event name
 * @param {Function} handler - The event handler function
 * @param {Object|boolean} [options] - Event listener options
 */
function addDragTrackedListener(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    dragTrackingListeners.push({ target, event, handler, options });
}

/**
 * Add a tracked timer for drag tracking
 * @param {number} timerId - The timer ID from setInterval or setTimeout
 * @returns {number} The timer ID
 */
function addDragTrackedTimer(timerId) {
    dragTrackingTimers.add(timerId);
    return timerId;
}

/**
 * Clear a tracked timer
 * @param {number} timerId - The timer ID to clear
 */
function clearDragTrackedTimer(timerId) {
    if (dragTrackingTimers.has(timerId)) {
        clearTimeout(timerId);
        clearInterval(timerId);
        dragTrackingTimers.delete(timerId);
    }
}

/**
 * Add a tracked button listener for AppV2 buttons
 * Tracks the button and handler per app instance for proper cleanup
 * @param {Application|ApplicationV2} app - The application instance
 * @param {HTMLElement} button - The button element
 * @param {Function} handler - The click handler function
 */
function addTrackedButtonListener(app, button, handler) {
    button.addEventListener('click', handler);

    if (!buttonListenersMap.has(app)) {
        buttonListenersMap.set(app, new Set());
    }
    buttonListenersMap.get(app).add({ button, handler });
}

/**
 * Remove all tracked button listeners for a specific app
 * @param {Application|ApplicationV2} app - The application instance
 */
function removeTrackedButtonListeners(app) {
    const listeners = buttonListenersMap.get(app);
    if (listeners) {
        for (const { button, handler } of listeners) {
            try {
                button.removeEventListener('click', handler);
            } catch (error) {
                console.warn('Window Maximizer | Error removing button listener:', error);
            }
        }
        buttonListenersMap.delete(app);
    }
}

/**
 * Cleanup all drag tracking event listeners and timers
 * Should be called when the module is disabled or needs to be reset
 */
function cleanupDragTracking() {
    // Remove all tracked event listeners
    for (const { target, event, handler, options } of dragTrackingListeners) {
        try {
            target.removeEventListener(event, handler, options);
        } catch (error) {
            console.warn('Window Maximizer | Error removing drag tracking listener:', error);
        }
    }
    dragTrackingListeners.length = 0;

    // Clear all tracked timers
    for (const timerId of dragTrackingTimers) {
        try {
            clearTimeout(timerId);
            clearInterval(timerId);
        } catch (error) {
            console.warn('Window Maximizer | Error clearing drag tracking timer:', error);
        }
    }
    dragTrackingTimers.clear();

    // Note: Button listeners are cleaned up per-app via WeakMap garbage collection
    // We don't need to manually clean them up here as WeakMap handles it automatically

    console.log('Window Maximizer | Drag tracking cleanup complete');
}

// Register module settings
Hooks.once('init', () => {
    game.settings.register('window-maximizer', 'debugMode', {
        name: 'Window Maximizer | Debug Mode',
        hint: 'Enable verbose console logging for troubleshooting',
        scope: 'client',
        config: true,
        type: Boolean,
        default: false,
        requiresReload: false
    });

    game.settings.register('window-maximizer', 'showMaximizeButton', {
        name: 'Show Maximize Button',
        hint: 'Display a maximize button in window headers (Application v2 only). Requires reload to take effect.',
        scope: 'client',
        config: true,
        type: Boolean,
        default: true,
        onChange: () => {
            ui.notifications.info('Window Maximizer | Reload required for button visibility changes to take effect');
        }
    });
});

Hooks.once('ready', () => {
    debugLog('Ready Hook Fired');
    layouter = new SnapLayouter();

    // Patch Draggable for AppV1 windows
    patchDraggable();
    debugLog('Draggable Patched');

    // Setup AppV2 drag tracking as a fallback/supplement
    setupAppV2DragTracking();
});

// Add Restore All button to scene controls
Hooks.on('getSceneControlButtons', (controls) => {
    // Find the token controls group (first group, always present)
    const tokenControls = controls.find(c => c.name === 'token');
    if (!tokenControls) return;

    // Add our restore-all button as a tool in the token controls
    tokenControls.tools.push({
        name: 'window-maximizer-restore-all',
        title: 'Restore All Windows',
        icon: 'fas fa-window-restore',
        button: true,
        visible: true,
        onClick: async () => {
            if (!layouter) {
                console.error('Window Maximizer | Layouter not initialized');
                return;
            }

            if (!layouter.hasSnappedWindows()) {
                ui.notifications.info('No snapped windows to restore.');
                return;
            }

            const summary = await layouter.restoreAll();

            // Build notification message based on what happened
            const parts = [];
            if (summary.restoredOpen > 0) {
                parts.push(`${summary.restoredOpen} window(s) restored`);
            }
            if (summary.reopened > 0) {
                parts.push(`${summary.reopened} window(s) reopened`);
            }
            if (parts.length === 0 && summary.skipped > 0) {
                ui.notifications.warn(`Could not restore ${summary.skipped} window(s) - documents may have been deleted.`);
            } else {
                const message = parts.join(', ') + '.';
                ui.notifications.info(message);
            }
        }
    });
});

// Legacy Application (AppV1) header buttons hook
Hooks.on('getApplicationHeaderButtons', (app, buttons) => {
    debugLog('Adding button to AppV1', app.constructor.name);
    // Check if we already have it (check both possible labels)
    if (buttons.some(b => b.label === "Maximize" || b.label === "Restore")) return;

    // Check if window is currently snapped
    const isSnapped = layouter ? layouter.appStateMap.has(app) : false;

    buttons.unshift({
        label: isSnapped ? "Restore" : "Maximize",
        class: "window-maximizer-btn",
        icon: isSnapped ? "fas fa-window-restore" : "fas fa-window-maximize",
        onclick: (ev) => {
            if (!layouter) return;

            if (layouter.appStateMap.has(app)) {
                layouter.restoreApp(app);
            } else {
                layouter.snapApp(app, layouter.calculateZoneRect('full', 'full'));
            }
        }
    });
});

// ApplicationV2 header controls hook (FoundryVTT v13+)
// Note: This adds button to the dropdown menu. We also inject a visible button via renderApplicationV2.
Hooks.on('getHeaderControlsApplicationV2', (app, controls) => {
    // Check if button injection is enabled
    if (!game.settings.get('window-maximizer', 'showMaximizeButton')) return;

    debugLog('Adding button to AppV2 dropdown', app.constructor.name);
    // Check if we already have a maximize control
    if (controls.some(c => c.action === "windowMaximizerToggle")) return;

    // Check if window is currently snapped
    const isSnapped = layouter ? layouter.appStateMap.has(app) : false;

    controls.push({
        icon: isSnapped ? "fas fa-window-restore" : "fas fa-window-maximize",
        label: isSnapped ? "Restore" : "Maximize",
        action: "windowMaximizerToggle",
        visible: true,
        onClick: (event) => {
            if (!layouter) return;

            if (layouter.appStateMap.has(app)) {
                layouter.restoreApp(app);
            } else {
                layouter.snapApp(app, layouter.calculateZoneRect('full', 'full'));
            }
        }
    });
});

// ApplicationV2 render hook - inject visible button directly into header
// This ensures the button is always visible, not hidden in dropdown
Hooks.on('renderApplicationV2', (app, html, options) => {
    // Check if button injection is enabled
    if (!game.settings.get('window-maximizer', 'showMaximizeButton')) return;

    // html is the jQuery wrapper or HTMLElement depending on version
    const element = html instanceof HTMLElement ? html : html[0];
    if (!element) return;

    // Check if we already injected our button
    if (element.querySelector('.window-maximizer-appv2-btn')) return;

    // Find the header element - ApplicationV2 uses various structures
    const header = element.querySelector('header, .window-header');
    if (!header) return;

    // Check if window is docked/minimized (sidebar windows)
    // Docked windows should not have maximize button
    const isDocked = element.classList.contains('docked') ||
        element.classList.contains('minimized') ||
        element.closest('.sidebar') !== null ||
        element.closest('#sidebar') !== null ||
        app.constructor.name.includes('Sidebar') ||
        app.options?.popOut === false;

    if (isDocked) {
        debugLog('Skipping docked window:', app.constructor.name);
        return;
    }

    // Check if window is currently snapped
    const isSnapped = layouter ? layouter.appStateMap.has(app) : false;
    const iconClass = isSnapped ? 'fa-window-restore' : 'fa-window-maximize';
    const title = isSnapped ? 'Restore' : 'Maximize';

    // Create the button
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'window-maximizer-appv2-btn header-control';
    btn.title = title;
    btn.setAttribute('data-action', 'windowMaximizerToggle');
    btn.innerHTML = `<i class="fas ${iconClass}"></i>`;

    // Create the click handler
    const clickHandler = (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (!layouter) return;

        if (layouter.appStateMap.has(app)) {
            layouter.restoreApp(app);
        } else {
            layouter.snapApp(app, layouter.calculateZoneRect('full', 'full'));
        }
    };

    // Add tracked button listener to prevent memory leaks
    addTrackedButtonListener(app, btn, clickHandler);

    // Find the best place to insert - before close button if exists, otherwise at end of header
    const closeBtn = header.querySelector('[data-action="close"], .close, .header-button.close');
    if (closeBtn) {
        closeBtn.parentElement.insertBefore(btn, closeBtn);
    } else {
        // Try to find the header controls/buttons container
        const controlsContainer = header.querySelector('.header-controls, .window-controls, .buttons');
        if (controlsContainer) {
            controlsContainer.appendChild(btn);
        } else {
            header.appendChild(btn);
        }
    }

    debugLog('Injected visible button to AppV2 header', app.constructor.name);
});

function patchDraggable() {
    if (!Draggable) {
        console.error("Window Maximizer | Draggable class not found!");
        return;
    }
    const originalMouseMove = Draggable.prototype._onDragMouseMove;
    const originalMouseUp = Draggable.prototype._onDragMouseUp;

    Draggable.prototype._onDragMouseMove = function (event) {
        // Call original first to move the window
        originalMouseMove.call(this, event);

        // Get the application being dragged
        // ApplicationV1 uses this.app, ApplicationV2 might also use this.app
        // In V13, Draggable constructor accepts both Application and ApplicationV2
        const app = this.app;
        if (!app) return;

        if (!layouter) return;

        // Check distance to top
        if (event.clientY < 10) {
            if (!layouter.activeApp) {
                layouter.show(app);
            }
        } else if (layouter.activeApp) {
            // Hide overlay when mouse moves below the overlay area (250px)
            // This provides a responsive auto-hide experience
            const overlayHeight = 250; // Match CSS #window-maximizer-overlay height
            if (event.clientY > overlayHeight) {
                layouter.hide();
            }
        }
    };

    Draggable.prototype._onDragMouseUp = function (event) {
        // If we are over a zone, the zone mouseup handles it usually?
        // But the Draggable might capture the event first or stop propagation.

        // If layouter is active and has a zone, we want that to win.
        if (layouter && layouter.activeApp && layouter.activeZone) {
            // We let the zone's event listener handle it if possible.
            // But if Draggable is on window, it captures globally.

            // Let's manually trigger logic if we are "in"
            // Actually, since the overlay has pointer-events: auto when active,
            // and z-index 99999, it *should* receive the mouseup first if we are over it.
            // So we might not need to do anything here except standard cleanup.
        }

        originalMouseUp.call(this, event);

        // Ensure hidden
        if (layouter && layouter.activeApp && !layouter.activeZone) {
            layouter.hide();
        }
    };
}

/**
 * Adaptive Polling Configuration for Drag Tracking
 * Adjusts polling frequency based on drag speed to optimize CPU usage
 * while maintaining responsiveness during fast movements
 */
const ADAPTIVE_POLLING_CONFIG = {
    MIN_INTERVAL: 50,      // Fastest polling (50ms) - for quick movements
    MAX_INTERVAL: 500,     // Slowest polling (500ms) - for pauses/stopped
    ADJUSTMENT_THRESHOLD: 25, // Minimum interval change to trigger reset
    SPEED_THRESHOLDS: {
        FAST: 2.0,         // Pixels per millisecond - very fast movement
        NORMAL: 0.5,       // Normal movement speed
        SLOW: 0.1          // Slow movement
    }
};

/**
 * Setup ApplicationV2 drag tracking via pointer events
 * ApplicationV2 in Foundry V13 uses a different drag system than AppV1
 * This detects when AppV2 windows are being dragged near the top edge
 *
 * Features adaptive polling interval based on drag speed:
 * - Fast movement (>2.0 px/ms): 50ms interval
 * - Normal movement (>0.5 px/ms): 100ms interval
 * - Slow movement (>0.1 px/ms): 200ms interval
 * - Stopped/paused (<0.1 px/ms): 500ms interval
 */
function setupAppV2DragTracking() {
    let draggingAppV2 = null;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    const DRAG_THRESHOLD = 3; // Minimum pixels to consider it a drag
    let dragCheckInterval = null;

    // Adaptive polling state tracking
    let lastPollTime = 0;
    let lastPollPosition = { x: 0, y: 0 };
    let currentPollInterval = 100; // Start with normal speed interval

    // Track pointer down on AppV2 headers to detect drag start
    addDragTrackedListener(document, 'pointerdown', (event) => {
        // Only respond to primary button (left click)
        if (event.button !== 0) return;

        // Check if clicking on a header button/control - these should NOT trigger drag
        // This prevents drag detection when clicking close, maximize, or other header controls
        const isButton = event.target.closest('button, a, [data-action], .header-control, .header-button, .control, .close');
        if (isButton) {
            debugLog('Ignoring pointerdown on button:', event.target);
            return;
        }

        // Check if clicking on an AppV2 window header (drag handle)
        // Foundry V13 ApplicationV2 structure: <div class="application app-v2"><header>...</header>...</div>
        // Also check for variations in class naming and window-header class
        const header = event.target.closest('header.window-header, .application header, .app-v2 header, [data-appid] header');
        if (!header) return;

        // Find the AppV2 application element
        const appElement = header.closest('.application, [data-appid]');
        if (!appElement) return;

        // Get app ID from the element's dataset
        const appId = appElement.dataset?.appid;

        // Find the actual app instance FIRST
        let foundApp = null;

        // Method 1: Look up by appId in foundry.applications.instances
        if (appId && foundry?.applications?.instances) {
            // The instances Map is keyed by appId (number)
            foundApp = foundry.applications.instances.get(Number(appId));
        }

        // Method 2: If no appId, iterate through instances and match by element
        if (!foundApp && foundry?.applications?.instances) {
            for (const app of foundry.applications.instances.values()) {
                const appEl = app.element instanceof HTMLElement ? app.element : app.element?.[0];
                if (appEl === appElement) {
                    foundApp = app;
                    break;
                }
            }
        }

        // NOW use the reliable isAppV2() method to verify
        if (!foundApp || !layouter || !layouter.isAppV2(foundApp)) {
            debugLog('Not an AppV2 window or app not found, skipping');
            return;
        }

        if (foundApp) {
            draggingAppV2 = foundApp;
            isDragging = false;
            startX = event.clientX;
            startY = event.clientY;
            debugLog('AppV2 drag start detected:', foundApp.constructor.name, 'at', startX, startY);

            // Initialize adaptive polling state
            lastPollTime = Date.now();
            lastPollPosition = { x: event.clientX, y: event.clientY };
            currentPollInterval = 100; // Reset to default

            // Polling will start only after drag threshold is exceeded
            // This reduces CPU usage during normal clicks that don't result in drags
            dragCheckInterval = null;
        }
    }, { capture: true, passive: true });

    /**
     * Adaptive polling function that adjusts its interval based on drag speed
     * This optimizes CPU usage while maintaining responsiveness
     */
    function adaptivePoll() {
        if (!draggingAppV2 || !isDragging) return;

        const now = Date.now();
        const timeDelta = now - lastPollTime;

        // Only calculate speed if we have a valid time delta
        if (timeDelta > 0) {
            const appEl = draggingAppV2.element instanceof HTMLElement ?
                draggingAppV2.element : draggingAppV2.element?.[0];

            if (appEl) {
                // Get current window position
                const rect = appEl.getBoundingClientRect();
                const currentX = rect.left;
                const currentY = rect.top;

                // Calculate distance moved since last poll
                const dx = currentX - lastPollPosition.x;
                const dy = currentY - lastPollPosition.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Calculate speed in pixels per millisecond
                const speed = distance / timeDelta;

                // Determine appropriate interval based on speed
                let newInterval;
                if (speed > ADAPTIVE_POLLING_CONFIG.SPEED_THRESHOLDS.FAST) {
                    // Fast movement - poll more frequently for better responsiveness
                    newInterval = ADAPTIVE_POLLING_CONFIG.MIN_INTERVAL;
                } else if (speed > ADAPTIVE_POLLING_CONFIG.SPEED_THRESHOLDS.NORMAL) {
                    // Normal movement - standard polling
                    newInterval = 100;
                } else if (speed > ADAPTIVE_POLLING_CONFIG.SPEED_THRESHOLDS.SLOW) {
                    // Slow movement - reduce polling frequency
                    newInterval = 200;
                } else {
                    // Nearly stopped - minimal polling to save CPU
                    newInterval = ADAPTIVE_POLLING_CONFIG.MAX_INTERVAL;
                }

                // Restart interval with new timing if changed significantly
                // This prevents excessive interval recreation while allowing adaptive adjustment
                if (Math.abs(newInterval - currentPollInterval) > ADAPTIVE_POLLING_CONFIG.ADJUSTMENT_THRESHOLD) {
                    debugLog(`Adaptive polling: speed=${speed.toFixed(3)}px/ms, interval=${currentPollInterval}ms -> ${newInterval}ms`);

                    // Clear old interval and start new one
                    if (dragCheckInterval) {
                        clearDragTrackedTimer(dragCheckInterval);
                    }
                    currentPollInterval = newInterval;
                    dragCheckInterval = addDragTrackedTimer(setInterval(adaptivePoll, currentPollInterval));
                    return; // Exit early since new interval is running
                }

                // Update tracking state for next poll
                lastPollPosition = { x: currentX, y: currentY };
                lastPollTime = now;

                // Check if window is near top edge
                if (rect.top < 10) {
                    if (layouter && !layouter.activeApp) {
                        debugLog('Showing overlay (via adaptive poll)');
                        layouter.show(draggingAppV2);
                    }
                }
            }
        }
    }

    // Track pointer movement to detect drag near top edge
    addDragTrackedListener(document, 'pointermove', (event) => {
        if (!draggingAppV2) return;

        // Only consider it a drag after moving past the threshold
        // This prevents accidental triggering on small mouse movements
        if (!isDragging) {
            const dx = Math.abs(event.clientX - startX);
            const dy = Math.abs(event.clientY - startY);
            if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
                if (!isDragging) {
                    isDragging = true;
                    debugLog('Drag threshold exceeded, now tracking with adaptive polling');

                    // Start adaptive polling only after drag threshold is exceeded
                    // This optimizes performance by not polling during normal clicks
                    if (!dragCheckInterval) {
                        // Initialize polling state
                        lastPollTime = Date.now();
                        const appEl = draggingAppV2.element instanceof HTMLElement ?
                            draggingAppV2.element : draggingAppV2.element?.[0];
                        if (appEl) {
                            const rect = appEl.getBoundingClientRect();
                            lastPollPosition = { x: rect.left, y: rect.top };
                        }
                        currentPollInterval = 100; // Start with normal speed interval

                        // Start adaptive polling
                        dragCheckInterval = addDragTrackedTimer(setInterval(adaptivePoll, currentPollInterval));
                    }
                }
            } else {
                return;
            }
        }

        // Check distance to top edge of viewport
        if (event.clientY < 10) {
            if (layouter && !layouter.activeApp) {
                debugLog('Showing overlay at clientY:', event.clientY);
                layouter.show(draggingAppV2);
            }
        } else if (layouter && layouter.activeApp) {
            // Hide overlay when mouse moves below the overlay area
            const overlayHeight = 250;
            if (event.clientY > overlayHeight) {
                debugLog('Hiding overlay at clientY:', event.clientY);
                layouter.hide();
            }

            // Manual zone tracking during drag
            // During pointer drag, pointerenter events are not sent to zones
            // So we need to manually check which zone is under the cursor
            if (event.clientY <= overlayHeight) {
                const zoneInfo = layouter.findZoneAtPosition(event.clientX, event.clientY);
                if (zoneInfo) {
                    // Check if zone changed to avoid redundant calls
                    const currentZone = layouter.activeZone;
                    if (!currentZone || currentZone.layoutId !== zoneInfo.layoutId || currentZone.zoneId !== zoneInfo.zoneId) {
                        debugLog('Hovering over zone:', zoneInfo);
                        layouter.activateZone(zoneInfo.layoutId, zoneInfo.zoneId);
                    }
                } else {
                    // Not over a zone, deactivate highlight
                    if (layouter.activeZone) {
                        layouter.deactivateZone();
                    }
                }
            }
        }
    }, { capture: true, passive: true });

    // Track pointer up to end drag
    addDragTrackedListener(document, 'pointerup', (event) => {
        if (draggingAppV2) {
            debugLog('AppV2 drag ended at', event.clientX, event.clientY);

            // Check if we're over a zone using elementFromPoint
            if (layouter && layouter.activeApp) {
                const zoneInfo = layouter.findZoneAtPosition(event.clientX, event.clientY);
                if (zoneInfo) {
                    debugLog('Pointer released over zone:', zoneInfo);
                    const rect = layouter.calculateZoneRect(zoneInfo.layoutId, zoneInfo.zoneId);
                    if (rect) {
                        debugLog('Snapping to zone:', zoneInfo.layoutId, zoneInfo.zoneId, rect);
                        layouter.snapApp(layouter.activeApp, rect, zoneInfo);
                    }
                } else {
                    debugLog('Pointer not over a zone');
                }
            }

            // Ensure overlay is hidden
            if (layouter) {
                layouter.hide();
            }

            draggingAppV2 = null;
            isDragging = false;

            // Clear the interval
            if (dragCheckInterval) {
                clearDragTrackedTimer(dragCheckInterval);
                dragCheckInterval = null;
            }

            // Reset adaptive polling state
            currentPollInterval = 100;
        }
    }, { capture: true, passive: true });

    // Also clean up on pointer cancel
    addDragTrackedListener(document, 'pointercancel', () => {
        if (draggingAppV2) {
            debugLog('AppV2 drag cancelled');

            if (layouter) {
                layouter.hide();
            }
            draggingAppV2 = null;
            isDragging = false;

            // Clear the interval
            if (dragCheckInterval) {
                clearDragTrackedTimer(dragCheckInterval);
                dragCheckInterval = null;
            }

            // Reset adaptive polling state
            currentPollInterval = 100;
        }
    }, { capture: true, passive: true });

    debugLog('AppV2 drag tracking setup complete with adaptive polling');
}

// ============================================================================
// Performance Metrics API
// ============================================================================

/**
 * Hook for retrieving performance metrics programmatically
 * Allows other modules or scripts to access performance data
 * Usage: Hooks.call('windowMaximizerGetMetrics')
 */
Hooks.on('windowMaximizerGetMetrics', () => {
    return layouter ? layouter.getPerformanceMetrics() : null;
});

/**
 * Console API for user and developer access to performance metrics
 * Provides convenient methods to retrieve and reset performance metrics
 *
 * Usage in browser console:
 *   window.windowMaximizer.getMetrics()     // Get current metrics
 *   window.windowMaximizer.resetMetrics()   // Reset all metrics
 *
 * @example
 * // Get current performance metrics
 * const metrics = window.windowMaximizer.getMetrics();
 * console.log('Snaps:', metrics.snapCount);
 * console.log('Restores:', metrics.restoreCount);
 * console.log('Average Drag Time:', metrics.averageDragTime.toFixed(2), 'ms');
 *
 * @example
 * // Reset metrics to start fresh measurements
 * window.windowMaximizer.resetMetrics();
 */
window.windowMaximizer = {
    /**
     * Get current performance metrics from the Window Maximizer module
     * @returns {Object|null} Performance metrics object or null if module not initialized
     *
     * Metrics object contains:
     * - dragCount: Total number of drag operations detected
     * - snapCount: Total number of successful snap operations
     * - restoreCount: Total number of restore operations
     * - overlayShowCount: Total number of overlay display operations
     * - totalDragTime: Accumulated time spent in drag operations (ms)
     * - averageDragTime: Average drag operation time (ms)
     * - lastReset: Timestamp when metrics were last reset
     * - uptime: Time since last reset (ms)
     */
    getMetrics: () => layouter ? layouter.getPerformanceMetrics() : null,

    /**
     * Reset all performance metrics to initial values
     * Useful for starting fresh measurements or for testing scenarios
     */
    resetMetrics: () => {
        if (layouter) {
            layouter.resetPerformanceMetrics();
            console.log('Window Maximizer | Performance metrics reset');
        } else {
            console.warn('Window Maximizer | Layouter not initialized');
        }
    }
};

// ============================================================================
// Unit Tests Export
// ============================================================================

/**
 * Export test functions for running in browser console
 * Tests are defined in tests/window-maximizer.test.js
 *
 * Usage in browser console:
 *   await window.windowMaximizerTests.runAllTests()
 *   await window.windowMaximizerTests.runRegistryTests()
 *   await window.windowMaximizerTests.runLayoutTests()
 */

// Load test file dynamically in browser environment
if (typeof window !== 'undefined' && !window.windowMaximizerTests) {
    // Attempt to load tests from file (works in some environments)
    const testScript = document.createElement('script');
    testScript.src = 'modules/window-maximizer/tests/window-maximizer.test.js';
    testScript.onload = () => {
        console.log('Window Maximizer Tests loaded successfully');
        console.log('Run tests with: await window.windowMaximizerTests.runAllTests()');
    };
    testScript.onerror = () => {
        console.warn('Could not load Window Maximizer Tests from file');
    };
    // Don't auto-append - user can load manually or we can add via hook
    // document.head.appendChild(testScript);
}

// Also export for direct access if tests are already loaded
if (typeof window !== 'undefined' && window.windowMaximizerTests) {
    console.log('Window Maximizer Tests available in console');
    console.log('Run tests with: await window.windowMaximizerTests.runAllTests()');
}

// Node.js export for automated testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SnapLayouter,
        cleanupDragTracking
    };
}
