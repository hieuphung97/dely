export default function (pi) {
  let first = true;
  pi.on("before_agent_start", async (event, ctx) => {
    if (!first) return;
    first = false;
    const prompt = String((event && event.prompt) || "");
    const matched = [
      ...prompt.matchAll(/^dely-pin:[ \t]+(\S+)(?:[ \t]+(\S+))?[ \t]*$/gm),
    ].pop();
    if (!matched) return;
    const selector = matched[1];
    const level = matched[2] || "";
    const fail = () => {
      const msg = "DELY-PIN-FAIL " + selector;
      process.on("exit", () => process.stderr.write("\n" + msg + "\n"));
      process.exit(1);
    };
    const models = (ctx.modelRegistry && ctx.modelRegistry.getAvailable()) || [];
    const model = models.find((m) => m.provider + "/" + m.id === selector);
    if (!model) {
      fail();
      return;
    }
    if (level) {
      const thinking = model.thinking;
      const offered = Array.isArray(thinking)
        ? thinking
        : thinking && Array.isArray(thinking.efforts)
          ? thinking.efforts
          : [];
      if (offered.indexOf(level) < 0) {
        fail();
        return;
      }
    }
    const ok = await pi.setModel(model);
    if (!ok) {
      fail();
      return;
    }
    if (level) pi.setThinkingLevel(level);
  });
}
