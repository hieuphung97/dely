export default function (pi) {
  let first = true;
  pi.on("before_agent_start", async (event, ctx) => {
    if (!first) return;
    first = false;
    const prompt = String((event && event.prompt) || "");
    const pinLines = prompt.split(/\r?\n/).filter((l) => /^dely-pin:/.test(l));
    if (!pinLines.length) return;
    const line = pinLines[pinLines.length - 1];
    const fail = (sel) => {
      const msg = "DELY-PIN-FAIL " + sel;
      process.on("exit", () => process.stderr.write("\n" + msg + "\n"));
      process.exit(1);
    };
    const matched = line.match(/^dely-pin:[ \t]+(\S+)(?:[ \t]+(\S+))?[ \t]*$/);
    if (!matched) {
      fail(line.replace(/^dely-pin:[ \t]*/, "").trim() || line);
      return;
    }
    const selector = matched[1];
    const level = matched[2] || "";
    const models = (ctx.modelRegistry && ctx.modelRegistry.getAvailable()) || [];
    const model = models.find((m) => m.provider + "/" + m.id === selector);
    if (!model) {
      fail(selector);
      return;
    }
    let ok;
    try {
      ok = await pi.setModel(model);
    } catch (_) {
      fail(selector);
      return;
    }
    if (!ok) {
      fail(selector);
      return;
    }
    if (level) {
      pi.setThinkingLevel(level);
      if (pi.getThinkingLevel() !== level) {
        fail(selector);
        return;
      }
    }
  });
}
