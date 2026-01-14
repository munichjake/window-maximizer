import { SnapLayouter } from './snap-layouter.js';

let layouter;

Hooks.once('ready', () => {
    console.log('Window Maximizer | Ready Hook Fired');
    layouter = new SnapLayouter();

    // Patch Draggable for AppV1 windows
    patchDraggable();
    console.log('Window Maximizer | Draggable Patched');

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
            if (!layouter) return;

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
    console.log('Window Maximizer | Adding button to AppV1', app.constructor.name);
    // Check if we already have it (check both possible labels)
    if (buttons.some(b => b.label === "Maximize" || b.label === "Restore")) return;

    // Check if window is currently snapped
    const isSnapped = !!app._windowMaximizerState;

    buttons.unshift({
        label: isSnapped ? "Restore" : "Maximize",
        class: "window-maximizer-btn",
        icon: isSnapped ? "fas fa-window-restore" : "fas fa-window-maximize",
        onclick: (ev) => {
            if (app._windowMaximizerState) {
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
    console.log('Window Maximizer | Adding button to AppV2 dropdown', app.constructor.name);
    // Check if we already have a maximize control
    if (controls.some(c => c.action === "windowMaximizerToggle")) return;

    // Check if window is currently snapped
    const isSnapped = !!app._windowMaximizerState;

    controls.push({
        icon: isSnapped ? "fas fa-window-restore" : "fas fa-window-maximize",
        label: isSnapped ? "Restore" : "Maximize",
        action: "windowMaximizerToggle",
        visible: true,
        onClick: (event) => {
            if (app._windowMaximizerState) {
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
    // html is the jQuery wrapper or HTMLElement depending on version
    const element = html instanceof HTMLElement ? html : html[0];
    if (!element) return;

    // Check if we already injected our button
    if (element.querySelector('.window-maximizer-appv2-btn')) return;

    // Find the header element - ApplicationV2 uses various structures
    const header = element.querySelector('header, .window-header');
    if (!header) return;

    // Check if window is currently snapped
    const isSnapped = !!app._windowMaximizerState;
    const iconClass = isSnapped ? 'fa-window-restore' : 'fa-window-maximize';
    const title = isSnapped ? 'Restore' : 'Maximize';

    // Create the button
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'window-maximizer-appv2-btn header-control';
    btn.title = title;
    btn.setAttribute('data-action', 'windowMaximizerToggle');
    btn.innerHTML = `<i class="fas ${iconClass}"></i>`;

    btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (app._windowMaximizerState) {
            layouter.restoreApp(app);
        } else {
            layouter.snapApp(app, layouter.calculateZoneRect('full', 'full'));
        }
    });

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

    console.log('Window Maximizer | Injected visible button to AppV2 header', app.constructor.name);
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
        if (layouter.activeApp && layouter.activeZone) {
            // We let the zone's event listener handle it if possible.
            // But if Draggable is on window, it captures globally.

            // Let's manually trigger logic if we are "in"
            // Actually, since the overlay has pointer-events: auto when active,
            // and z-index 99999, it *should* receive the mouseup first if we are over it.
            // So we might not need to do anything here except standard cleanup.
        }

        originalMouseUp.call(this, event);

        // Ensure hidden
        if (layouter.activeApp && !layouter.activeZone) {
            layouter.hide();
        }
    };
}

/**
 * Setup ApplicationV2 drag tracking via pointer events
 * ApplicationV2 in Foundry V13 uses a different drag system than AppV1
 * This detects when AppV2 windows are being dragged near the top edge
 */
function setupAppV2DragTracking() {
    let draggingAppV2 = null;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    const DRAG_THRESHOLD = 5; // Minimum pixels to consider it a drag

    // Track pointer down on AppV2 headers to detect drag start
    document.addEventListener('pointerdown', (event) => {
        // Only respond to primary button (left click)
        if (event.button !== 0) return;

        // Check if clicking on a header button/control - these should NOT trigger drag
        // This prevents drag detection when clicking close, maximize, or other header controls
        const isButton = event.target.closest('button, a, [data-action], .header-control, .header-button, .control, .close');
        if (isButton) return;

        // Check if clicking on an AppV2 window header (drag handle)
        // Foundry V13 ApplicationV2 structure: <div class="application app-v2"><header>...</header>...</div>
        // Also check for variations in class naming
        const header = event.target.closest('.application.app-v2 header, .app-v2 header, [data-appid] header');
        if (!header) return;

        // Find the AppV2 application element
        const appElement = header.closest('.application, [data-appid]');
        if (!appElement) return;

        // Get app ID from the element's dataset or from Foundry's application instances
        const appId = appElement.dataset?.appid;

        // Find the actual app instance
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

        if (foundApp) {
            draggingAppV2 = foundApp;
            isDragging = false;
            startX = event.clientX;
            startY = event.clientY;
            console.log('Window Maximizer | AppV2 drag start detected:', foundApp.constructor.name);
        }
    }, true);

    // Track pointer movement to detect drag near top edge
    document.addEventListener('pointermove', (event) => {
        if (!draggingAppV2) return;

        // Only consider it a drag after moving past the threshold
        // This prevents accidental triggering on small mouse movements
        if (!isDragging) {
            const dx = Math.abs(event.clientX - startX);
            const dy = Math.abs(event.clientY - startY);
            if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
                isDragging = true;
            } else {
                return;
            }
        }

        // Check distance to top edge of viewport
        if (event.clientY < 10) {
            if (!layouter.activeApp) {
                layouter.show(draggingAppV2);
            }
        } else if (layouter.activeApp) {
            // Hide overlay when mouse moves below the overlay area
            const overlayHeight = 250;
            if (event.clientY > overlayHeight) {
                layouter.hide();
            }
        }
    }, true);

    // Track pointer up to end drag
    document.addEventListener('pointerup', (event) => {
        if (draggingAppV2) {
            // Ensure overlay is hidden if we didn't select a zone
            if (layouter.activeApp && !layouter.activeZone) {
                layouter.hide();
            }
            draggingAppV2 = null;
            isDragging = false;
        }
    }, true);

    // Also clean up on pointer cancel
    document.addEventListener('pointercancel', () => {
        if (draggingAppV2) {
            layouter.hide();
            draggingAppV2 = null;
            isDragging = false;
        }
    }, true);

    console.log('Window Maximizer | AppV2 drag tracking setup complete');
}
