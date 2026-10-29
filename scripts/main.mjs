/** ZFT NPC Enhancer v13.0.0-dev.7 — bootstrap and optional toolbar integration. */
import { MODULE_ID, VERSION } from "./presets.mjs";
import { openEnhancer, registerUI, isSupported } from "./ui.mjs";
import { installStealthStatusFilter, registerStealthSetting } from "./stealth.mjs";

const LOG = `[ZFT] 🛠️ v${VERSION} | NPC Enhancer`;
let zftRegistered = false;

const tools = [
  { name: "npc-enhancer", title: "NPC Enhancer", icon: "fa-solid fa-shield-halved", order: 70,
    button: true, gmOnly: true, visible: true, onChange: () => openEnhancer() }
];

Hooks.once("init", () => {
  registerStealthSetting();
  registerUI();
  // This is only used when ZFT Tools isn't available. V13 group structure follows ZFT Tools' established API.
  Hooks.on("getSceneControlButtons", controls => {
    if (!game.user?.isGM || zftRegistered || !isSupported()) return;
    const neutral = { name: `${MODULE_ID}-select`, title: "NPC Enhancer", icon: "fa-solid fa-shield-halved",
      button: false, order: 0, visible: true, onChange: () => {} };
    controls[MODULE_ID] = {
      name: MODULE_ID, title: "NPC Enhancer", icon: "fa-solid fa-shield-halved", order: 995,
      visible: true, activeTool: neutral.name, onChange: () => {},
      tools: { [neutral.name]: neutral, ...Object.fromEntries(tools.map((tool, index) => [tool.name, { ...tool, order: index + 1 }])) }
    };
  });
  console.info(`${LOG} 🚀 | Initializing (target: Foundry V13, D&D5e 5.2.x–5.3.x)`);
});

Hooks.once("ready", async () => {
  // All clients must honor module effect flags, including players seeing the same scene.
  const core = Number(game.release?.generation ?? String(game.version ?? "").split(".")[0]);
  if (core === 13 && game.system?.id === "dnd5e") installStealthStatusFilter();
  if (!game.user?.isGM) return;
  if (!isSupported()) {
    console.warn(`${LOG} ⚠️ | Unsupported core/system version: ${game.version}, ${game.system?.id} ${game.system?.version}`);
    return;
  }
  const zft = game.modules.get("zft-tools");
  if (zft?.active && typeof zft.api?.registerTool === "function") {
    const applied = tools.map(tool => zft.api.registerTool(MODULE_ID, tool));
    zftRegistered = applied.every(Boolean);
    if (zftRegistered) console.info(`${LOG} 🔌 | Registered with optional ZFT Tools toolbar`);
    else console.warn(`${LOG} ⚠️ | Optional ZFT Tools registration incomplete`);
  }
  if (!zftRegistered) {
    // If ZFT Tools is not installed, render our own isolated toolbar group.
    const controls = ui.controls?.controls;
    if (controls && !controls[MODULE_ID]) {
      // V13 toolbar controls are cached. A canvas controls render can display the fallback group
      // after its next normal controls rebuild; initial canvas setup already fires the hook.
      console.info(`${LOG} 🎯 | Standalone NPC Enhancer canvas toolbar available`);
    }
  }
});
