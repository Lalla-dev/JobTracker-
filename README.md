# JobTracker

An automated job application tracking workflow. This repository contains the Chrome extension and automation pipeline architecture used to capture job applications directly from web portals (such as LinkedIn and Greenhouse), process them with Gemini AI, and persist them into Supabase with automated submission detection and Row Level Security.

---

## 📁 Project Structure

```text
JobTracker/
├── assets/
│   └── n8n-pipeline.png           # Architectural workflow diagram of the n8n pipeline
├── chrome-extension/              # Chrome extension (Manifest V3)
│   ├── icons/                     # Extension branding icons
│   │   ├── icon.svg               # Vector source logo (briefcase + checkmark)
│   │   ├── icon-16.png            # 16x16 toolbar icon
│   │   ├── icon-48.png            # 48x48 management icon
│   │   └── icon-128.png           # 128x128 Web Store / high-res icon
│   ├── manifest.json              # Extension configuration, permissions & icons
│   ├── popup.html                 # Login screen & job tracking UI
│   ├── popup.js                   # Supabase Auth, JWT dispatch & 5s timeout
│   ├── options.html               # Settings UI (Supabase keys & webhook URLs)
│   ├── options.js                 # Settings persistence via chrome.storage.sync
│   ├── background.js              # Service worker for /thanks success page detection
│   ├── content.js                 # DOM scraper & universal fallback extractor
│   ├── generate_icons.py          # Icon generation & SVG export script
│   └── supabase.js                # Vendored Supabase JavaScript client (UMD)
├── n8n-job-pipeline.json          # Exported n8n workflow definition
├── supabase-rls.sql               # Production Row Level Security (RLS) SQL policies
├── .gitignore
└── README.md
```

---

## 🔒 1. Database Security (Row Level Security)

To guarantee that users can only view, insert, modify, and delete their own job applications, Row Level Security (RLS) is enforced on the `job_applications` table.

The raw SQL script is located in [`supabase-rls.sql`](supabase-rls.sql).

### How to apply:
1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **SQL Editor** > **New Query**.
3. Paste and run the contents of [`supabase-rls.sql`](supabase-rls.sql):

```sql
-- Enable and enforce Row Level Security
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications FORCE ROW LEVEL SECURITY;

-- Policy A: SELECT (Users can only view their own jobs)
CREATE POLICY "Users can view own job applications"
ON public.job_applications
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- Policy B: INSERT (Users can only insert rows with their own user_id)
CREATE POLICY "Users can insert own job applications"
ON public.job_applications
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

-- Policy C: UPDATE (Users can only edit their own jobs)
CREATE POLICY "Users can update own job applications"
ON public.job_applications
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

-- Policy D: DELETE (Users can only remove their own jobs)
CREATE POLICY "Users can delete own job applications"
ON public.job_applications
FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);
```

---

## 🔑 2. Extension Authentication & JWT Flow

The extension integrates `supabase.js` to authenticate users against Supabase Auth:

1. **Login View**: If a user is not logged in, `popup.html` presents an Email and Password login/signup screen.
2. **Session Persistence**: Upon authentication, `popup.js` caches the active session in `chrome.storage.local` under `supabase_session` with an automated async adapter.
3. **JWT Bearer Header**: When saving a job to n8n, `popup.js` captures the user's active Supabase JWT session token and attaches it to the HTTP request:
   ```http
   POST /webhook-test/log-job HTTP/1.1
   Host: localhost:5678
   Authorization: Bearer <supabase_jwt_token>
   Content-Type: application/json
   ```
4. **User Scoping**: The payload includes the authenticated user's UUID (`user_id`), ensuring n8n inserts records directly under that user's identity.
5. **Log Out**: Users can log out at any time from the status pill in the tracking view.

---

## 🏗️ Architecture & Technical Flow

```
[ Job Portal Page (LinkedIn / Greenhouse) ]
                     │
                     ▼
        [ content.js (DOM Scraper) ]
                     │  (Extract title, company, description)
                     ▼
         [ popup.html / popup.js ]
                     │  (Supabase Auth: Session / JWT verification)
                     │  (Dispatches with Authorization: Bearer <token>)
                     │  (Fetch timeout guarded at 5 seconds)
                     ▼
       [ n8n Webhook: /log-job ]
                     │
                     ├──────────────────────────────┐
                     ▼                              ▼
      [ Gemini 2.5 Flash AI ]             [ Supabase Insert ]
      - 1-sentence role summary           - RLS enforced (auth.uid() = user_id)
      - Top 3 technical skills            - Persist AI notes
                     │                              │
                     └──────────────┬───────────────┘
                                    ▼
                         [ Return Supabase Row ID ]
                                    │
                                    ▼
                     [ chrome.storage.local (activeJobId) ]
                                    │
                                    ▼
               [ User Submits Application on Job Site ]
                                    │
                                    ▼
               [ background.js (Tab URL Monitor) ]
                     │  Detects /thanks, /success, etc.
                     ▼
         [ n8n Webhook: /job-success ]
                     │  Updates Supabase status to 'Applied'
                     ▼
            [ Supabase: Row Updated ]
```

