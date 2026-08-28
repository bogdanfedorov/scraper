browser.runtime.onMessage.addListener(async (msg) => {
  if (msg.type !== "save") return;

  const blob = new Blob([msg.content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const savePath = await getSavePath();

  return browser.downloads.download({
    url,
    filename: `${savePath}/${msg.filename}.md`,
    saveAs: false,
    conflictAction: "uniquify"
  });
});
