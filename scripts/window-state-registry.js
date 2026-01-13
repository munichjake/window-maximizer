/**
 * Registry for tracking snapped window states globally.
 * Stores original positions of snapped windows keyed by application ID.
 * Survives individual window closes to enable restore-all functionality.
 */
export class WindowStateRegistry {
    constructor() {
        /** @type {Map<string, WindowState>} */
        this.states = new Map();
    }

    /**
     * Generate a unique key for an application
     * @param {Application|ApplicationV2} app
     * @returns {string}
     */
    getAppKey(app) {
        // Use appId if available, otherwise use id or a generated key
        return String(app.appId ?? app.id ?? app.constructor.name);
    }

    /**
     * Extract document info from an application for re-opening closed windows
     * @param {Application|ApplicationV2} app
     * @returns {DocumentInfo|null}
     */
    extractDocumentInfo(app) {
        // Try to get the document from the app
        const doc = app.document ?? app.object;
        if (!doc) return null;

        // FoundryVTT documents have uuid and documentName properties
        if (doc.uuid && doc.documentName) {
            return {
                uuid: doc.uuid,
                documentName: doc.documentName
            };
        }

        return null;
    }

    /**
     * Register a window's original state before snapping
     * @param {Application|ApplicationV2} app - The application being snapped
     * @param {Position} originalPosition - The original position before snapping
     * @param {ZoneInfo} zoneInfo - Information about which zone it was snapped to
     */
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
        console.log(`Window Maximizer | Registered snap state for ${key}`, state);
    }

    /**
     * Get the state for a specific application
     * @param {Application|ApplicationV2} app
     * @returns {WindowState|undefined}
     */
    getState(app) {
        const key = this.getAppKey(app);
        return this.states.get(key);
    }

    /**
     * Get state by app key directly
     * @param {string} key
     * @returns {WindowState|undefined}
     */
    getStateByKey(key) {
        return this.states.get(key);
    }

    /**
     * Mark a window as closed (but keep its state for restore-all)
     * @param {Application|ApplicationV2} app
     */
    markClosed(app) {
        const key = this.getAppKey(app);
        const state = this.states.get(key);
        if (state) {
            state.isOpen = false;
            console.log(`Window Maximizer | Marked ${key} as closed`);
        }
    }

    /**
     * Mark a window as open
     * @param {Application|ApplicationV2} app
     */
    markOpen(app) {
        const key = this.getAppKey(app);
        const state = this.states.get(key);
        if (state) {
            state.isOpen = true;
        }
    }

    /**
     * Remove the state for a specific application
     * @param {Application|ApplicationV2} app
     */
    removeState(app) {
        const key = this.getAppKey(app);
        this.states.delete(key);
        console.log(`Window Maximizer | Removed snap state for ${key}`);
    }

    /**
     * Remove state by key directly
     * @param {string} key
     */
    removeStateByKey(key) {
        this.states.delete(key);
    }

    /**
     * Get all registered states
     * @returns {Map<string, WindowState>}
     */
    getAllStates() {
        return this.states;
    }

    /**
     * Get all states as an array
     * @returns {WindowState[]}
     */
    getAllStatesArray() {
        return Array.from(this.states.values());
    }

    /**
     * Check if there are any snapped windows to restore
     * @returns {boolean}
     */
    hasSnappedWindows() {
        return this.states.size > 0;
    }

    /**
     * Get count of snapped windows
     * @returns {number}
     */
    getSnappedCount() {
        return this.states.size;
    }

    /**
     * Get count of currently open snapped windows
     * @returns {number}
     */
    getOpenSnappedCount() {
        let count = 0;
        for (const state of this.states.values()) {
            if (state.isOpen) count++;
        }
        return count;
    }

    /**
     * Get count of closed snapped windows
     * @returns {number}
     */
    getClosedSnappedCount() {
        let count = 0;
        for (const state of this.states.values()) {
            if (!state.isOpen) count++;
        }
        return count;
    }

    /**
     * Clear all registered states (used after restore-all)
     */
    clearAll() {
        const count = this.states.size;
        this.states.clear();
        console.log(`Window Maximizer | Cleared ${count} snap states`);
    }
}

/**
 * @typedef {Object} Position
 * @property {number} left - X position
 * @property {number} top - Y position
 * @property {number} width - Width
 * @property {number} height - Height
 */

/**
 * @typedef {Object} ZoneInfo
 * @property {string} layoutId - The layout ID (e.g., 'split-2', 'grid-2x2')
 * @property {string} zoneId - The zone ID within the layout (e.g., 'left', 'tl')
 */

/**
 * @typedef {Object} DocumentInfo
 * @property {string} uuid - The document UUID for re-opening
 * @property {string} documentName - The document type (e.g., 'Actor', 'Item', 'JournalEntry')
 */

/**
 * @typedef {Object} WindowState
 * @property {string} appKey - Unique key for this application
 * @property {string} appClass - The application class name
 * @property {Position} originalPosition - Position before snapping
 * @property {ZoneInfo} zoneInfo - Which zone the window was snapped to
 * @property {DocumentInfo|null} documentInfo - Document info for re-opening (if applicable)
 * @property {number} snappedAt - Timestamp when snapped
 * @property {boolean} isOpen - Whether the window is currently open
 */
