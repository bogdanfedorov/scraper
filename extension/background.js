async function findSavedDownload(filename) {
  const savePath = await getSavePath();
  const expectedSuffix = `${savePath}/${filename}.md`.replace(/\\/g, "/");
  const items = await browser.downloads.search({ query: [filename] });
  return items.find(
    (item) => item.exists && item.filename.replace(/\\/g, "/").includes(expectedSuffix)
  );
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
    // downloads.open() must be called directly from a user input handler, which
    // a cross-context message listener never counts as (Firefox drops the
    // "user activation" flag across the content-script -> background hop, and
    // downloads.* isn't available in content scripts to call it there instead).
    // downloads.show() has no such restriction, so we reveal the file instead.
    const match = await findSavedDownload(msg.filename);
    if (!match) return { ok: false };

    await browser.downloads.show(match.id);
    return { ok: true };
  }
});