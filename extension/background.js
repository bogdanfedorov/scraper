browser.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "save") return;

  const blob = new Blob([msg.content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);

  return browser.downloads.download({
    url,
    filename: `dou-vacancies/${msg.filename}.md`,
    saveAs: false,
    conflictAction: "uniquify"
  });
});
