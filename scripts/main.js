import { SnapLayouter } from './snap-layouter.js';

let layouter;

Hooks.once('ready', () => {
    console.log('Window Maximizer | Ready Hook Fired');
    layouter = new SnapLayouter();

    // Patch Draggable
    patchDraggable();
    console.log('Window Maximizer | Draggable Patched');
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
Hooks.on('getHeaderControlsApplicationV2', (app, controls) => {
    console.log('Window Maximizer | Adding button to AppV2', app.constructor.name);
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

        // Check if we are dragging an Application
        if (!this.app) return;

        // Check distance to top
        if (event.clientY < 10) {
            if (!layouter.activeApp) {
                layouter.show(this.app);
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
