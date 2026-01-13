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
        onClick: () => {
            if (!layouter) return;

            if (!layouter.hasSnappedWindows()) {
                ui.notifications.info('No snapped windows to restore.');
                return;
            }

            const summary = layouter.restoreAll();
            ui.notifications.info(`Restored ${summary.restoredOpen} window(s) to original positions.`);
        }
    });
});

// Legacy Application (AppV1) header buttons hook
Hooks.on('getApplicationHeaderButtons', (app, buttons) => {
    console.log('Window Maximizer | Adding button to AppV1', app.constructor.name);
    // Check if we already have it
    if (buttons.some(b => b.label === "Maximize")) return;

    buttons.unshift({
        label: "Maximize",
        class: "window-maximizer-btn",
        icon: "fas fa-window-maximize",
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

    controls.push({
        icon: "fas fa-window-maximize",
        label: "Maximize",
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
        } else if (event.clientY > 150) {
            // If we pulled away far enough, hide it
            // verify we aren't hovering the overlay
            // Actually, the overlay mouseleave handles this usually, but purely by coord:
            if (layouter.activeApp && !layouter.activeZone) {
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
