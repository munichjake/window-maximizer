/**
 * SavrasLib - Anonymous usage telemetry for FoundryVTT modules.
 *
 * Drop this file into your module and instantiate at load time.
 * Hooks are registered automatically — no manual init() calls needed.
 * Then call send(viewMode) whenever a tracked view is opened.
 *
 * Extends the telemetry pattern with support for custom detail payloads
 * (stored as JSONB on the backend) and optional startup messages.
 *
 * No dependencies. No personal data. Fully opt-out.
 */

export class SavrasLib {

  /** @type {string} */             #moduleId;
  /** @type {string} */             #telemetryUrl;
  /** @type {boolean} */            #consentDefault;
  /** @type {string|null} */        #startupMessage;
  /** @type {Set<string>} */        #sentThisSession = new Set();
  /** @type {boolean} */            #popupShownThisSession = false;
  /** @type {string|undefined} */   #contentLanguage;
  /** @type {Set<string>} */        #reportedThisSession = new Set();

  /**
   * @param {object}  opts
   * @param {string}  opts.moduleId          FoundryVTT module ID
   * @param {string}  opts.telemetryUrl      Backend endpoint URL
   * @param {boolean} [opts.consentDefault=true]  Telemetry on by default?
   * @param {string|null} [opts.startupMessage=null]  Optional message logged on init()
   */
  constructor({ moduleId, telemetryUrl, consentDefault = true, startupMessage = null }) {
    if (!moduleId || typeof moduleId !== 'string') {
      throw new Error('SavrasLib: moduleId is required and must be a non-empty string');
    }
    if (!telemetryUrl || typeof telemetryUrl !== 'string') {
      throw new Error('SavrasLib: telemetryUrl is required and must be a non-empty string');
    }

    this.#moduleId       = moduleId;
    this.#telemetryUrl   = telemetryUrl;
    this.#consentDefault = consentDefault;
    this.#startupMessage = startupMessage;

    // Auto-register Foundry hooks — just instantiate and forget.
    Hooks.once('init',  () => this.registerSettings());
    Hooks.once('ready', () => this.init());
  }

  /* -------------------------------------------------- */
  /*  Public API                                        */
  /* -------------------------------------------------- */

  /**
   * Register FoundryVTT module settings.
   * Call once inside `Hooks.once('init')` so settings exist before the ready hook.
   */
  registerSettings() {
    try {
      game.settings.register(this.#moduleId, 'telemetryEnabled', {
        name: 'Anonymous Usage Statistics',
        hint: 'When enabled, this module sends anonymous usage statistics '
            + '(no personal data) to help the developer understand which features '
            + 'are used. You can opt out at any time by unchecking this box. '
            + 'Data collected: Foundry version, game system, module version, '
            + 'language settings, and which view was opened. '
            + 'No IP addresses or personal information are stored.\n\n'
            + 'Wenn aktiviert, sendet dieses Modul anonyme Nutzungsstatistiken '
            + '(keine persoenlichen Daten), um dem Entwickler zu helfen zu verstehen, '
            + 'welche Funktionen genutzt werden. Du kannst jederzeit abwaehlen, indem '
            + 'du dieses Kaestchen deaktivierst.',
        scope:   'world',
        config:  true,
        type:    Boolean,
        default: this.#consentDefault,
      });

      game.settings.register(this.#moduleId, 'telemetryInstanceId', {
        scope:   'world',
        config:  false,
        type:    String,
        default: '',
      });

