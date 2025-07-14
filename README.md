# 🌟 TestStellar - AI Powered MCQ Assistant

<div align="center">
  <img src="icons/logo.svg" alt="TestStellar Logo" width="120" height="120">
  
  **A Chrome extension that uses Google Gemini AI to solve multiple choice questions instantly**
  
  [![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue.svg)](https://chrome.google.com/webstore)
  [![Gemini AI](https://img.shields.io/badge/Gemini-2.0%20Flash-green.svg)](https://ai.google.dev/)
  [![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
  [![Manifest V3](https://img.shields.io/badge/Manifest-V3-red.svg)](https://developer.chrome.com/docs/extensions/mv3/)
  [![License](https://img.shields.io/badge/License-Educational-green.svg)](LICENSE)
</div>

---

## ✨ Features

-   🤖 **Gemini 2.0 Flash AI** - Latest Google AI model for instant MCQ solving
-   🎯 **Right-Click Integration** - Context menu access for selected text
-   🔒 **Secure Local Storage** - API keys stored safely in your browser
-   🌙 **Modern Dark UI** - Beautiful, clean interface design
-   ⚡ **Dual Answer Modes** - Handles MCQ options and direct questions
-   🛡️ **Stealth Operation** - Undetectable by exam monitoring systems
-   📱 **Smart Detection** - Automatically identifies question patterns
-   🔔 **Discrete Notifications** - Clean, professional answer display

## 🏗️ Architecture

```
🧪 TestStellar/
├── 📜 manifest.json          # Chrome extension configuration
├── 🛰️ background.js          # Service worker & API integration
├── 🪟 popup.html             # Main popup interface
├── 🎨 popup.css              # Modern dark theme styling
├── ⚙️ popup.js               # Popup functionality & API key management
├── 🧩 content.js             # Page interaction handler
├── 💅 content.css            # Content script styling
├── 🖼️ logo.svg               # Original vector logo
├── 🖼️ icons/                 # PNG icons for Chrome
│   ├── 🧊 icon16.png         # Toolbar icon
│   ├── 🧊 icon32.png         # Medium size
│   ├── 🧊 icon48.png         # Extension page
│   └── 🧊 icon128.png        # Chrome Web Store
└── 📘 README.md              # Project documentation
```

## 🚀 Installation & Setup

### ⚒️ Prerequisites

-   **Chrome Browser** (Latest version)
-   **Gemini API Key** ([Get yours here](https://makersuite.google.com/app/apikey))

### 🔧 1. Clone the Repository

```bash
# Clone the repo
git clone https://github.com/mohitooo28/TestStellar.git

# Navigate to the project directory
cd TestStellar
```

### 🧩 2. Load Extension in Chrome

1. Open **Chrome** and go to `chrome://extensions/`
2. Enable **Developer Mode** (toggle in the top-right)
3. Click **"Load unpacked"**
4. Select the cloned `TestStellar/` folder
5. You’ll see the TestStellar icon appear in your Chrome toolbar

### 🔐 3. Configure Your API Key

1. Click the **TestStellar icon** in the Chrome toolbar
2. Paste your **Gemini API Key** into the input field
3. Click **Save**
4. A message will confirm: `✓ API Key Configured`

### ⚡ 4. How to Use

1. Open any webpage containing a question
2. Select the question text (with or without options)
3. Right-click the selection → Choose **"Ask TestStellar"**
4. An answer will appear via browser notification

🎉 **Ready!** TestStellar is now active and ready to assist with your questions.

## 💻 TestStellar Usage Walkthrough

https://github.com/user-attachments/assets/6e16fea6-3cb8-4800-b319-c70309001e50

## ⚠️ Important Notes

### Educational Use Only

This extension is designed for **educational purposes** and learning assistance. Users must:

-   ✅ Comply with institution policies
-   ✅ Follow academic integrity guidelines
-   ✅ Use responsibly during practice sessions
-   ❌ Avoid using during actual examinations

### Privacy & Security

-   🔒 **Local Storage**: API keys never leave your browser
-   🛡️ **No Tracking**: Zero data collection or external monitoring
-   🎯 **Minimal Permissions**: Only essential Chrome APIs used
-   🔐 **Secure Communication**: Direct encrypted API calls only

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with 🤖 AI assistance for educational excellence**

[🌟 Star this repo](../../stargazers) • [🐛 Report Bug](../../issues) • [💡 Request Feature](../../issues)

</div>
