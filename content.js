(function () {
    'use strict';

    const CONFIG = {
        MIN_LEN: 10,
        MAX_LEN: 5000,
        DEBOUNCE_MS: 120,
        OVERLAY_TTL: 1800,
        MAX_INDICATOR_HEIGHT: 800,
        COOLDOWN_MS: 250,
        MAX_RANGES: 5,
        RECENT_HASH_LIMIT: 5,
        ENABLE_FORCE_SELECT: true,
        ENABLE_RIGHT_CLICK: true,
        ENABLE_FOCUS_LOCK: true
    };

    const STATE = {
        active: true,
        debounceTimer: null,
        lastHash: null,
        overlayHash: null,
        lastSentAt: 0,
        recentHashes: [],
        overlayTimers: [],
        indicatorTimers: [],
        focusLock: true,
        selectionFreedom: true,
        patterns: [
            /(?:^|\n)\s*[A-E][\.\)]\s+\S+/i,
            /which\s+of\s+the\s+following/i,
            /choose\s+(?:the\s+)?(?:best|correct|right)/i,
            /select\s+(?:the\s+)?(?:best|correct|appropriate)/i,
            /option\s*[A-E]/i
        ]
    };

    const PREFILTER = /[A-E][\.)]|which\s+of\s+the\s+following|choose\s|select\s|option\s*[A-E]/i;

    function hasRuntime() {
        return typeof chrome !== 'undefined' && chrome?.runtime?.sendMessage;
    }

    function hashText(str) { 
        if (!str) return 0;
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
        }
        return h;
    }

    function isMCQ(text) {
        if (!text || text.length < CONFIG.MIN_LEN) return false;
        if (text.length > CONFIG.MAX_LEN) return false;
        if (!PREFILTER.test(text)) return false;
        return STATE.patterns.some(r => r.test(text));
    }

    function ensureStyles() {
        if (document.getElementById('teststellar-base-styles') || !document.head) return;
        const s = document.createElement('style');
        s.id = 'teststellar-base-styles';
        s.textContent = `
            html, body, main, article, section, div, p, span, li, td, th, pre, code {
                user-select: text !important;
                -webkit-user-select: text !important;
            }
            #teststellar-selection-override { display: none; }
            .teststellar-selection-overlay {
                position: absolute; pointer-events: none; z-index: 99999;
                background: rgba(0,247,255,0.15); border-radius: 2px;
                box-shadow: 0 0 0 1px rgba(0,247,255,0.35) inset;
            }
            .teststellar-processing { outline: 2px solid rgba(0,247,255,0.6); outline-offset: 2px; }
        `;
        document.head.appendChild(s);
    }

    // Right Click 
    function neutralizeHandlers(el) {
        if (!el) return;
        try {
            el.onselectstart = null; el.oncontextmenu = null; el.ondragstart = null; el.onmousedown = null;
            const cs = getComputedStyle(el);
            if (cs.userSelect === 'none' || cs.webkitUserSelect === 'none') {
                el.style.setProperty('user-select','text','important');
                el.style.setProperty('-webkit-user-select','text','important');
            }
        } catch { /* ignore */ }
    }

    let nodeObserver = null;
    function observeNewNodes() {
        if (nodeObserver || !document.body) return;
        nodeObserver = new MutationObserver(muts => {
            if (!STATE.selectionFreedom) return;
            for (const m of muts) {
                m.addedNodes.forEach(n => { if (n.nodeType === 1) neutralizeHandlers(n); });
            }
        });
        nodeObserver.observe(document.body, { childList: true, subtree: true });
    }

    function applySelectionFreedom() {
        if (!STATE.selectionFreedom) return;
        if (CONFIG.ENABLE_FORCE_SELECT && !document.getElementById('teststellar-selection-override')) {
            const o = document.createElement('style');
            o.id = 'teststellar-selection-override';
            o.textContent = `* { -webkit-user-select: text !important; user-select: text !important; -webkit-touch-callout: default !important; }`;
            document.head.appendChild(o);
        }
        if (CONFIG.ENABLE_RIGHT_CLICK) {
            ['contextmenu','selectstart','mousedown','mouseup','dragstart'].forEach(type => {
                document.addEventListener(type, (e) => {
                    if (!STATE.selectionFreedom) return;
                    e.stopPropagation();
                    if (type === 'contextmenu' || type === 'selectstart') e.stopImmediatePropagation();
                }, true);
            });
        }
        Array.from(document.querySelectorAll('body, body *')).slice(0, 2000).forEach(neutralizeHandlers);
        observeNewNodes();
    }

    // Focus Lock
    let originalFocusEl = null;
    function initFocusLock() {
        if (!STATE.focusLock || !CONFIG.ENABLE_FOCUS_LOCK) return;
        originalFocusEl = document.activeElement || null;
        document.addEventListener('focusout', handlePotentialFocusLoss, true);
        document.addEventListener('blur', handlePotentialFocusLoss, true);
        window.addEventListener('blur', () => {
            if (!STATE.focusLock) return;
            setTimeout(() => { try { window.focus(); restoreFocus(); } catch {} }, 25);
        });
        document.addEventListener('click', e => { originalFocusEl = e.target; }, true);
    }

    function handlePotentialFocusLoss() { if (STATE.focusLock) setTimeout(restoreFocus, 15); }

    function restoreFocus() {
        if (!STATE.focusLock) return;
        if (!originalFocusEl || !document.contains(originalFocusEl)) return;
        const current = document.activeElement;
        if (!current || current === document.body || current === document.documentElement) {
            try { originalFocusEl.focus({ preventScroll: true }); } catch {}
        }
    }

    function clearOverlays() {
        document.querySelectorAll('.teststellar-selection-overlay').forEach(el => el.remove());
        STATE.overlayHash = null;
        STATE.overlayTimers.forEach(t => clearTimeout(t));
        STATE.overlayTimers.length = 0;
    }

    function drawOverlayForSelection(sel, hash) {
        if (STATE.overlayHash === hash) return; 
        clearOverlays();
        if (!sel || !sel.rangeCount) return;
        const count = Math.min(sel.rangeCount, CONFIG.MAX_RANGES);
        const render = () => {
            for (let i = 0; i < count; i++) {
                const range = sel.getRangeAt(i);
                const rects = range.getClientRects();
                for (const r of rects) {
                    if (r.width === 0 || r.height === 0) continue;
                    const o = document.createElement('div');
                    o.className = 'teststellar-selection-overlay';
                    o.style.left = (r.left + window.scrollX) + 'px';
                    o.style.top = (r.top + window.scrollY) + 'px';
                    o.style.width = r.width + 'px';
                    o.style.height = r.height + 'px';
                    document.body.appendChild(o);
                    const timer = setTimeout(() => o.remove(), CONFIG.OVERLAY_TTL);
                    STATE.overlayTimers.push(timer);
                }
            }
            STATE.overlayHash = hash;
        };
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => render(), { timeout: 100 });
        } else {
            render();
        }
    }

    function removeProcessingIndicator() {
        document.querySelectorAll('.teststellar-processing').forEach(el => el.classList.remove('teststellar-processing'));
    }

    function boundedTarget(el) {
        let cur = el && el.nodeType === 1 ? el : null;
        while (cur && cur !== document.body) {
            const rect = cur.getBoundingClientRect?.();
            if (rect && rect.height < CONFIG.MAX_INDICATOR_HEIGHT) return cur;
            cur = cur.parentElement;
        }
        return el && el.nodeType === 1 ? el : document.body;
    }

    function addProcessingIndicator(target) {
        removeProcessingIndicator();
        const t = boundedTarget(target);
        if (!t) return;
        t.classList.add('teststellar-processing');
        const timer = setTimeout(() => t.classList.remove('teststellar-processing'), 2500);
        STATE.indicatorTimers.push(timer);
    }

    function sendSelection(text, hash) {
        if (!hasRuntime()) return;
        const now = Date.now();
        if (now - STATE.lastSentAt < CONFIG.COOLDOWN_MS) return; 
        if (STATE.lastHash === hash) return; 
        if (STATE.recentHashes.includes(hash)) return; 
        STATE.lastHash = hash;
        STATE.lastSentAt = now;
        STATE.recentHashes.push(hash);
        if (STATE.recentHashes.length > CONFIG.RECENT_HASH_LIMIT) {
            STATE.recentHashes.shift();
        }
        chrome.runtime.sendMessage({
            action: 'prepareSelection',
            text,
            timestamp: now,
            url: location.href
        });
    }

    chrome.runtime?.onMessage?.addListener?.((req, _sender, sendResponse) => {
        switch (req.action) {
            case 'getSelection': {
                const sel = window.getSelection();
                const text = sel ? sel.toString().trim() : '';
                sendResponse?.({ text, isValid: isMCQ(text) });
                break; }
            case 'clearHighlights':
                clearOverlays();
                removeProcessingIndicator();
                sendResponse?.({ success: true });
                break;
            case 'showProcessing': {
                const sel = window.getSelection();
                if (sel && sel.rangeCount) addProcessingIndicator(sel.getRangeAt(0).commonAncestorContainer);
                sendResponse?.({ success: true });
                break; }
            case 'toggleActive':
                STATE.active = !STATE.active;
                if (!STATE.active) { clearOverlays(); removeProcessingIndicator(); }
                sendResponse?.({ active: STATE.active });
                break;
            case 'setActive':
                STATE.active = !!req.value;
                if (!STATE.active) { clearOverlays(); removeProcessingIndicator(); }
                sendResponse?.({ active: STATE.active });
                break;
            case 'updatePatterns': {
                const invalid = [];
                if (Array.isArray(req.patterns)) {
                    const compiled = [];
                    for (const p of req.patterns) {
                        try { compiled.push(new RegExp(p, 'i')); }
                        catch { invalid.push(p); }
                    }
                    if (compiled.length) STATE.patterns = compiled;
                }
                sendResponse?.({ patternCount: STATE.patterns.length, invalid });
                break; }
            case 'getStatus': {
                sendResponse?.({
                    active: STATE.active,
                    patternCount: STATE.patterns.length,
                    config: {
                        MIN_LEN: CONFIG.MIN_LEN,
                        MAX_LEN: CONFIG.MAX_LEN,
                        DEBOUNCE_MS: CONFIG.DEBOUNCE_MS,
                        OVERLAY_TTL: CONFIG.OVERLAY_TTL,
                        COOLDOWN_MS: CONFIG.COOLDOWN_MS,
                        focusLock: STATE.focusLock,
                        selectionFreedom: STATE.selectionFreedom
                    }
                });
                break; }
            case 'toggleFocusLock':
                STATE.focusLock = !STATE.focusLock;
                if (STATE.focusLock) { initFocusLock(); }
                sendResponse?.({ focusLock: STATE.focusLock });
                break;
            case 'setFocusLock':
                STATE.focusLock = !!req.value;
                if (STATE.focusLock) { initFocusLock(); }
                sendResponse?.({ focusLock: STATE.focusLock });
                break;
            case 'toggleSelectionFreedom':
                STATE.selectionFreedom = !STATE.selectionFreedom;
                if (STATE.selectionFreedom) applySelectionFreedom();
                sendResponse?.({ selectionFreedom: STATE.selectionFreedom });
                break;
            case 'setSelectionFreedom':
                STATE.selectionFreedom = !!req.value;
                if (STATE.selectionFreedom) applySelectionFreedom();
                sendResponse?.({ selectionFreedom: STATE.selectionFreedom });
                break;
            default: break;
        }
    });

    function processSelection() {
        if (!STATE.active) return;
        const sel = window.getSelection();
        const text = sel ? sel.toString().trim() : '';
        if (!text) { clearOverlays(); return; }
        if (text.length < CONFIG.MIN_LEN || text.length > CONFIG.MAX_LEN) { clearOverlays(); return; }
        if (!isMCQ(text)) { clearOverlays(); return; }
        const h = hashText(text);
        drawOverlayForSelection(sel, h);
        sendSelection(text, h);
    }

    function debouncedProcess() {
        if (STATE.debounceTimer) clearTimeout(STATE.debounceTimer);
        STATE.debounceTimer = setTimeout(processSelection, CONFIG.DEBOUNCE_MS);
    }

    function setup() {
        ensureStyles();
    if (CONFIG.ENABLE_FORCE_SELECT || CONFIG.ENABLE_RIGHT_CLICK) applySelectionFreedom();
    if (CONFIG.ENABLE_FOCUS_LOCK) initFocusLock();
        document.addEventListener('selectionchange', debouncedProcess, true);
        document.addEventListener('contextmenu', (e) => {
            const sel = window.getSelection();
            const text = sel ? sel.toString().trim() : '';
            if (isMCQ(text)) addProcessingIndicator(e.target.closest('p,div,span,td,li') || e.target);
        }, true);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) { clearOverlays(); removeProcessingIndicator(); }
        });
    }

    function teardown() {
        STATE.active = false;
        clearTimeout(STATE.debounceTimer);
        STATE.overlayTimers.forEach(t => clearTimeout(t));
        STATE.indicatorTimers.forEach(t => clearTimeout(t));
        STATE.overlayTimers.length = 0;
        STATE.indicatorTimers.length = 0;
        clearOverlays();
        removeProcessingIndicator();
    if (nodeObserver) { try { nodeObserver.disconnect(); } catch {} }
    }

    window.addEventListener('beforeunload', teardown);
    window.addEventListener('pagehide', teardown);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup);
    } else {
        setup();
    }
})();
