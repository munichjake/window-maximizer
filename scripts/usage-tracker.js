/**
 * Local usage tracking for Window Maximizer.
 *
 * Buffers action events locally so we can count per-click usage (which the
 * Savras dedupe layer would otherwise collapse to one ping per viewMode per
 * session) and also capture player activity (which the Savras GM-only gate
 * would otherwise drop).
 *
 * Architecture:
 *   - Every client (player or GM) appends events to its own localStorage buffer.
 *   - Players forward their buffer to the GM via game.socket whenever a GM is
 *     online; on successful emit the player buffer is cleared.
 *   - The GM merges its own events + any forwarded player events into one
 *     localStorage buffer.
 *   - On the next `ready` the GM flushes the full buffer to Savras as a single
 *     `usage-flush` send with the events array as details. The buffer is only
 *     cleared on a successful flush, so network errors don't lose data.
 */

const STORAGE_KEY   = 'window-maximizer:usage-buffer';
const SOCKET_NAME   = 'module.window-maximizer';
const SOCKET_TYPE   = 'wm-usage-events';
const MAX_EVENTS    = 10000;
const MODULE_ID     = 'window-maximizer';
const FLUSH_VIEWMODE = 'usage-flush';

export class UsageTracker {
    #telemetry;
    #buffer = [];
    #isGM = false;
    #ready = false;

    constructor(telemetry) {
        this.#telemetry = telemetry;
    }

    /**
     * Wire up socket listeners and load persisted buffer.
     * Must be called from a `ready` hook — needs game.user and game.socket.
     */
    init() {
        this.#isGM = game.user?.isGM ?? false;
        this.#buffer = this.#load();

        // GM side: accept forwarded player events.
        game.socket.on(SOCKET_NAME, (data) => {
            if (!this.#isGM) return;
            if (data?.type !== SOCKET_TYPE) return;
            if (!Array.isArray(data.events) || data.events.length === 0) return;
            this.#append(data.events);
        });

        // Player side: forward any pending events as soon as a GM is reachable.
        if (!this.#isGM) {
            Hooks.on('userConnected', (user, connected) => {
                if (connected && user?.isGM) this.#forwardToGM();
            });
            if (this.#anyGMOnline()) this.#forwardToGM();
        }

        this.#ready = true;
    }

    /**
     * Record a single action event.
     * @param {string} action   Short identifier (e.g. 'maximize-button-v2-header')
     * @param {object} [details] Additional fields merged into the event
     */
    track(action, details = {}) {
        if (!this.#ready) return;
        if (!this.#telemetryEnabled()) return;

        const now = new Date();
        const event = {
            ts:     now.toISOString(),
            date:   now.toISOString().slice(0, 10),
            action,
            role:   game.user?.role ?? 0,
            isGM:   game.user?.isGM ?? false,
            userId: game.user?.id ?? null,
            ...details,
        };
        this.#append([event]);

        if (!this.#isGM && this.#anyGMOnline()) {
            this.#forwardToGM();
        }
    }

    /**
     * GM-only: push the accumulated buffer to Savras as a single send.
     * Clears the buffer only on successful response.
     */
    async flushToSavras() {
        if (!this.#isGM) return;
        if (this.#buffer.length === 0) return;
        if (!this.#telemetryEnabled()) return;

        // Snapshot first so events that arrive during the fetch aren't lost.
        const snapshot = this.#buffer.slice();
        const details = {
            events:       snapshot,
            eventCount:   snapshot.length,
            bufferedFrom: snapshot[0]?.date ?? null,
            bufferedTo:   snapshot[snapshot.length - 1]?.date ?? null,
        };

        try {
            const result = await this.#telemetry.send(FLUSH_VIEWMODE, { details });
            // send() returns null on failure (opt-out, non-GM, duplicate, network error)
            // and an array (possibly empty) on HTTP 200.
            if (Array.isArray(result)) {
                this.#removeSent(snapshot);
            }
        } catch (err) {
            console.debug('Window Maximizer | UsageTracker flush failed:', err);
        }
    }

    /* -------------------------------------------------- */
    /*  Internals                                         */
    /* -------------------------------------------------- */

    #telemetryEnabled() {
        try {
            return game.settings.get(MODULE_ID, 'telemetryEnabled') === true;
        } catch {
            return false;
        }
    }

    #append(events) {
        for (const ev of events) this.#buffer.push(ev);
        if (this.#buffer.length > MAX_EVENTS) {
            this.#buffer.splice(0, this.#buffer.length - MAX_EVENTS);
        }
        this.#save();
    }

    // Stable identity key — survives socket serialize/deserialize round-trips
    // where object identity would otherwise be lost.
    #eventKey(ev) {
        return `${ev.ts}|${ev.action}|${ev.userId ?? ''}`;
    }

    // Remove exactly the events we snapshotted — anything that arrived mid-flush stays.
    #removeSent(sentEvents) {
        const sentKeys = new Set(sentEvents.map((e) => this.#eventKey(e)));
        this.#buffer = this.#buffer.filter((ev) => !sentKeys.has(this.#eventKey(ev)));
        this.#save();
    }

    #load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    #save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#buffer));
        } catch (err) {
            // Quota exceeded, privacy mode, or storage disabled.
            console.warn('Window Maximizer | UsageTracker save failed:', err);
        }
    }

    #anyGMOnline() {
        return game.users?.some((u) => u?.isGM && u?.active) ?? false;
    }

    #forwardToGM() {
        if (this.#isGM || this.#buffer.length === 0) return;
        if (!this.#telemetryEnabled()) return;
        const snapshot = this.#buffer.slice();
        try {
            game.socket.emit(SOCKET_NAME, { type: SOCKET_TYPE, events: snapshot });
            // Optimistic clear: sockets are fire-and-forget, but losing telemetry
            // is acceptable and holding the buffer forever isn't.
            this.#removeSent(snapshot);
        } catch (err) {
            console.debug('Window Maximizer | UsageTracker forward failed:', err);
        }
    }
}
