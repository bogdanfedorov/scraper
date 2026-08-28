// Проста локалізація з ручним перемиканням мови (зберігається в storage.local.locale).
const I18N_STRINGS = {
  uk: {
    optionsTitle: "Vacancies Saver — налаштування",
    adaptersHeading: "Адаптери сайтів",
    languageLabel: "Мова",
    savePathLabel: "Папка для збереження",
    savePathPlaceholder: "dou-vacancies",
    savePathHint: "Зберігається як підпапка всередині папки Завантажень браузера (браузери не дозволяють розширенням писати в довільне місце на диску).",
    backendUrlLabel: "URL бекенда",
    backendUrlPlaceholder: "http://localhost:8080",
    backendUrlHint: "Адреса локального або хмарного vacancy-server.",
    checkConnectionButton: "Перевірити з'єднання",
    checkingConnection: "Перевіряю...",
    connectionOk: "З'єднання успішне ✅",
    connectionError: "Помилка з'єднання",
    saveButton: "💾 Зберегти вакансію в MD",
    saving: "Зберігаю...",
    saved: "Збережено ✅",
    alreadySaved: "Вже збережено ✅",
    changedSaveButton: "♻️ Текст змінився, зберегти знову",
    previewButton: "📂 Показати збережений файл",
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
    backendUrlLabel: "Backend URL",
    backendUrlPlaceholder: "http://localhost:8080",
    backendUrlHint: "Address of the local or cloud vacancy-server.",
    checkConnectionButton: "Check connection",
    checkingConnection: "Checking...",
    connectionOk: "Connection successful ✅",
    connectionError: "Connection error",
    saveButton: "💾 Save vacancy to MD",
    saving: "Saving...",
    saved: "Saved ✅",
    alreadySaved: "Already saved ✅",
    changedSaveButton: "♻️ Text changed, save again",
    previewButton: "📂 Show saved file",
    noContent: "No description found ❌",
    loadMoreButton: "⬇ Load all vacancies",
    loadingMore: (count) => `Loading more (${count})...`,
    doneNoMore: "Done, no more left",
  },
};

const I18N_DEFAULT_LOCALE = "uk";
const DEFAULT_SAVE_PATH = "dou-vacancies";
const DEFAULT_BACKEND_URL = "http://localhost:8080";

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

function sanitizeBackendUrl(url) {
  return String(url || "").trim().replace(/\/+$/, "") || DEFAULT_BACKEND_URL;
}

async function getBackendUrl() {
  const { backendUrl } = await browser.storage.local.get("backendUrl");
  return sanitizeBackendUrl(backendUrl);
}

async function setBackendUrl(url) {
  await browser.storage.local.set({ backendUrl: sanitizeBackendUrl(url) });
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
