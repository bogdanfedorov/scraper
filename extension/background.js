async function findSavedDownload(filename) {
  const savePath = await getSavePath();
  const expectedSuffix = `${savePath}/${filename}.md`.replace(/\\/g, "/");
  const items = await browser.downloads.search({ query: [filename] });
  return items.find(
    (item) => item.exists && item.filename.replace(/\\/g, "/").includes(expectedSuffix)
  );
}

async function backendFetch(path, options) {
  const backendUrl = await getBackendUrl();
  const res = await fetch(`${backendUrl}${path}`, options);
  if (!res.ok && res.status !== 404) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res;
}

function backendQuery(path, body) {
  return backendFetch(path, {
    method: "QUERY",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function findServerVacancy(company, title) {
  const listRes = await backendQuery("/vacancies/list", { company, title });
  if (listRes.status === 404) return null;

  const filenames = await listRes.json();
  const filename = filenames[0];
  if (!filename) return null;

  const vacancyRes = await backendFetch(`/vacancies/${encodeURIComponent(filename)}`);
  if (vacancyRes.status === 404) return null;
  return { filename, vacancy: await vacancyRes.json() };
}

function saveVacancy(vacancy) {
  return backendFetch("/vacancies", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(vacancy),
  });
}

function encodeVacancyRaw(v) {
  return `Status: ${v.status}\nTitle: ${v.title}\nCompany: ${v.company}\nURL: ${v.url}\n\n${v.description}\n`;
}

function decodeVacancyRaw(text) {
  const sep = "\n\n";
  const idx = text.indexOf(sep);
  const header = idx === -1 ? text : text.slice(0, idx);
  const description = idx === -1 ? "" : text.slice(idx + sep.length).replace(/\n$/, "");

  const vacancy = { status: "", title: "", company: "", url: "", description };
  for (const line of header.split("\n")) {
    if (line.startsWith("Status: ")) vacancy.status = line.slice("Status: ".length);
    else if (line.startsWith("Title: ")) vacancy.title = line.slice("Title: ".length);
    else if (line.startsWith("Company: ")) vacancy.company = line.slice("Company: ".length);
    else if (line.startsWith("URL: ")) vacancy.url = line.slice("URL: ".length);
  }
  return vacancy;
}

browser.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === "save") {
    const blob = new Blob([msg.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const savePath = await getSavePath();

    return browser.downloads.download({
      url,
      filename: `${savePath}/${msg.filename}.md`,
      saveAs: false,
      conflictAction: "uniquify"
    });
  }

  if (msg.type === "checkFileExists") {
    const match = await findSavedDownload(msg.filename);
    return { exists: Boolean(match) };
  }

  if (msg.type === "openFile") {
    const match = await findSavedDownload(msg.filename);
    if (!match) return { ok: false };

    await browser.downloads.show(match.id);
    return { ok: true };
  }

  if (msg.type === "getServerVacancyRaw") {
    const found = await findServerVacancy(msg.company, msg.title);
    if (!found) return { exists: false };
    return { exists: true, text: encodeVacancyRaw(found.vacancy) };
  }

  if (msg.type === "saveVacancyRaw") {
    const res = await saveVacancy(decodeVacancyRaw(msg.text));
    return { vacancy: await res.json() };
  }

  if (msg.type === "saveToServer") {
    const found = await findServerVacancy(msg.company, msg.title);
    const status = found ? found.vacancy.status : "new";

    await saveVacancy({
      status,
      title: msg.title,
      company: msg.company,
      url: msg.url,
      description: msg.description,
    });
    return { ok: true };
  }
});