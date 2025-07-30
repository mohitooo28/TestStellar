function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
        .teststellar-selection-overlay {
            pointer-events: none !important;
            z-index: 10000 !important;
            border-radius: 2px !important;
            background-color: rgba(0, 247, 255, 0.15) !important;
        }
    `;
    document.head.appendChild(style);
}

function enableTextSelectionAndRightClick() {
    const overrideStyle = document.createElement("style");
    overrideStyle.textContent = `
        * {
            -webkit-user-select: text !important;
            -moz-user-select: text !important;
            -ms-user-select: text !important;
            user-select: text !important;
            -webkit-touch-callout: default !important;
        }
        
        body, html {
            -webkit-user-select: text !important;
            -moz-user-select: text !important;
            -ms-user-select: text !important;
            user-select: text !important;
        }
    `;
    overrideStyle.id = "teststellar-selection-override";
    document.head.appendChild(overrideStyle);

    const protectedEvents = [
        "contextmenu",
        "selectstart",
        "mousedown",
        "mouseup",
        "dragstart",
    ];

    protectedEvents.forEach((eventType) => {
        document.addEventListener(
            eventType,
            function (e) {
                e.stopPropagation();
                if (
                    eventType === "contextmenu" ||
                    eventType === "selectstart"
                ) {
                    e.stopImmediatePropagation();
                }
            },
            true
        );
    });

    setTimeout(() => {
        document.onselectstart = null;
        document.oncontextmenu = null;
        document.ondragstart = null;
        document.onmousedown = null;

        if (document.body) {
            document.body.onselectstart = null;
            document.body.oncontextmenu = null;
            document.body.ondragstart = null;
        }

        const allElements = document.querySelectorAll("*");
        allElements.forEach((element) => {
            try {
                element.onselectstart = null;
                element.oncontextmenu = null;
                element.ondragstart = null;

                const computedStyle = window.getComputedStyle(element);
                if (
                    computedStyle.userSelect === "none" ||
                    computedStyle.webkitUserSelect === "none"
                ) {
                    element.style.setProperty(
                        "-webkit-user-select",
                        "text",
                        "important"
                    );
                    element.style.setProperty(
                        "-moz-user-select",
                        "text",
                        "important"
                    );
                    element.style.setProperty(
                        "-ms-user-select",
                        "text",
                        "important"
                    );
                    element.style.setProperty(
                        "user-select",
                        "text",
                        "important"
                    );
                }
            } catch (e) {
                // Silent fail
            }
        });
    }, 100);

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    try {
                        node.onselectstart = null;
                        node.oncontextmenu = null;
                        node.ondragstart = null;

                        if (node.style) {
                            node.style.setProperty(
                                "-webkit-user-select",
                                "text",
                                "important"
                            );
                            node.style.setProperty(
                                "user-select",
                                "text",
                                "important"
                            );
                        }
                    } catch (e) {
                        // Silent fail
                    }
                }
            });
        });
    });

    if (document.body) {
        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }
}

function preventFocusLoss() {
    let originalFocus = document.activeElement;

    const maintainFocus = () => {
        if (
            document.activeElement &&
            document.activeElement !== originalFocus
        ) {
            if (originalFocus && typeof originalFocus.focus === "function") {
                try {
                    originalFocus.focus();
                } catch (e) {
                    // Silent fail
                }
            }
        }
    };

    document.addEventListener(
        "focusout",
        (e) => {
            setTimeout(maintainFocus, 10);
        },
        true
    );

    document.addEventListener(
        "blur",
        (e) => {
            setTimeout(maintainFocus, 10);
        },
        true
    );

    window.addEventListener("blur", (e) => {
        setTimeout(() => {
            try {
                window.focus();
                if (
                    originalFocus &&
                    typeof originalFocus.focus === "function"
                ) {
                    originalFocus.focus();
                }
            } catch (e) {
                // Silent fail
            }
        }, 10);
    });

    document.addEventListener("click", (e) => {
        originalFocus = e.target;
    });

    setInterval(() => {
        if (document.visibilityState === "visible") {
            try {
                window.focus();
            } catch (e) {
                // Silent fail
            }
        }
    }, 1000);
}

let lastSelectedText = "";
let selectionStartTime = 0;
let isExtensionActive = true;
let processingTimeout = null;

function initialize() {
    if (!isExtensionActive) return;

    injectStyles();
    enableTextSelectionAndRightClick();
    preventFocusLoss();
    setupSelectionHandlers();
    setupContextMenuEnhancement();

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            removeHighlights();
            removeProcessingIndicators();
        }
    });
}

function setupSelectionHandlers() {
    let selectionTimeout;

    document.addEventListener("mouseup", (event) => {
        clearTimeout(selectionTimeout);
        selectionTimeout = setTimeout(() => handleTextSelection(event), 100);
    });

    document.addEventListener("keyup", (event) => {
        clearTimeout(selectionTimeout);
        selectionTimeout = setTimeout(() => handleTextSelection(event), 100);
    });
}

function handleTextSelection(event) {
    if (!isExtensionActive) return;

    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    clearTimeout(processingTimeout);

    if (selectedText && selectedText.length > 10) {
        lastSelectedText = selectedText;

        if (isPotentialMCQ(selectedText)) {
            processingTimeout = setTimeout(() => {
                prepareContextMenu(selectedText);
            }, 200);
        }
    } else {
        removeHighlights();
    }
}

function isPotentialMCQ(text) {
    const mcqIndicators = [
        /[A-E][\.\)]\s*\w+/g,
        /option\s*[A-E]/i,
        /choose\s*(the\s*)?(correct|right|best)/i,
        /which\s*(of\s*the\s*following|one)/i,
        /select\s*(the\s*)?(correct|appropriate)/i,
        /\?\s*[A-E][\.\)]/,
        /(a\)|b\)|c\)|d\)|e\))/i,
    ];

    return mcqIndicators.some((pattern) => pattern.test(text));
}

function highlightSelection(selection) {
    removeHighlights();

    if (!selection || selection.rangeCount === 0) return;

    try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        if (rect.width === 0 || rect.height === 0) return;

        const overlay = document.createElement("div");
        overlay.className = "teststellar-selection-overlay";
        overlay.style.position = "absolute";
        overlay.style.left = rect.left + window.scrollX + "px";
        overlay.style.top = rect.top + window.scrollY + "px";
        overlay.style.width = rect.width + "px";
        overlay.style.height = rect.height + "px";
        overlay.style.backgroundColor = "rgba(0, 247, 255, 0.15)";
        overlay.style.pointerEvents = "none";
        overlay.style.zIndex = "10000";
        overlay.style.borderRadius = "2px";

        document.body.appendChild(overlay);

        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 2000);
    } catch (error) {
        console.log("Highlight error (non-critical):", error);
    }
}

function removeHighlights() {
    const overlays = document.querySelectorAll(
        ".teststellar-selection-overlay"
    );
    overlays.forEach((overlay) => {
        if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    });

    const highlights = document.querySelectorAll(".teststellar-selection");
    highlights.forEach((highlight) => {
        const parent = highlight.parentNode;
        if (parent) {
            while (highlight.firstChild) {
                parent.insertBefore(highlight.firstChild, highlight);
            }
            parent.removeChild(highlight);
            parent.normalize();
        }
    });
}

function prepareContextMenu(selectedText) {
    chrome.runtime.sendMessage({
        action: "prepareSelection",
        text: selectedText,
        timestamp: Date.now(),
        url: window.location.href,
    });
}

function setupContextMenuEnhancement() {
    document.addEventListener("contextmenu", (event) => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (selectedText && isPotentialMCQ(selectedText)) {
            const target =
                event.target.closest("p, div, span, td") || event.target;
            addProcessingIndicator(target);
        }
    });
}

function addProcessingIndicator(element) {
    removeProcessingIndicators();

    if (element) {
        element.classList.add("teststellar-processing");

        setTimeout(() => {
            element.classList.remove("teststellar-processing");
        }, 3000);
    }
}

function removeProcessingIndicators() {
    const processItems = document.querySelectorAll(".teststellar-processing");
    processItems.forEach((item) => {
        item.classList.remove("teststellar-processing");
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case "getSelection":
            const selection = window.getSelection();
            sendResponse({
                text: selection.toString().trim(),
                isValid: isPotentialMCQ(selection.toString().trim()),
            });
            break;

        case "clearHighlights":
            removeHighlights();
            removeProcessingIndicators();
            sendResponse({ success: true });
            break;

        case "showProcessing":
            const currentSelection = window.getSelection();
            if (currentSelection.rangeCount > 0) {
                const range = currentSelection.getRangeAt(0);
                addProcessingIndicator(range.commonAncestorContainer);
            }
            sendResponse({ success: true });
            break;
    }
});

function enhanceTextSelection() {
    let isProcessing = false;

    document.addEventListener("dblclick", (event) => {
        if (isProcessing) return;

        setTimeout(() => {
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();

            if (
                selectedText &&
                selectedText.length > 20 &&
                isPotentialMCQ(selectedText)
            ) {
                isProcessing = true;
                try {
                    expandSelectionForMCQ();
                } catch (error) {
                    console.log(
                        "Selection expansion error (non-critical):",
                        error
                    );
                } finally {
                    setTimeout(() => {
                        isProcessing = false;
                    }, 500);
                }
            }
        }, 50);
    });
}

function expandSelectionForMCQ() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const text = selection.toString();

    if (text.length > 20 && isPotentialMCQ(text)) {
        try {
            expandToIncludeOptions(range);
        } catch (error) {
            console.log("Selection expansion error (non-critical):", error);
        }
    }
}

function expandToIncludeOptions(range) {
    if (!range || !range.commonAncestorContainer) return;

    const container =
        range.commonAncestorContainer.nodeType === Node.TEXT_NODE
            ? range.commonAncestorContainer.parentNode
            : range.commonAncestorContainer;

    const text = container.textContent || "";
    const originalLength = range.endOffset - range.startOffset;

    if (text.length > 5000) return;

    const beforeText = text.substring(0, range.startOffset);
    const afterText = text.substring(range.endOffset);

    const optionPattern = /[A-E][\.\)]\s*[\w\s]+/g;
    const questionPattern = /\?\s*$/;

    let expandStart = range.startOffset;
    if (questionPattern.test(beforeText)) {
        const lines = beforeText.split("\n");
        if (lines.length > 1) {
            expandStart = Math.max(
                0,
                beforeText.lastIndexOf("\n", beforeText.length - 2) + 1
            );
        }
    }

    let expandEnd = range.endOffset;
    const optionMatches = afterText.match(optionPattern);
    if (optionMatches && optionMatches.length >= 2) {
        const lastMatch = optionMatches[optionMatches.length - 1];
        const lastIndex = afterText.indexOf(lastMatch) + lastMatch.length;
        expandEnd = range.endOffset + Math.min(lastIndex, 1000);
    }

    const expandedLength = expandEnd - expandStart;
    if (expandedLength > originalLength && expandedLength < 2000) {
        try {
            const newRange = document.createRange();
            newRange.setStart(container.firstChild || container, expandStart);
            newRange.setEnd(
                container.firstChild || container,
                Math.min(expandEnd, text.length)
            );

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(newRange);
        } catch (error) {
            console.log("Range expansion error (non-critical):", error);
        }
    }
}

window.addEventListener("beforeunload", () => {
    isExtensionActive = false;
    clearTimeout(processingTimeout);
    removeHighlights();
    removeProcessingIndicators();

    const styleOverride = document.getElementById(
        "teststellar-selection-override"
    );
    if (styleOverride) {
        styleOverride.remove();
    }
});

window.addEventListener("pagehide", () => {
    isExtensionActive = false;
    clearTimeout(processingTimeout);
    removeHighlights();
    removeProcessingIndicators();

    const styleOverride = document.getElementById(
        "teststellar-selection-override"
    );
    if (styleOverride) {
        styleOverride.remove();
    }
});

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
} else {
    initialize();
}

enhanceTextSelection();