      game.settings.register(this.#moduleId, 'telemetryDismissedMessages', {
        scope:   'world',
        config:  false,
        type:    String,
        default: '{}',
      });
    } catch (err) {
      console.debug(`SavrasLib | ${this.#moduleId} | registerSettings failed:`, err);
    }
  }

  /**
   * Runtime initialization. Call once inside `Hooks.once('ready')`.
   * Generates instance ID if missing, logs startup message, and sends a startup ping.
   */
  init() {
    try {
      // Lazily generate a stable instance ID on first access.
      if (!game.settings.get(this.#moduleId, 'telemetryInstanceId')) {
        game.settings.set(this.#moduleId, 'telemetryInstanceId', crypto.randomUUID());
      }

      if (this.#startupMessage) {
        console.log(`SavrasLib | ${this.#moduleId} | ${this.#startupMessage}`);
      }

      // Install automatic error catching (once per SavrasLib instance).
      this.#installErrorHandlers();

      // Send startup telemetry ping
      this.send('startup');
    } catch (err) {
      console.debug(`SavrasLib | ${this.#moduleId} | Init failed:`, err);
    }
  }

  /**
   * Check if a message has been dismissed (by message ID, stored per module version).
   * @param {number} messageId
   * @returns {boolean}
   */
  #isMessageDismissed(messageId) {
    try {
      const raw = game.settings.get(this.#moduleId, 'telemetryDismissedMessages');
      const dismissed = JSON.parse(raw || '{}');
      const mod = game.modules.get(this.#moduleId);
      const currentVersion = mod?.version ?? 'unknown';
      // Dismissed if stored version matches current module version
      return dismissed[messageId] === currentVersion;
    } catch {
      return false;
    }
  }

  /**
   * Mark one or more messages as dismissed for the current module version.
   * @param {number|number[]} messageIds  Single ID or array of IDs
   */
  #dismissMessages(messageIds) {
    try {
      const ids = Array.isArray(messageIds) ? messageIds : [messageIds];
      const raw = game.settings.get(this.#moduleId, 'telemetryDismissedMessages');
      const dismissed = JSON.parse(raw || '{}');
      const mod = game.modules.get(this.#moduleId);
      const version = mod?.version ?? 'unknown';
      for (const id of ids) dismissed[id] = version;
      game.settings.set(this.#moduleId, 'telemetryDismissedMessages', JSON.stringify(dismissed));
    } catch (err) {
      console.debug(`SavrasLib | ${this.#moduleId} | Failed to dismiss messages:`, err);
    }
  }

  /**
   * Send a message telemetry event (shown / interaction) to the backend.
   * @param {string} eventType   'shown' or 'interaction'
   * @param {number} messageId
   * @param {object} [extra]     Additional fields for interactions (buttonLabel, dismissed, durationMs)
   */
  #sendMessageTelemetry(eventType, messageId, extra = {}) {
    try {
      const mod = game.modules.get(this.#moduleId);
      const payload = {
        type:           eventType,
        messageId,
        instanceId:     game.settings.get(this.#moduleId, 'telemetryInstanceId'),
        moduleId:       this.#moduleId,
        moduleVersion:  mod?.version ?? 'unknown',
        userRole:       game.user.role,
        foundryVersion: game.version,
        systemId:       game.system.id,
        ...extra,
      };
      const url = this.#telemetryUrl.replace(/\/telemetry\/?$/, '/message-telemetry');
      fetch(url, {
        method:    'POST',
        headers:   { 'Content-Type': 'application/json' },
        body:      JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Non-critical — silently ignore
    }
  }

  /**
   * Escape a string for safe insertion into HTML.
   * Uses the browser's own text-node escaping to neutralise any markup.
   * @param {string} str
   * @returns {string}
   */
  #escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Display a single FoundryVTT dialog popup with merged content from multiple messages.
   * Messages are shown newest first. All unique buttons across messages are collected.
   *
   * @param {object[]} messages  Array of message objects (already filtered, newest first)
   */
  #showPopup(messages) {
    try {
      if (!messages.length) return;

      const checkboxId = `savras-dismiss-${this.#moduleId}`;
      const messageIds = messages.map((m) => m.id);
      const shownAt = Date.now();

      // Send 'shown' telemetry for each message
      for (const id of messageIds) {
        this.#sendMessageTelemetry('shown', id);
      }

      // Use the first (newest) message's title as the dialog title
      const dialogTitle = this.#escapeHtml(messages[0].title);

      // Merge content: each message gets its own section, newest first
      const mergedContent = messages.map((m) => {
        const heading = messages.length > 1 ? `<h3 style="margin:0.5em 0 0.3em;">${this.#escapeHtml(m.title)}</h3>` : '';
        return `${heading}<div>${m.content}</div>`;
      }).join('<hr style="border:0; border-top:1px solid rgba(128,128,128,0.3); margin:0.8em 0;">');

      // Collect unique buttons across all messages (deduplicate by label+url)
      const seenButtons = new Set();
      const allButtons = [];
      for (const m of messages) {
        const btnList = Array.isArray(m.buttons) && m.buttons.length > 0 ? m.buttons : [{ label: 'OK' }];
        for (const btn of btnList) {
          const key = `${btn.label || 'OK'}|${btn.url || ''}`;
          if (!seenButtons.has(key)) {
            seenButtons.add(key);
            allButtons.push(btn);
          }
        }
      }

      // Build dialog buttons
      const dialogButtons = {};
      allButtons.forEach((btn, i) => {
        dialogButtons[`btn${i}`] = {
          label: btn.label || 'OK',
          callback: (html) => {
            const checkbox = html.find ? html.find(`#${checkboxId}`)[0] : html.querySelector(`#${checkboxId}`);
            const isDismissed = checkbox?.checked ?? false;
            const durationMs = Date.now() - shownAt;
            if (isDismissed) {
              this.#dismissMessages(messageIds);
            }
            for (const id of messageIds) {
              this.#sendMessageTelemetry('interaction', id, {
                buttonLabel: btn.label || 'OK',
                dismissed: isDismissed,
                durationMs,
              });
            }
            if (btn.url) window.open(btn.url, '_blank', 'noopener');
          },
        };
      });

      new Dialog({
        title: dialogTitle,
        content: `
          <div style="max-height:66vh; overflow-y:auto;">${mergedContent}</div>
          <hr>
          <label style="display:flex; align-items:center; gap:0.4em; cursor:pointer; font-size:0.9em; opacity:0.85;">
            <input type="checkbox" id="${checkboxId}">
            Don't show this again until the next update
          </label>`,
        buttons: dialogButtons,
        default: 'btn0',
      }).render(true);
    } catch (err) {
      console.debug(`SavrasLib | ${this.#moduleId} | Failed to show popup:`, err);
    }
  }

  /* -------------------------------------------------- */
  /*  Automatic error catching                          */
  /* -------------------------------------------------- */

  /**
   * Install global error handlers that catch unhandled errors and
   * promise rejections, then send crash reports to the backend.
   * Called automatically from init() — the consuming module does nothing.
   */
  #installErrorHandlers() {
    // Use a window-level shared registry so multiple copies of SavrasLib
    // (each bundled into a different module) coordinate properly:
    // - Hook wrapping happens exactly once
    // - Error/rejection listeners are registered once
    // - Each instance registers a handler callback the listeners can invoke
    if (!window.__savrasErrorHandler) {
      window.__savrasErrorHandler = { instances: [], hooks: [] };

      // Track recent Foundry hooks (shared rolling buffer, max 20).
      try {
        const shared = window.__savrasErrorHandler;
        const origCallAll = Hooks.callAll;
        Hooks.callAll = function (hook, ...args) {
          shared.hooks.push(hook);
          if (shared.hooks.length > 20) shared.hooks.shift();
          return origCallAll.call(this, hook, ...args);
        };
        const origCall = Hooks.call;
        Hooks.call = function (hook, ...args) {
          shared.hooks.push(hook);
          if (shared.hooks.length > 20) shared.hooks.shift();
          return origCall.call(this, hook, ...args);
        };
      } catch {
        // If hook wrapping fails, error catching still works — just no hook history.
      }

      // Helper to build a normalised error-info object (avoids duplication
      // between the two listeners below).
      const buildErrorInfo = (message, stack, source = null, line = null, col = null) => ({
        errorMessage: message || 'Unknown error',
        errorStack:   stack || null,
        errorSource:  source,
        errorLine:    line,
        errorColumn:  col,
      });

      // window error — catches synchronous errors.
      // Dispatches to every registered instance whose moduleId matches the source.
      window.addEventListener('error', (event) => {
        const info = buildErrorInfo(
          event.message || String(event.error),
          event.error?.stack,
          event.filename,
          event.lineno,
          event.colno,
        );
        for (const entry of window.__savrasErrorHandler.instances) {
          try { entry.onError(event.filename, event.error, info); } catch { /* silent */ }
        }
      });

      // unhandledrejection — catches async errors.
      window.addEventListener('unhandledrejection', (event) => {
        const err = event.reason;
        const info = buildErrorInfo(err?.message || String(err), err?.stack);
        for (const entry of window.__savrasErrorHandler.instances) {
          try { entry.onError(null, err, info); } catch { /* silent */ }
        }
      });
    }

    // Register this instance's handler callback into the shared registry.
    window.__savrasErrorHandler.instances.push({
      moduleId: this.#moduleId,
      onError: (filename, error, info) => {
        if (this.#isRelevantError(filename, error)) {
          this.#sendErrorReport(info);
        }
      },
    });
  }

  /**
   * Determine if an error is likely related to this module.
   * Checks the stack trace and source URL for the module ID.
   * Also catches errors with no identifiable source (could be ours).
   *
   * @param {string|null} filename  Source file URL from the error event
   * @param {Error|null}  error     The error object
   * @returns {boolean}
   */
  #isRelevantError(filename, error) {
    const modulePattern = this.#moduleId;

    // Check source filename
    if (filename && filename.includes(modulePattern)) return true;

    // Check stack trace
    const stack = error?.stack || '';
    if (stack.includes(modulePattern)) return true;

    // If we can't determine the source, don't report it —
    // we only want errors clearly from our module.
    return false;
  }

  /**
   * Compute a simple hash to fingerprint identical errors.
   * Uses the first 32 hex chars of a SHA-256 of message + first stack frame.
   *
   * @param {string} message
   * @param {string|null} stack
   * @returns {Promise<string>}
   */
  async #computeErrorHash(message, stack) {
    // Extract the first meaningful stack frame for grouping.
    const firstFrame = (stack || '').split('\n').find((l) => l.includes('at ')) || '';
    const raw = `${message}|${firstFrame.trim()}`;
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
    } catch {
      // Fallback: simple string hash.
      let h = 0;
      for (let i = 0; i < raw.length; i++) {
        h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
      }
      return Math.abs(h).toString(16).padStart(16, '0');
    }
  }

  /**
   * Collect full context and send the error report to the backend.
   * Deduplicates by errorHash per session so the same crash isn't sent twice.
   *
   * @param {object} errorInfo
   */
  async #sendErrorReport(errorInfo) {
    try {
      if (!game.settings.get(this.#moduleId, 'telemetryEnabled')) return;

      const errorHash = await this.#computeErrorHash(errorInfo.errorMessage, errorInfo.errorStack);

      // Don't report the same error twice per session.
      if (this.#reportedThisSession.has(errorHash)) return;
      this.#reportedThisSession.add(errorHash);

      const mod = game.modules.get(this.#moduleId);

      // Collect all active modules with their versions.
      const activeModules = [];
      try {
        for (const [id, m] of game.modules) {
          if (m.active) activeModules.push({ id, version: m.version ?? 'unknown' });
        }
      } catch {
        // Non-critical.
      }

      // Current game view / scene info.
      let gameView = null;
      try {
        if (canvas?.scene) {
          gameView = canvas.scene.name || canvas.scene.id || null;
        }
      } catch {
        // Non-critical.
      }

      const payload = {
        instanceId:       game.settings.get(this.#moduleId, 'telemetryInstanceId'),
        moduleId:         this.#moduleId,
        foundryVersion:   game.version,
        systemId:         game.system.id,
        systemVersion:    game.system.version,
        instanceLanguage: game.i18n.lang,
        moduleVersion:    mod?.version ?? 'unknown',
        userRole:         game.user.role,
        errorMessage:     errorInfo.errorMessage?.substring(0, 2000) || 'Unknown error',
        errorStack:       errorInfo.errorStack?.substring(0, 8000) || null,
        errorSource:      errorInfo.errorSource?.substring(0, 500) || null,
        errorLine:        errorInfo.errorLine || null,
        errorColumn:      errorInfo.errorColumn || null,
        errorHash,
        activeModules,
        recentHooks:      [...(window.__savrasErrorHandler?.hooks || [])],
        browserInfo:      navigator.userAgent?.substring(0, 500) || null,
        gameView,
      };

      const url = this.#telemetryUrl.replace(/\/telemetry\/?$/, '/error-report');
      fetch(url, {
        method:    'POST',
        headers:   { 'Content-Type': 'application/json' },
        body:      JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Error reporting must never itself cause visible errors.
    }
  }

  /** Set the content/generation language so it can be included in pings. */
  setContentLanguage(lang) {
    this.#contentLanguage = lang;
  }

  /**
   * Send a telemetry ping for the given view mode.
   * Only fires once per session per viewMode and only for GMs.
   *
   * @param {string} viewMode   Identifier for the view that was opened
   * @param {object} [options={}]
   * @param {string} [options.contentLanguage]  Override content language for this call
   * @param {object} [options.details]          Module-specific custom data, stored as JSONB (e.g. { feature: 'npc-gen', count: 5 })
   * @returns {Promise<{title: string, content: string}|null>} Message object if present, otherwise null
   */
  async send(viewMode, options = {}) {
    try {
      if (!game.settings.get(this.#moduleId, 'telemetryEnabled')) return null;
      if (!(game.user?.isGM || game.user?.role >= 4)) return null;
      if (this.#sentThisSession.has(viewMode)) return null;
      this.#sentThisSession.add(viewMode);

      const mod = game.modules.get(this.#moduleId);

      // Build details: merge viewMode, contentLanguage, and caller-provided details.
      const details = {};
      const cl = options.contentLanguage ?? this.#contentLanguage;
      if (cl) details.contentLanguage = cl;
      if (viewMode) details.viewMode = viewMode;
      if (options.details != null && typeof options.details === 'object' && !Array.isArray(options.details)) {
        Object.assign(details, options.details);
      }

      const payload = {
        instanceId:       game.settings.get(this.#moduleId, 'telemetryInstanceId'),
        moduleId:         this.#moduleId,
        foundryVersion:   game.version,
        systemId:         game.system.id,
        systemVersion:    game.system.version,
        instanceLanguage: game.i18n.lang,
        moduleVersion:    mod?.version ?? 'unknown',
        userRole:         game.user.role,
        details,
      };

      const res = await fetch(this.#telemetryUrl, {
        method:    'POST',
        headers:   { 'Content-Type': 'application/json' },
        body:      JSON.stringify(payload),
        keepalive: true,
      });

      if (!res.ok) return null;

      try {
        const data = await res.json();
        const allMessages = Array.isArray(data?.messages) ? data.messages : [];

        // Filter out messages the user has already dismissed for this version
        const visible = allMessages.filter((m) => m.id && m.title && m.content && !this.#isMessageDismissed(m.id));

        if (visible.length > 0 && !this.#popupShownThisSession) {
          this.#popupShownThisSession = true;
          this.#showPopup(visible);
        }

        return visible;
      } catch {
        return null;
      }

    } catch (err) {
      console.debug(`SavrasLib | ${this.#moduleId} | Telemetry send error:`, err);
      return null;
    }
  }
}

export default SavrasLib;
