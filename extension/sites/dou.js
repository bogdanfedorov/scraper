registerAdapter({
  label: "DOU (jobs.dou.ua)",

  match() {
    return /(^|\.)jobs\.dou\.ua$/.test(location.hostname);
  },

  isListingPage() {
    return /^\/vacancies\/?$/.test(location.pathname);
  },

  title() {
    return document.getElementsByClassName("g-h2")[0]?.textContent.trim();
  },

  company() {
    return (document.getElementsByClassName("l-n")[0]?.textContent ?? "")
          .replace("Всі вакансії компанії", "")
          .replace(/\s+/g, " ")
          .trim();
  },

  description() {
    const body = document.getElementsByClassName("l-vacancy")[0];
    return body ? body.innerHTML.trim() : "";
  },
});
