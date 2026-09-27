export default function (pi) {
  let first = true;
  pi.on("before_agent_start", async (event, ctx) => {
    if (!first) return;
    first = false;
    const prompt = String((event && event.prompt) || "");
    const matched = prompt.match(/^dely-pin:\s*(\S+)\s*$/m);
    if (!matched) return;
    const raw = matched[1];
    const slash = raw.indexOf("/");
    let selector = raw;
    let level = "";
    if (slash >= 0) {
      const colon = raw.lastIndexOf(":");
      if (colon > slash) {
        selector = raw.slice(0, colon);
        level = raw.slice(colon + 1);
      }
    }
    const fail = () => {
      console.error("DELY-PIN-FAIL " + selector);
      process.exit(1);
    };
    const models = (ctx.modelRegistry && ctx.modelRegistry.getAvailable()) || [];
    const model = models.find((m) => m.provider + "/" + m.id === selector);
    if (!model) {
      fail();
      return;
    }
    const ok = await pi.setModel(model);
    if (!ok) {
      fail();
      return;
    }
    if (level) {
      const offered = model.thinking;
      if (!Array.isArray(offered) || offered.indexOf(level) < 0) {
        fail();
        return;
      }
      pi.setThinkingLevel(level);
    }
  });
}
