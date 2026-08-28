// Проста локалізація з ручним перемиканням мови (зберігається в storage.local.locale).
const I18N_STRINGS = {
  uk: {
    optionsTitle: "Vacancies Saver — налаштування",
    adaptersHeading: "Адаптери сайтів",
    languageLabel: "Мова",
    savePathLabel: "Папка для збереження",
    savePathPlaceholder: "dou-vacancies",
    savePathHint: "Зберігається як підпапка всередині папки Завантажень браузера (браузери не дозволяють розширенням писати в довільне місце на диску).",
    saveButton: "💾 Зберегти вакансію в MD",
    saving: "Зберігаю...",
    saved: "Збережено ✅",
    noContent: "Не знайшов опис ❌",
    loadMoreButton: "⬇ Довантажити всі вакансії",
    loadingMore: (count) => `Довантажую (${count})...`,
    doneNoMore: "Готово, більше немає",
  },
  en: {
    optionsTitle: "Vacancies Saver — settings",
    adaptersHeading: "Site adapters",
    languageLabel: "Language",
    savePathLabel: "Save folder",
    savePathPlaceholder: "dou-vacancies",
    savePathHint: "Saved as a subfolder inside the browser's Downloads folder (extensions can't write to an arbitrary location on disk).",
    saveButton: "💾 Save vacancy to MD",
    saving: "Saving...",
    saved: "Saved ✅",
    noContent: "No description found ❌",
    loadMoreButton: "⬇ Load all vacancies",
    loadingMore: (count) => `Loading more (${count})...`,
    doneNoMore: "Done, no more left",
  },
};

const I18N_DEFAULT_LOCALE = "uk";
const DEFAULT_SAVE_PATH = "dou-vacancies";

function sanitizeSavePath(path) {
  const cleaned = String(path || "")
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.replace(/[\\?:"<>|*]/g, "").trim())
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
  return cleaned || DEFAULT_SAVE_PATH;
}

async function getSavePath() {
  const { savePath } = await browser.storage.local.get("savePath");
  return sanitizeSavePath(savePath);
}

async function setSavePath(path) {
  await browser.storage.local.set({ savePath: sanitizeSavePath(path) });
}

async function getLocale() {
  const { locale } = await browser.storage.local.get("locale");
  return I18N_STRINGS[locale] ? locale : I18N_DEFAULT_LOCALE;
}

async function setLocale(locale) {
  await browser.storage.local.set({ locale });
}

async function t(key, ...args) {
  const locale = await getLocale();
  const value = I18N_STRINGS[locale][key];
  return typeof value === "function" ? value(...args) : value;
}
