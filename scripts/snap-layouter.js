export class SnapLayouter {
    constructor() {
        this.overlay = null;
        this.highlight = null;
        this.activeApp = null;
        this.activeZone = null;
        this.createOverlay();
    }

    createOverlay() {
        // Create the main overlay container
        this.overlay = document.createElement('div');
        this.overlay.id = 'window-maximizer-overlay';
        
        // Create the bar containing layout options
        const bar = document.createElement('div');
        bar.id = 'window-maximizer-bar';
        
        // Define layouts
        const layouts = [
            { id: 'full', class: 'layout-full', zones: [{ id: 'full', style: {} }] },
            { id: 'split', class: 'layout-split', zones: [{ id: 'left', style: {} }, { id: 'right', style: {} }] },
            { id: 'quarters', class: 'layout-quarters', zones: [{ id: 'tl', style: {} }, { id: 'tr', style: {} }, { id: 'bl', style: {} }, { id: 'br', style: {} }] }
        ];

        layouts.forEach(layout => {
            const opt = document.createElement('div');
            opt.className = `layout-option ${layout.class}`;
            opt.dataset.layout = layout.id;
            
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

        this.overlay.appendChild(bar);
        document.body.appendChild(this.overlay);

        // Create highlight rect
        this.highlight = document.createElement('div');
        this.highlight.id = 'window-maximizer-highlight';
        document.body.appendChild(this.highlight);
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
            this.snapApp(this.activeApp, rect);
        }
        this.hide();
    }

    calculateZoneRect(layoutId, zoneId) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        
        // Define margins or sidebar offsets if needed. For now full screen minus UI top?
        const topOffset = 0; // document.getElementById("ui-top")?.offsetHeight || 0;
        
        // Simple logic
        if (layoutId === 'full') {
            return { x: 0, y: 0, w, h };
        }
        if (layoutId === 'split') {
            if (zoneId === 'left') return { x: 0, y: 0, w: w/2, h };
            if (zoneId === 'right') return { x: w/2, y: 0, w: w/2, h };
        }
        if (layoutId === 'quarters') {
            const hw = w/2;
            const hh = h/2;
            if (zoneId === 'tl') return { x: 0, y: 0, w: hw, h: hh };
            if (zoneId === 'tr') return { x: hw, y: 0, w: hw, h: hh };
            if (zoneId === 'bl') return { x: 0, y: hh, w: hw, h: hh };
            if (zoneId === 'br') return { x: hw, y: hh, w: hw, h: hh };
        }
        return null;
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

    snapApp(app, rect) {
        // Save state if not already saved
        if (!app._originalState) {
            const pos = app.position;
            app._originalState = {
                position: { ...pos },
                width: pos.width,
                height: pos.height
            };
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

    restoreApp(app) {
        if (app._originalState) {
            app.setPosition(app._originalState.position);
            delete app._originalState;
            delete app._windowMaximizerState;
            this.updateHeaderButton(app);
        }
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
