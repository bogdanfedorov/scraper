async function renderTexts() {
  document.getElementById("title").textContent = await t("optionsTitle");
  document.getElementById("adaptersHeading").textContent = await t("adaptersHeading");
  document.getElementById("languageLabel").textContent = await t("languageLabel");
  document.getElementById("savePathLabel").textContent = await t("savePathLabel");
  document.getElementById("savePath").placeholder = await t("savePathPlaceholder");
  document.getElementById("savePathHint").textContent = await t("savePathHint");
  document.getElementById("backendUrlLabel").textContent = await t("backendUrlLabel");
  document.getElementById("backendUrl").placeholder = await t("backendUrlPlaceholder");
  document.getElementById("backendUrlHint").textContent = await t("backendUrlHint");
  document.getElementById("checkConnection").textContent = await t("checkConnectionButton");
}

async function checkConnection(url, dot, message) {
  dot.className = "dot";
  message.textContent = await t("checkingConnection");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    let response;
    try {
      response = await fetch(`${url}/health`, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    dot.className = "dot dot-ok";
    message.textContent = await t("connectionOk");
  } catch (err) {
    dot.className = "dot dot-error";
    message.textContent = `${await t("connectionError")}: ${err.message}`;
  }
}

async function render() {
  await renderTexts();

  const languageSelect = document.getElementById("language");
  languageSelect.value = await getLocale();
  languageSelect.addEventListener("change", async () => {
    await setLocale(languageSelect.value);
    await renderTexts();
  });

  const savePathInput = document.getElementById("savePath");
  savePathInput.value = await getSavePath();
  savePathInput.addEventListener("change", async () => {
    await setSavePath(savePathInput.value);
    savePathInput.value = await getSavePath();
  });

  const backendUrlInput = document.getElementById("backendUrl");
  backendUrlInput.value = await getBackendUrl();
  backendUrlInput.addEventListener("change", async () => {
    await setBackendUrl(backendUrlInput.value);
    backendUrlInput.value = await getBackendUrl();
  });

  const connectionDot = document.getElementById("connectionDot");
  const connectionMessage = document.getElementById("connectionMessage");
  document.getElementById("checkConnection").addEventListener("click", () => {
    checkConnection(sanitizeBackendUrl(backendUrlInput.value), connectionDot, connectionMessage);
  });

  const list = document.getElementById("list");
  list.innerHTML = "";
  const { disabledAdapters = {} } = await browser.storage.local.get("disabledAdapters");

  for (const adapter of window.SCRAPER_ADAPTERS) {
    const label = document.createElement("label");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !disabledAdapters[adapter.id];
    checkbox.addEventListener("change", async () => {
      const { disabledAdapters = {} } = await browser.storage.local.get("disabledAdapters");
      disabledAdapters[adapter.id] = !checkbox.checked;
      await browser.storage.local.set({ disabledAdapters });
    });

    label.appendChild(checkbox);
    label.append(adapter.label);
    list.appendChild(label);
  }
}

render();
