import { WindowStateRegistry } from './window-state-registry.js';

// Minimum window size thresholds (in pixels)
const MIN_ZONE_WIDTH = 300;
const MIN_ZONE_HEIGHT = 200;

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

    // 3-column layout (needs at least 3 columns, typically >= 900px)
    if (maxCols >= 3) {
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

    // 4-column layout (needs >= 1920px per acceptance criteria)
    if (screenWidth >= 1920 && maxCols >= 4) {
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

    // 6-column layout (needs >= 2560px per acceptance criteria)
    if (screenWidth >= 2560 && maxCols >= 6) {
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

    // 3x2 grid
    if (maxCols >= 3 && maxRows >= 2) {
        layouts.push({
            id: 'grid-3x2',
            label: '3×2 Grid',
            class: 'layout-grid-3x2',
            cols: 3,
            rows: 2,
            zones: [
                { id: 'tl', col: 0, row: 0 },
                { id: 'tc', col: 1, row: 0 },
                { id: 'tr', col: 2, row: 0 },
                { id: 'bl', col: 0, row: 1 },
                { id: 'bc', col: 1, row: 1 },
                { id: 'br', col: 2, row: 1 }
            ]
        });
    }

    // 4x2 grid (needs >= 1920px wide screen per consistency with 4-column threshold)
    if (screenWidth >= 1920 && maxCols >= 4 && maxRows >= 2) {
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

    // 3-row layout (tall screens >= 1080px per acceptance criteria)
    if (screenHeight >= 1080 && maxRows >= 3) {
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

    // 2x3 grid (tall screens >= 1080px per consistency with 3-row threshold)
    if (screenHeight >= 1080 && maxCols >= 2 && maxRows >= 3) {
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

    // 3x3 grid (large screens: >= 900px wide for 3 cols, >= 1080px tall for 3 rows)
    if (screenHeight >= 1080 && maxCols >= 3 && maxRows >= 3) {
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

export class SnapLayouter {
    constructor() {
        this.overlay = null;
        this.highlight = null;
        this.activeApp = null;
        this.activeZone = null;
        this.layouts = [];
        /** @type {WindowStateRegistry} Global registry for snapped window states */
        this.registry = new WindowStateRegistry();
        this.createOverlay();

        // Recalculate layouts on window resize
        window.addEventListener('resize', () => this.rebuildOverlay());

        // Track window closes to update registry
        this.setupCloseTracking();
    }

    /**
     * Set up hooks to track when snapped windows are closed
     */
    setupCloseTracking() {
        // AppV1 close hook
        Hooks.on('closeApplication', (app, html) => {
            if (this.registry.getState(app)) {
                this.registry.markClosed(app);
            }
        });

        // AppV2 close hook
        Hooks.on('closeApplicationV2', (app, html) => {
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

        // Create highlight rect
        this.highlight = document.createElement('div');
        this.highlight.id = 'window-maximizer-highlight';
        document.body.appendChild(this.highlight);

        // Build the layout options
        this.buildLayoutOptions();
    }

    /**
     * Build layout option elements in the bar based on current screen size
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
                // Add hover listeners to zones
                z.addEventListener('mouseenter', () => this.activateZone(layout.id, zone.id));
                z.addEventListener('mouseleave', () => this.deactivateZone());
                z.addEventListener('mouseup', (e) => this.onZoneDrop(e, layout.id, zone.id));
                opt.appendChild(z);
            });

            bar.appendChild(opt);
        });

        console.log(`Window Maximizer | Built ${this.layouts.length} layouts for ${window.innerWidth}x${window.innerHeight} screen`);
    }

    /**
     * Rebuild the overlay when screen size changes
     */
    rebuildOverlay() {
        this.buildLayoutOptions();
    }

    show(app) {
        this.activeApp = app;
        this.overlay.classList.add('active');
    }

    hide() {
        this.overlay.classList.remove('active');
        this.highlight.style.display = 'none';
        this.activeZone = null;
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
    }

    deactivateZone() {
        // Don't clear immediately to avoid flickering when moving between zones close together?
        // Actually, logic is simpler if we just let the next enter event handle it, 
        // but for now let's clear if we leave the zone completely.
       // this.activeZone = null;
       // this.highlight.style.display = 'none';
    }
    
    onZoneDrop(event, layoutId, zoneId) {
        event.stopPropagation(); // Prevent normal drag drop
        if (!this.activeApp) return;

        const rect = this.calculateZoneRect(layoutId, zoneId);
        if (rect) {
            this.snapApp(this.activeApp, rect, { layoutId, zoneId });
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
        // ApplicationV2 has a different structure - check for typical V2 indicators
        // V2 apps are in foundry.applications namespace and have different position handling
        return app.constructor?.BASE_APPLICATION?.name === 'ApplicationV2' ||
               app.constructor?.name?.endsWith('V2') ||
               (typeof app.position === 'object' && 'left' in app.position && !('_original' in app.position));
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
        // Get original position before snapping
        const pos = app.position;
        const originalPosition = {
            left: pos.left,
            top: pos.top,
            width: pos.width,
            height: pos.height
        };

        // Save state on the app itself (for quick access)
        if (!app._originalState) {
            app._originalState = {
                position: { ...originalPosition },
                width: pos.width,
                height: pos.height
            };
        }

        // Register in the global registry (survives window closes)
        if (!this.registry.getState(app)) {
            this.registry.registerSnap(app, originalPosition, zoneInfo);
        }

        app.setPosition({
            left: rect.x,
            top: rect.y,
            width: rect.w,
            height: rect.h
        });

        // Force header button update if we had one
        app._windowMaximizerState = 'snapped';
        this.updateHeaderButton(app);
    }

    /**
     * Restore a single application to its original position
     * @param {Application|ApplicationV2} app - The application to restore
     */
    restoreApp(app) {
        if (app._originalState) {
            app.setPosition(app._originalState.position);
            delete app._originalState;
            delete app._windowMaximizerState;
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
            // Try to find the open application
            const app = this.findOpenApplication(state.appKey);

            if (app && state.isOpen) {
                // Window is open - restore its position
                app.setPosition(state.originalPosition);
                delete app._originalState;
                delete app._windowMaximizerState;
                this.updateHeaderButton(app);
                restoredOpen++;
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
        }

        // Clear the registry
        this.registry.clearAll();

        const summary = {
            restoredOpen,
            reopened,
            skipped,
            total: states.length
        };

        console.log(`Window Maximizer | Restore All: ${restoredOpen} open restored, ${reopened} reopened, ${skipped} skipped`, summary);

        return summary;
    }

    /**
     * Attempt to re-open a closed document and restore its position
     * @param {Object} state - The saved window state
     * @returns {Promise<Application|ApplicationV2|null>} The reopened application or null
     */
    async reopenDocument(state) {
        if (!state.documentInfo || !state.documentInfo.uuid) {
            console.log(`Window Maximizer | Cannot reopen ${state.appKey}: no document info`);
            return null;
        }

        try {
            // Fetch the document by UUID
            const doc = await fromUuid(state.documentInfo.uuid);
            if (!doc) {
                console.log(`Window Maximizer | Document not found for ${state.documentInfo.uuid} (may have been deleted)`);
                return null;
            }

            // Open the document's sheet with the original position
            const sheet = await doc.sheet.render(true, {
                left: state.originalPosition.left,
                top: state.originalPosition.top,
                width: state.originalPosition.width,
                height: state.originalPosition.height
            });

            console.log(`Window Maximizer | Reopened ${state.documentInfo.documentName}: ${doc.name}`);
            return sheet;
        } catch (error) {
            console.warn(`Window Maximizer | Failed to reopen document ${state.documentInfo.uuid}:`, error);
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

        // Try AppV1 button first (inline header button)
        let btn = el.querySelector('.window-maximizer-btn i');

        // If not found, try AppV2 structure (header controls dropdown)
        if (!btn) {
            // AppV2 uses data-action attribute on buttons in header controls
            btn = el.querySelector('[data-action="windowMaximizerToggle"] i');
        }

        if (btn) {
            if (app._windowMaximizerState) {
                btn.classList.remove('fa-window-maximize');
                btn.classList.add('fa-window-restore');
            } else {
                btn.classList.remove('fa-window-restore');
                btn.classList.add('fa-window-maximize');
            }
        }
    }
}
