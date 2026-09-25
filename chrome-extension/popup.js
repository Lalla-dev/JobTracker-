const DEFAULT_WEBHOOK_URL = "http://localhost:5678/webhook-test/log-job";
const STORAGE_KEY = "jobApplication";
const SESSION_KEY = "supabase_session";
const REQUEST_TIMEOUT_MS = 5000;

let jobDescription = "";
let supabaseClient = null;

// Custom asynchronous storage adapter for Supabase using chrome.storage.local
const chromeStorageAdapter = {
  getItem: async (key) => {
    const res = await chrome.storage.local.get([key]);
    return res[key] ?? null;
  },
  setItem: async (key, value) => {
    await chrome.storage.local.set({ [key]: value });
  },
  removeItem: async (key) => {
    await chrome.storage.local.remove([key]);
  }
};

/**
 * Initializes or returns the existing Supabase JS client.
 */
function initSupabase(supabaseUrl, supabaseAnonKey) {
  if (!supabaseUrl || !supabaseAnonKey || typeof window.supabase?.createClient !== "function") {
    return null;
  }
  if (!supabaseClient) {
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: chromeStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    });
  }
  return supabaseClient;
}

/**
 * Opens extension options page.
 */
function openOptions() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL("options.html"));
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Elements - Views
  const loginView = document.getElementById("loginView");
  const trackView = document.getElementById("trackView");

  // Elements - Login View
  const authEmailInput = document.getElementById("authEmail");
  const authPasswordInput = document.getElementById("authPassword");
  const loginBtn = document.getElementById("loginBtn");
  const signupBtn = document.getElementById("signupBtn");
  const authStatus = document.getElementById("authStatus");
  const supabaseWarning = document.getElementById("supabaseWarning");
  const openSettingsLink = document.getElementById("openSettingsLink");
  const loginSettingsBtn = document.getElementById("loginSettingsBtn");

  // Elements - Track View
  const userEmailSpan = document.getElementById("userEmailSpan");
  const logoutBtn = document.getElementById("logoutBtn");
  const trackSettingsBtn = document.getElementById("trackSettingsBtn");
  const titleInput = document.getElementById("jobTitle");
  const companyInput = document.getElementById("companyName");
  const saveBtn = document.getElementById("saveBtn");
  const statusDiv = document.getElementById("status");

  // Settings navigation triggers
  [loginSettingsBtn, trackSettingsBtn, openSettingsLink].forEach((btn) => {
    if (btn) btn.addEventListener("click", openOptions);
  });

  // 1. Fetch user configuration
  const config = await chrome.storage.sync.get([
    "supabaseUrl",
    "supabaseAnonKey",
    "n8nWebhookUrl",
    "n8nBaseUrl"
  ]);

  const client = initSupabase(config.supabaseUrl, config.supabaseAnonKey);

  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    if (supabaseWarning) supabaseWarning.style.display = "block";
  }

  // 2. Check for active session
  let activeSession = null;

  if (client) {
    try {
      const { data } = await client.auth.getSession();
      activeSession = data?.session || null;
    } catch (err) {
      console.warn("Failed to retrieve live Supabase session:", err);
    }
  }

  if (!activeSession) {
    const localStore = await chrome.storage.local.get([SESSION_KEY]);
    activeSession = localStore[SESSION_KEY] || null;
  }

  if (activeSession && activeSession.access_token) {
    showTrackView(activeSession);
  } else {
    showLoginView();
  }

  // 3. Switch View Functions
  function showLoginView() {
    trackView.style.display = "none";
    loginView.style.display = "block";
    authStatus.textContent = "";
  }

  function showTrackView(session) {
    loginView.style.display = "none";
    trackView.style.display = "block";
    const email = session.user?.email || "Authenticated User";
    userEmailSpan.textContent = email;
    triggerScrape();
  }

  // 4. Tab Scraper Dispatcher
  async function triggerScrape() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: "scrapeJob" }, (response) => {
        if (chrome.runtime.lastError || !response) {
          chrome.storage.local.get([STORAGE_KEY], (res) => {
            const cached = res[STORAGE_KEY];
            if (cached) {
              titleInput.value = cached.title || "";
              companyInput.value = cached.company || "";
              jobDescription = cached.description || "";
            }
          });
          return;
        }
        titleInput.value = response.title || "";
        companyInput.value = response.company || "";
        jobDescription = response.description || "";
      });
    }
  }

  // 5. Auth Handlers
  loginBtn.addEventListener("click", async () => {
    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value;

    if (!email || !password) {
      authStatus.style.color = "#f59e0b";
      authStatus.textContent = "Please provide both email and password.";
      return;
    }

    if (!client) {
      authStatus.style.color = "#ef4444";
      authStatus.textContent = "Supabase not configured. Click settings above.";
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = "Signing In...";
    authStatus.style.color = "#94a3b8";
    authStatus.textContent = "Authenticating with Supabase...";

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      const sessionData = {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        user: {
          id: data.user.id,
          email: data.user.email
        }
      };

      await chrome.storage.local.set({ [SESSION_KEY]: sessionData });
      showTrackView(sessionData);
    } catch (err) {
      authStatus.style.color = "#ef4444";
      authStatus.textContent = err.message || "Failed to sign in.";
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "Log In";
    }
  });

  signupBtn.addEventListener("click", async () => {
    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value;

    if (!email || !password) {
      authStatus.style.color = "#f59e0b";
      authStatus.textContent = "Please provide both email and password.";
      return;
    }

    if (!client) {
      authStatus.style.color = "#ef4444";
      authStatus.textContent = "Supabase not configured. Click settings above.";
      return;
    }

    signupBtn.disabled = true;
    signupBtn.textContent = "Creating Account...";
    authStatus.style.color = "#94a3b8";
    authStatus.textContent = "Registering user in Supabase...";

    try {
      const { data, error } = await client.auth.signUp({
        email,
        password
      });

      if (error) throw error;

      if (data.session) {
        const sessionData = {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
          user: {
            id: data.user.id,
            email: data.user.email
          }
        };
        await chrome.storage.local.set({ [SESSION_KEY]: sessionData });
        showTrackView(sessionData);
      } else {
        authStatus.style.color = "#10b981";
        authStatus.textContent = "Account created! Please check your email to confirm, then log in.";
      }
    } catch (err) {
      authStatus.style.color = "#ef4444";
      authStatus.textContent = err.message || "Failed to create account.";
    } finally {
      signupBtn.disabled = false;
      signupBtn.textContent = "Sign Up";
    }
  });

  logoutBtn.addEventListener("click", async () => {
    if (client) {
      try {
        await client.auth.signOut();
      } catch (err) {
        console.warn("Sign out warning:", err);
      }
    }
    await chrome.storage.local.remove([SESSION_KEY]);
    showLoginView();
  });

  // 6. Save Application Pipeline with JWT Bearer Token
  saveBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Retrieve active session token
    let session = null;
    if (client) {
      try {
        const { data } = await client.auth.getSession();
        session = data?.session || null;
      } catch (_) {}
    }
    if (!session) {
      const stored = await chrome.storage.local.get([SESSION_KEY]);
      session = stored[SESSION_KEY] || null;
    }

    if (!session?.access_token) {
      statusDiv.style.color = "#ef4444";
      statusDiv.textContent = "Session expired. Please sign in again.";
      setTimeout(showLoginView, 1200);
      return;
    }

    const payload = {
      title: titleInput.value.trim(),
      company: companyInput.value.trim(),
      url: tab?.url || "",
      description: jobDescription,
      savedAt: new Date().toISOString(),
      user_id: session.user?.id
    };

    if (!payload.title || !payload.company) {
      statusDiv.style.color = "#f59e0b";
      statusDiv.textContent = "Please fill in both fields.";
      return;
    }

    // Determine target webhook URL
    let targetUrl = config.n8nWebhookUrl;
    if (!targetUrl && config.n8nBaseUrl) {
      targetUrl = `${config.n8nBaseUrl.replace(/\/+$/, "")}/webhook-test/log-job`;
    } else if (!targetUrl) {
      targetUrl = DEFAULT_WEBHOOK_URL;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Sending...";
    statusDiv.style.color = "#94a3b8";
    statusDiv.textContent = "Sending to n8n + AI...";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}: ${res.statusText}`);
      }

      const n8nResponse = await res.json();
      const rowId = Array.isArray(n8nResponse) ? n8nResponse[0]?.id : n8nResponse?.id;
      if (rowId) {
        chrome.storage.local.set({ activeJobId: rowId });
      }

      statusDiv.style.color = "#10b981";
      statusDiv.textContent = "Saved successfully!";
      setTimeout(() => window.close(), 1200);
    } catch (err) {
      clearTimeout(timeoutId);
      statusDiv.style.color = "#ef4444";

      if (err.name === "AbortError") {
        statusDiv.textContent = "Request timed out (>5s). Check if n8n is running.";
      } else if (err.message && err.message.includes("Failed to fetch")) {
        statusDiv.textContent = "Could not reach n8n server. Is it online?";
      } else {
        statusDiv.textContent = err.message || "Failed to save.";
      }
      console.error("Save error:", err);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save to Pipeline";
    }
  });
});