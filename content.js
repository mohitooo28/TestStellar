function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
        .teststellar-selection {
            background-color: rgba(0, 247, 255, 0.2) !important;
            border-radius: 2px;
            transition: background-color 0.2s ease;
        }
        
        .teststellar-processing {
            position: relative;
        }
        
        .teststellar-processing::after {
            content: "🤖";
            position: absolute;
            top: -20px;
            right: -10px;
            background: linear-gradient(45deg, #00f7ff, #0099cc);
            color: white;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 12px;
            animation: pulse 1s infinite;
            z-index: 10000;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.1); }
        }
    `;
    document.head.appendChild(style);
}

let lastSelectedText = "";
let selectionStartTime = 0;

function initialize() {
    injectStyles();
    setupSelectionHandlers();
    setupContextMenuEnhancement();
}

function setupSelectionHandlers() {
    document.addEventListener("mouseup", handleTextSelection);
    document.addEventListener("keyup", handleTextSelection);
    document.addEventListener("selectionchange", handleSelectionChange);
}

function handleSelectionChange() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText && selectedText.length > 10) {
        lastSelectedText = selectedText;
        selectionStartTime = Date.now();

        if (isPotentialMCQ(selectedText)) {
            highlightSelection(selection);
        }
    } else {
        removeHighlights();
    }
}

function handleTextSelection(event) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText && selectedText.length > 10) {
        if (isPotentialMCQ(selectedText)) {
            prepareContextMenu(selectedText);
        }
    }
}

function isPotentialMCQ(text) {
    const mcqIndicators = [
        /[A-E][\.\)]\s*\w+/g, // Option patterns like "A. option" or "A) option"
        /option\s*[A-E]/i, // "option A", "option B", etc.
        /choose\s*(the\s*)?(correct|right|best)/i, // "choose the correct"
        /which\s*(of\s*the\s*following|one)/i, // "which of the following"
        /select\s*(the\s*)?(correct|appropriate)/i, // "select the correct"
        /\?\s*[A-E][\.\)]/, // Question followed by options
        /(a\)|b\)|c\)|d\)|e\))/i, // Parenthetical options
    ];

    return mcqIndicators.some((pattern) => pattern.test(text));
}

function highlightSelection(selection) {
    try {
        removeHighlights();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const span = document.createElement("span");
            span.className = "teststellar-selection";

            try {
                range.surroundContents(span);
            } catch (e) {
                const contents = range.extractContents();
                span.appendChild(contents);
                range.insertNode(span);
            }
        }
    } catch (error) {
        console.log("Highlight error (non-critical):", error);
    }
}

function removeHighlights() {
    const highlights = document.querySelectorAll(".teststellar-selection");
    highlights.forEach((highlight) => {
        const parent = highlight.parentNode;
        if (parent) {
            parent.replaceChild(
                document.createTextNode(highlight.textContent),
                highlight
            );
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
            addProcessingIndicator(event.target);
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
    document.addEventListener("dblclick", (event) => {
        setTimeout(() => {
            const selection = window.getSelection();
            if (selection.toString().trim()) {
                expandSelectionForMCQ();
            }
        }, 10);
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
    const container = range.commonAncestorContainer;
    const text = container.textContent || "";

    const beforeText = text.substring(0, range.startOffset);
    const afterText = text.substring(range.endOffset);

    const optionPattern = /[A-E][\.\)]\s*\w+/g;

    let expandStart = range.startOffset;
    const questionStarters = /\?\s*$|question\s*\d*[:\.]?\s*$/i;
    const beforeMatch = beforeText.match(questionStarters);
    if (beforeMatch) {
        expandStart = beforeMatch.index + beforeMatch[0].length;
    }

    let expandEnd = range.endOffset;
    const optionMatches = afterText.match(optionPattern);
    if (optionMatches) {
        const lastOptionIndex = afterText.lastIndexOf(
            optionMatches[optionMatches.length - 1]
        );
        if (lastOptionIndex > -1) {
            expandEnd =
                range.endOffset +
                lastOptionIndex +
                optionMatches[optionMatches.length - 1].length;
        }
    }

    if (expandEnd - expandStart > range.endOffset - range.startOffset) {
        range.setStart(container, expandStart);
        range.setEnd(container, Math.min(expandEnd, text.length));
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

window.addEventListener("beforeunload", () => {
    removeHighlights();
    removeProcessingIndicators();
});

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
} else {
    initialize();
}

enhanceTextSelection();
