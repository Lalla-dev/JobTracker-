const DEFAULT_BASE_URL = "http://localhost:5678";
const DEFAULT_LOG_URL = `${DEFAULT_BASE_URL}/webhook-test/log-job`;
const DEFAULT_SUCCESS_URL = `${DEFAULT_BASE_URL}/webhook-test/job-success`;

document.addEventListener("DOMContentLoaded", () => {
  const supabaseUrlInput = document.getElementById("supabaseUrl");
  const supabaseAnonKeyInput = document.getElementById("supabaseAnonKey");
  const baseUrlInput = document.getElementById("baseUrlInput");
  const applyBaseUrlBtn = document.getElementById("applyBaseUrlBtn");
  const logJobUrlInput = document.getElementById("logJobUrl");
  const successJobUrlInput = document.getElementById("successJobUrl");
  const saveBtn = document.getElementById("saveBtn");
  const resetBtn = document.getElementById("resetBtn");
  const statusMessage = document.getElementById("statusMessage");

  let messageTimeout = null;

  function showStatus(text, type = "success") {
    if (messageTimeout) clearTimeout(messageTimeout);
    statusMessage.textContent = text;
    statusMessage.className = type;
    messageTimeout = setTimeout(() => {
      statusMessage.className = "";
      statusMessage.textContent = "";
    }, 4000);
  }

  // 1. Load saved configuration
  chrome.storage.sync.get(
    [
      "supabaseUrl",
      "supabaseAnonKey",
      "n8nWebhookUrl",
      "n8nSuccessWebhookUrl",
      "n8nBaseUrl"
    ],
    (res) => {
      supabaseUrlInput.value = res.supabaseUrl || "";
      supabaseAnonKeyInput.value = res.supabaseAnonKey || "";
      logJobUrlInput.value = res.n8nWebhookUrl || DEFAULT_LOG_URL;
      successJobUrlInput.value = res.n8nSuccessWebhookUrl || DEFAULT_SUCCESS_URL;
      baseUrlInput.value = res.n8nBaseUrl || DEFAULT_BASE_URL;
    }
  );

  // 2. Quick base URL applicator
  applyBaseUrlBtn.addEventListener("click", () => {
    let base = baseUrlInput.value.trim();
    if (!base) {
      showStatus("Please enter a base URL first.", "error");
      return;
    }
    base = base.replace(/\/+$/, "");
    logJobUrlInput.value = `${base}/webhook-test/log-job`;
    successJobUrlInput.value = `${base}/webhook-test/job-success`;
    showStatus("Endpoint paths updated from Base URL. Click 'Save Settings' to apply.");
  });

  // 3. Save settings
  saveBtn.addEventListener("click", () => {
    const sbUrl = supabaseUrlInput.value.trim().replace(/\/+$/, "");
    const sbKey = supabaseAnonKeyInput.value.trim();
    const logUrl = logJobUrlInput.value.trim();
    const successUrl = successJobUrlInput.value.trim();
    const baseUrl = baseUrlInput.value.trim().replace(/\/+$/, "");

    if (!logUrl || !successUrl) {
      showStatus("Both webhook endpoint URLs are required.", "error");
      return;
    }

    try {
      new URL(logUrl);
      new URL(successUrl);
      if (sbUrl) new URL(sbUrl);
    } catch (_) {
      showStatus("Please enter valid HTTP or HTTPS URLs.", "error");
      return;
    }

    chrome.storage.sync.set(
      {
        supabaseUrl: sbUrl,
        supabaseAnonKey: sbKey,
        n8nWebhookUrl: logUrl,
        n8nSuccessWebhookUrl: successUrl,
        n8nBaseUrl: baseUrl
      },
      () => {
        if (chrome.runtime.lastError) {
          showStatus(`Failed to save settings: ${chrome.runtime.lastError.message}`, "error");
        } else {
          showStatus("Settings saved successfully!");
        }
      }
    );
  });

  // 4. Reset to defaults
  resetBtn.addEventListener("click", () => {
    logJobUrlInput.value = DEFAULT_LOG_URL;
    successJobUrlInput.value = DEFAULT_SUCCESS_URL;
    baseUrlInput.value = DEFAULT_BASE_URL;

    chrome.storage.sync.set(
      {
        n8nWebhookUrl: DEFAULT_LOG_URL,
        n8nSuccessWebhookUrl: DEFAULT_SUCCESS_URL,
        n8nBaseUrl: DEFAULT_BASE_URL
      },
      () => {
        showStatus("Endpoints reset to defaults.");
      }
    );
  });
});
