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
    const savePath = await getSavePath();
    const expectedSuffix = `${savePath}/${msg.filename}.md`.replace(/\\/g, "/");
    const items = await browser.downloads.search({ query: [msg.filename] });
    const match = items.find(
      (item) => item.exists && item.filename.replace(/\\/g, "/").includes(expectedSuffix)
    );
    return { exists: match };
  }
});
