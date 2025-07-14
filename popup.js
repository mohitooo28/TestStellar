const STORAGE_KEYS = {
    API_KEY: "gemini_api_key",
};

let apiKeyInput, saveKeyBtn, editKeyBtn, removeKeyBtn;
let noKeySection, keyExistsSection, maskedKey, errorContainer;

document.addEventListener("DOMContentLoaded", async () => {
    initializeElements();
    await loadAPIKeyStatus();
    attachEventListeners();
});

function initializeElements() {
    apiKeyInput = document.getElementById("api-key-input");
    saveKeyBtn = document.getElementById("save-key-btn");
    editKeyBtn = document.getElementById("edit-key-btn");
    removeKeyBtn = document.getElementById("remove-key-btn");
    noKeySection = document.getElementById("no-key-section");
    keyExistsSection = document.getElementById("key-exists-section");
    maskedKey = document.getElementById("masked-key");
    errorContainer = document.getElementById("error-container");
}

async function loadAPIKeyStatus() {
    try {
        const result = await chrome.storage.local.get([STORAGE_KEYS.API_KEY]);
        const hasApiKey = result[STORAGE_KEYS.API_KEY];

        if (hasApiKey) {
            showKeyExistsSection();
            updateMaskedKey(hasApiKey);
        } else {
            showNoKeySection();
        }
    } catch (error) {
        console.error("Error loading API key status:", error);
        showNoKeySection();
    }
}

function showNoKeySection() {
    noKeySection.classList.remove("hidden");
    keyExistsSection.classList.add("hidden");
}

function showKeyExistsSection() {
    noKeySection.classList.add("hidden");
    keyExistsSection.classList.remove("hidden");
}

function updateMaskedKey(apiKey) {
    if (apiKey && apiKey.length > 8) {
        const visible =
            apiKey.substring(0, 4) +
            "••••••••••••" +
            apiKey.substring(apiKey.length - 4);
        maskedKey.textContent = visible;
    } else {
        maskedKey.textContent = "••••••••••••••••••••";
    }
}

function attachEventListeners() {
    saveKeyBtn.addEventListener("click", handleSaveApiKey);
    editKeyBtn.addEventListener("click", handleEditApiKey);
    removeKeyBtn.addEventListener("click", handleRemoveApiKey);

    apiKeyInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            handleSaveApiKey();
        }
    });

    apiKeyInput.addEventListener("input", () => {
        const value = apiKeyInput.value.trim();
        saveKeyBtn.disabled = value.length === 0;
        clearErrors();
    });
}

async function handleSaveApiKey() {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
        showError("Please enter a valid API key");
        return;
    }

    if (!isValidApiKey(apiKey)) {
        showError("Please enter a valid Gemini API key");
        return;
    }

    try {
        saveKeyBtn.textContent = "Saving...";
        saveKeyBtn.disabled = true;

        const isValid = await testApiKey(apiKey);
        if (!isValid) {
            showError("Invalid API key. Please check and try again.");
            return;
        }

        await chrome.storage.local.set({
            [STORAGE_KEYS.API_KEY]: apiKey,
        });

        apiKeyInput.value = "";
        updateMaskedKey(apiKey);
        showKeyExistsSection();
        showSuccess("API key saved successfully!");
    } catch (error) {
        console.error("Error saving API key:", error);
        showError("Failed to save API key. Please try again.");
    } finally {
        saveKeyBtn.textContent = "Save";
        saveKeyBtn.disabled = false;
    }
}

async function handleEditApiKey() {
    try {
        const result = await chrome.storage.local.get([STORAGE_KEYS.API_KEY]);
        const currentKey = result[STORAGE_KEYS.API_KEY];

        apiKeyInput.value = currentKey || "";
        showNoKeySection();
        apiKeyInput.focus();
    } catch (error) {
        console.error("Error loading API key for editing:", error);
        showError("Failed to load API key for editing");
    }
}

async function handleRemoveApiKey() {
    if (!confirm("Are you sure you want to remove the API key?")) {
        return;
    }

    try {
        await chrome.storage.local.remove([STORAGE_KEYS.API_KEY]);
        showNoKeySection();
        showSuccess("API key removed successfully!");
    } catch (error) {
        console.error("Error removing API key:", error);
        showError("Failed to remove API key");
    }
}

function isValidApiKey(apiKey) {
    return apiKey.length >= 20 && /^[A-Za-z0-9_-]+$/.test(apiKey);
}

async function testApiKey(apiKey) {
    try {
        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1/models?key=" + apiKey
        );
        return response.ok;
    } catch (error) {
        console.error("Error testing API key:", error);
        return false;
    }
}

function showError(message) {
    clearErrors();

    const errorElement = document.createElement("div");
    errorElement.className = "error-message";
    errorElement.textContent = message;

    errorContainer.appendChild(errorElement);

    setTimeout(() => {
        clearErrors();
    }, 5000);
}

function clearErrors() {
    if (errorContainer) {
        errorContainer.innerHTML = "";
    }
}

function showSuccess(message) {
    const successElement = document.createElement("div");
    successElement.className = "success-message";
    successElement.style.cssText = `
        background: rgba(0, 247, 255, 0.1);
        border: 1px solid #00f7ff;
        color: #00f7ff;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        margin: 8px 0;
        text-align: center;
    `;
    successElement.textContent = message;

    const container = document.querySelector(".container");
    container.insertBefore(successElement, container.firstChild);

    setTimeout(() => {
        if (successElement.parentNode) {
            successElement.parentNode.removeChild(successElement);
        }
    }, 3000);
}