---

## 🧠 Gemini AI Integration

The n8n automation pipeline integrates Google's **Gemini 2.5 Flash** model (`models/gemini-2.5-flash`) to parse unformatted job descriptions into structured notes before database insertion:

1. **Input Payload**: `content.js` isolates up to 4,000 characters of the job listing text.
2. **System Prompt**:
   ```text
   You are an expert career assistant. Read the following job description.
   Output a 1-sentence summary of the role, followed by a bulleted list of 
   the top 3 technical skills required. Keep it very concise.
   ```
3. **Output Persistence**: The resulting AI-generated summary and bulleted skills are mapped directly to the `ai_notes` column in the Supabase `job_applications` table.

---

## 🎯 Automated Success Page Detection (`background.js`)

`background.js` operates as a persistent Manifest V3 background service worker:

1. **State Transfer**: When the user saves a job listing, n8n returns the newly created Supabase row ID. `popup.js` stores this in `chrome.storage.local` under `activeJobId`.
2. **Lifecycle Monitoring**: `background.js` listens to `chrome.tabs.onUpdated` events.
3. **URL Pattern Matching**: Once `changeInfo.status === "complete"`, destination URLs are matched against common confirmation paths (`/thanks`, `/thank-you`, `/application-submitted`, `/success`, `submitted=true`, `status=submitted`, `/confirmation`).
4. **Secondary Webhook Dispatch**: When confirmed, the service worker silently dispatches a `POST` request to `/webhook-test/job-success` with `{ job_id: activeJobId, user_id }` and the `Authorization: Bearer <token>` header.
5. **Deduplication**: Once acknowledged, `activeJobId` is removed from `chrome.storage.local`.

---

## ⚙️ Configuration & Options Page

The extension includes a dedicated Settings page (`options.html` / `options.js`):

* **Supabase Configuration**:
  * `supabaseUrl`: Supabase project URL (`https://<project-ref>.supabase.co`).
  * `supabaseAnonKey`: Supabase anonymous public API key.
* **Webhook Endpoints**:
  * `n8nWebhookUrl`: Primary job logging webhook (default: `http://localhost:5678/webhook-test/log-job`).
  * `n8nSuccessWebhookUrl`: Submission confirmation webhook (default: `http://localhost:5678/webhook-test/job-success`).
  * `n8nBaseUrl`: Convenience base URL helper (e.g. `https://n8n.yourdomain.com`).
* **5-Second Fetch Timeout**: Requests are guarded by an `AbortController`. If n8n takes longer than 5 seconds, the request aborts and shows a diagnostic message.

---

## 🎨 Extension Branding & Icon Generation

A minimalist SVG logo is located at [`chrome-extension/icons/icon.svg`](chrome-extension/icons/icon.svg).

### Exporting SVG to PNGs
You can re-generate the required `16x16`, `48x48`, and `128x128` PNG icons at any time using:

```bash
cd chrome-extension
python generate_icons.py
```

---

## 🔄 Automated n8n Pipeline

Below is the visual flow of the automated backend pipeline built in **n8n**:

![n8n Job Processing Pipeline](assets/n8n-pipeline.png)

### Importing the Workflow into n8n:
1. Open n8n.
2. Go to **Workflows** > **Import from File**.
3. Select [`n8n-job-pipeline.json`](n8n-job-pipeline.json).
4. Connect your Supabase and Google Gemini credentials.

---

## 🚀 Getting Started with the Chrome Extension

### 1. Load Extension in Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the `chrome-extension` directory inside this repository (`JobTracker/chrome-extension`).

### 2. Configure Settings
1. Click the gear icon in the extension popup or right-click the extension icon and select **Options**.
2. Enter your **Supabase Project URL** and **Anon Public Key**.
3. Verify your n8n endpoints and click **Save Settings**.

### 3. Usage
1. Open the extension popup and log in with your Supabase credentials (or click Sign Up).
2. Navigate to any job listing on **LinkedIn**, **Greenhouse**, or other portals.
3. Open the extension popup, verify or edit the extracted details, and click **Save to Pipeline**.
4. Submit the application; `background.js` will automatically finalize your application status in Supabase.
