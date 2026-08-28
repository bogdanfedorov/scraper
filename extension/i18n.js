// Проста локалізація з ручним перемиканням мови (зберігається в storage.local.locale).
const I18N_STRINGS = {
  uk: {
    optionsTitle: "Vacancies Saver — налаштування",
    adaptersHeading: "Адаптери сайтів",
    languageLabel: "Мова",
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
