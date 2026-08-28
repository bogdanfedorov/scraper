async function renderTexts() {
  document.getElementById("title").textContent = await t("optionsTitle");
  document.getElementById("adaptersHeading").textContent = await t("adaptersHeading");
  document.getElementById("languageLabel").textContent = await t("languageLabel");
}

async function render() {
  await renderTexts();

  const languageSelect = document.getElementById("language");
  languageSelect.value = await getLocale();
  languageSelect.addEventListener("change", async () => {
    await setLocale(languageSelect.value);
    await renderTexts();
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
