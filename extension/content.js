function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function sanitizeFilename(name) {
  return name.replace(/[\\/*?:"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 150);
}

function htmlToMarkdown(node) {
  let out = "";
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.textContent;
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const tag = child.tagName.toLowerCase();
    switch (tag) {
      case "br":
        out += "\n";
        break;
      case "p":
      case "div":
        out += htmlToMarkdown(child).trim() + "\n\n";
        break;
      case "strong":
      case "b":
        out += `**${htmlToMarkdown(child).trim()}**`;
        break;
      case "em":
      case "i":
        out += `*${htmlToMarkdown(child).trim()}*`;
        break;
      case "a":
        out += `[${htmlToMarkdown(child).trim()}](${child.href})`;
        break;
      case "ul":
      case "ol":
        out += Array.from(child.children)
          .map((li) => `- ${htmlToMarkdown(li).trim()}`)
          .join("\n") + "\n\n";
        break;
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        out += `${"#".repeat(Number(tag[1]))} ${htmlToMarkdown(child).trim()}\n\n`;
        break;
      case "script":
      case "style":
        break;
      default:
        out += htmlToMarkdown(child);
    }
  }
  return out;
}

async function findEnabledAdapter() {
  const adapters = window.SCRAPER_ADAPTERS || [];
  const candidate = adapters.find((a) => {
    try {
      return a.match();
    } catch {
      return false;
    }
  });
  if (!candidate) return null;

  const { disabledAdapters = {} } = await browser.storage.local.get("disabledAdapters");
  if (disabledAdapters[candidate.id]) return null;
  return candidate;
}

async function saveCurrentVacancy(adapter, button) {
  button.disabled = true;
  button.textContent = await t("saving");

  const { filename, content } = adapter.extractVacancy();
  if (!content) {
    button.textContent = await t("noContent");
    button.disabled = false;
    return;
  }

  await browser.runtime.sendMessage({ type: "save", filename, content });
  button.textContent = await t("saved");
  setTimeout(async () => {
    button.textContent = await t("saveButton");
    button.disabled = false;
  }, 1500);
}

function findMoreButton(adapter) {
  return Array.from(document.querySelectorAll("a, button"))
    .find((el) => el.textContent.trim().startsWith(adapter.moreButtonText) && el.offsetParent !== null);
}

async function loadAllVacancies(adapter, button) {
  button.disabled = true;
  let count = 0;
  let btn;
  while ((btn = findMoreButton(adapter))) {
    btn.click();
    count++;
    button.textContent = await t("loadingMore", count);
    await sleep(1200);
  }
  button.textContent = await t("doneNoMore");
  button.disabled = false;
}

async function addButton(adapter) {
  const btn = document.createElement("button");
  btn.style.cssText =
    "position:fixed;top:80px;right:20px;z-index:99999;padding:10px 16px;" +
    "background:#2ecc71;color:#000;border:none;border-radius:6px;cursor:pointer;" +
    "font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.3);";

  if (adapter.isListingPage()) {
    btn.textContent = await t("loadMoreButton");
    btn.addEventListener("click", () => loadAllVacancies(adapter, btn));
  } else {
    btn.textContent = await t("saveButton");
    btn.addEventListener("click", () => saveCurrentVacancy(adapter, btn));
  }

  document.body.appendChild(btn);
}

(async () => {
  const adapter = await findEnabledAdapter();
  if (adapter) await addButton(adapter);
})();
