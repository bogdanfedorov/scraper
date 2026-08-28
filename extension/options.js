async function render() {
  const list = document.getElementById("list");
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
