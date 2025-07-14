chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "ask-teststellar",
        title: "Ask TestStellar",
        contexts: ["selection"],
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "ask-teststellar" && info.selectionText) {
        await handleMCQQuery(info.selectionText, tab.id);
    }
});

async function handleMCQQuery(selectedText, tabId) {
    try {
        const result = await chrome.storage.local.get(["gemini_api_key"]);
        const apiKey = result.gemini_api_key;

        if (!apiKey) {
            showNotification(
                "API Key Required",
                "Please configure your Gemini API key in the extension popup."
            );
            return;
        }

        const answer = await getGeminiAnswer(selectedText, apiKey);

        if (answer) {
            showNotification("TestStellar Answer", answer);
        } else {
            showNotification(
                "Error",
                "Could not process the question. Please try again."
            );
        }
    } catch (error) {
        console.error("Error processing MCQ query:", error);
        showNotification(
            "Error",
            "An error occurred while processing your request."
        );
    }
}

async function getGeminiAnswer(questionText, apiKey) {
    const modelNames = ["gemini-2.0-flash", "gemini-1.5-flash"];

    for (const modelName of modelNames) {
        try {
            const result = await tryGeminiModel(
                questionText,
                apiKey,
                modelName
            );
            if (result) {
                console.log(`✅ Successfully used model: ${modelName}`);
                return result;
            }
        } catch (error) {
            console.warn(`❌ Failed with model ${modelName}:`, error.message);

            if (
                error.message.includes("429") ||
                error.message.includes("quota") ||
                error.message.includes("limit") ||
                error.message.includes("RESOURCE_EXHAUSTED")
            ) {
                console.log(
                    `🔄 Rate limit detected with ${modelName}, trying fallback...`
                );
                continue;
            }

            continue;
        }
    }

    console.error("❌ All model attempts failed");
    return null;
}

async function tryGeminiModel(questionText, apiKey, modelName) {
    try {
        const cleanedText = cleanQuestionText(questionText);
        const prompt = createMCQPrompt(cleanedText);

        const generationConfig = getOptimizedConfig(modelName);

        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            text: prompt,
                        },
                    ],
                },
            ],
            generationConfig,
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error(
                `API Response Error for ${modelName}:`,
                response.status,
                errorText
            );

            let errorMessage = `API request failed: ${response.status}`;
            try {
                const errorData = JSON.parse(errorText);
                if (errorData.error && errorData.error.message) {
                    errorMessage += ` - ${errorData.error.message}`;
                }
            } catch (e) {
                errorMessage += ` - ${errorText}`;
            }

            throw new Error(errorMessage);
        }

        const data = await response.json();

        console.log(
            `Gemini API Response for ${modelName}:`,
            JSON.stringify(data, null, 2)
        );

        if (data.error) {
            console.error("Gemini API Error:", data.error);
            throw new Error(
                `Gemini API Error: ${data.error.message || "Unknown error"}`
            );
        }

        if (data.candidates && data.candidates.length > 0) {
            const candidate = data.candidates[0];

            if (candidate.finishReason === "MAX_TOKENS") {
                console.warn("Response was truncated due to token limit");
                throw new Error("Token limit exceeded, trying fallback model");
            }

            if (
                candidate.content &&
                candidate.content.parts &&
                candidate.content.parts.length > 0
            ) {
                const answer = candidate.content.parts[0].text.trim();
                return extractAnswerOnly(answer);
            } else if (candidate.content && !candidate.content.parts) {
                console.error(
                    "Response content missing parts array:",
                    candidate.content
                );
                throw new Error(
                    "Invalid response format, trying fallback model"
                );
            }
        }

        console.error("Unexpected response structure:", data);
        return null;
    } catch (error) {
        console.error(`Error calling Gemini API with ${modelName}:`, error);
        throw error;
    }
}

function getOptimizedConfig(modelName) {
    if (modelName === "gemini-2.0-flash") {
        return {
            temperature: 0.1,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 30,
            candidateCount: 1,
        };
    } else if (modelName === "gemini-1.5-flash") {
        return {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 30,
            candidateCount: 1,
        };
    }

    return {
        temperature: 0.2,
        topK: 32,
        topP: 1,
        maxOutputTokens: 30,
    };
}

function cleanQuestionText(text) {
    let cleaned = text.replace(/\s+/g, " ").trim();

    cleaned = cleaned.replace(/^(Question|Q\.|Q\d+\.?\s*)/i, "");

    cleaned = cleaned.replace(/(\d+)\s*\^\s*(\d+)/g, "$1^$2");
    cleaned = cleaned.replace(/(\d+)\s*(st|nd|rd|th)\b/g, "$1$2");
    cleaned = cleaned.replace(/\s*\?\s*$/g, "");

    if (!cleaned.includes("?") && !cleaned.match(/[.!]$/)) {
        cleaned += "?";
    }

    return cleaned;
}

function createMCQPrompt(questionText) {
    return `You are a concise solver for aptitude and technical MCQ questions.

Rules:
- If options (A, B, C, D, E) are provided, ONLY reply with the correct option in format: "D: page"
- Do NOT explain your answer.
- Use the given options to infer missing characters or unclear question parts.
- If NO options are given, respond with a one-word or one-line direct answer only.

Question:
${questionText}

Answer:`;
}

function extractAnswerOnly(response) {
    let cleaned = response.trim();

    cleaned = cleaned.replace(
        /^(Answer:|The answer is|Correct answer is|Option|Choice)\s*:?\s*/i,
        ""
    );

    const mcqMatch = cleaned.match(/^([A-E])\s*:\s*(.+)/i);
    if (mcqMatch) {
        const letter = mcqMatch[1].toUpperCase();
        const content = mcqMatch[2].trim();
        return `${letter}: ${content}`;
    }

    const singleLetterMatch = cleaned.match(/^([A-E])\b/i);
    if (singleLetterMatch) {
        return singleLetterMatch[1].toUpperCase();
    }

    const letterAtStart = cleaned.match(/^([A-E])[\s\.\)\-]\s*(.+)/i);
    if (letterAtStart) {
        const letter = letterAtStart[1].toUpperCase();
        const content = letterAtStart[2].trim();
        return `${letter}: ${content}`;
    }

    cleaned = cleaned.split(
        /\b(because|since|as|explanation|reasoning|note|therefore)\b/i
    )[0];
    cleaned = cleaned.split("\n")[0];
    cleaned = cleaned.trim();

    if (/^[A-E]$/i.test(cleaned)) {
        return cleaned.toUpperCase();
    }

    return cleaned;
}

function showNotification(title, message) {
    chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: title,
        message: message,
        priority: 2,
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "checkApiKey") {
        chrome.storage.local.get(["gemini_api_key"]).then((result) => {
            sendResponse({ hasApiKey: !!result.gemini_api_key });
        });
        return true;
    }
});

chrome.action.onClicked.addListener((tab) => {});
