registerAdapter({
  id: "dou",
  label: "DOU (jobs.dou.ua)",

  match() {
    return /(^|\.)jobs\.dou\.ua$/.test(location.hostname);
  },

  isListingPage() {
    return /^\/vacancies\/?$/.test(location.pathname);
  },

  moreButtonText: "Більше вакансій",

  extractVacancy() {
    const title = document.getElementsByClassName("g-h2")[0]?.textContent.trim() ?? "Без назви";
    const company = (document.getElementsByClassName("l-n")[0]?.textContent ?? "")
      .replace("Всі вакансії компанії", "")
      .replace(/\s+/g, " ")
      .trim();
    const body = document.getElementsByClassName("l-vacancy")[0];
    const bodyMd = body ? htmlToMarkdown(body).replace(/\n{3,}/g, "\n\n").trim() + "\n" : "";
    const content = bodyMd ? `Посилання (відгукнутись): ${location.href}\n\n${bodyMd}` : "";
    return { filename: sanitizeFilename(`${company} - ${title}`), content };
  },
});
