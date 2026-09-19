# JobTracker

An automated job application tracking workflow. This repository contains the Chrome extension and components used to capture job applications directly from web portals (such as LinkedIn and Greenhouse) and forward them to an automated pipeline.

---

## 📁 Project Structure

```text
JobTracker/
├── chrome-extension/         # Chrome extension (Manifest V3)
│   ├── manifest.json         # Extension configuration & permissions
│   ├── popup.html            # Popup UI
│   ├── popup.js              # Popup logic & n8n webhook dispatcher
│   └── content.js            # DOM scraper & universal fallback extractor
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started with the Chrome Extension

### 1. Load Extension in Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the `chrome-extension` directory inside this repository (`JobTracker/chrome-extension`).

### 2. Configure Endpoint
By default, the extension dispatches job payloads to your local n8n automation pipeline:
```text
http://localhost:5678/webhook-test/log-job
```
To adjust this endpoint, update `API_URL` in [popup.js](chrome-extension/popup.js).

### 3. Usage
1. Open any job listing on **LinkedIn** or **Greenhouse** (or any company career page).
2. Click the **Job Application Tracker** extension icon from the toolbar.
3. Verify or edit the extracted **Job Title** and **Company Name**.
4. Click **Save to Pipeline** to dispatch the application details and job description to your pipeline.
