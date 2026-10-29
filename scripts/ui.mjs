/** ZFT NPC Enhancer v13.0.0-dev.7 — compact, auto-fitting selection-aware GM workspace (V13). */
import { MODULE_ID, PRESETS, validateEnhancement } from "./presets.mjs";
import { selectedTokenIds, inspectSelection, runSelected, verifyEnvironment } from "./service.mjs";
import { STEALTH_SETTING, getStealthPreference } from "./stealth.mjs";

const DIALOG_CLASSES = ["dialog", "zft-npc-enhancer-dialog"];
let activeDialog = null;
let stopListeners = () => {};
let activeRoot = null;
let busy = false;
let lastSelection = "";
let pendingFit = false;

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}
function notify(error) {
  console.warn("[ZFT] ⚠️ | NPC Enhancer", error);
  ui.notifications.warn(error.message ?? String(error));
}

const fields = [
  { key: "hpPercent", label: "Max HP", hint: "Percent of original maximum", suffix: "%", min: 100, max: 300 },
  { key: "ac", label: "AC", hint: "Flat AC bonus", suffix: "+", min: 0, max: 5 },
  { key: "attack", label: "Attack", hint: "Flat attack bonus", suffix: "+", min: 0, max: 5 },
  { key: "damage", label: "Damage", hint: "Flat damage bonus", suffix: "+", min: 0, max: 10 },
  { key: "saves", label: "Saves", hint: "Flat save bonus", suffix: "+", min: 0, max: 5 }
];
const descriptions = Object.freeze({
  sturdy: "Survivability only. No attack, damage, AC or saving throw bonus.",
  elite: "Balanced improvements to durability, defense and offense.",
  boss: "Heavy durability and stat bonuses for important opponents.",
  custom: "Your individually selected values."
});

function formFrom(root) { return root.querySelector("form.zft-npc-enhancer-form"); }
function fieldInput(form, name) { return form?.elements?.namedItem(name); }
function readValues(root) {
  const form = formFrom(root);
  if (!form) throw new Error("The enhancement form is unavailable.");
  const config = Object.fromEntries(fields.map(f => [f.key, Number(fieldInput(form, f.key)?.value)]));
  return { config: validateEnhancement(config), preset: fieldInput(form, "preset")?.value ?? "custom" };
}
function setValues(root, config, preset) {
  const form = formFrom(root);
  if (!form) return;
  fieldInput(form, "preset").value = preset in descriptions ? preset : "custom";
  for (const { key } of fields) fieldInput(form, key).value = config[key];
  const detail = root.querySelector(".zft-ne-preset-help");
  if (detail) detail.textContent = descriptions[fieldInput(form, "preset").value];
}
function summary(details) {
  const eligible = details.filter(d => d.status !== "unsupported");
  return {
    apply: eligible.filter(d => d.status === "unenhanced"),
    update: eligible.filter(d => d.status === "enhanced" && d.canUpdate),
    remove: eligible.filter(d => d.status === "enhanced"),
    unsupported: details.filter(d => d.status === "unsupported"),
    legacy: eligible.filter(d => d.status === "enhanced" && !d.canUpdate)
  };
}

/** Let the compact V13 Dialog grow with its content, avoiding scrollbars when it fits the viewport.
 * Very short viewports or unusually large selections use an accessible overflow fallback.
 * The resize is deferred to the next paint so token chips and feedback can affect height.
 */
function scheduleFit() {
  if (pendingFit || typeof window === "undefined" || typeof requestAnimationFrame !== "function") return;
  pendingFit = true;
  requestAnimationFrame(() => {
    pendingFit = false;
    const root = activeRoot;
    if (!root || !activeDialog) return;
    const dialog = root.closest?.(".app");
    const content = root.querySelector(".zft-ne-shell");
    if (!dialog || !content) return;
    const header = dialog.querySelector(".window-header");
    const preferred = Math.ceil(content.scrollHeight + (header?.offsetHeight ?? 32) + 8);
    const space = Math.max(160, window.innerHeight - 24);
    const constrained = preferred > space;
    dialog.classList.toggle("zft-ne-viewport-constrained", constrained);
    const height = constrained ? space : "auto";
    const rect = dialog.getBoundingClientRect();
    const effectiveHeight = constrained ? space : preferred;
    const top = Math.max(8, Math.min(rect.top, window.innerHeight - effectiveHeight - 8));
    activeDialog.setPosition?.({ height, top: Math.round(top) });
  });
}

/** Changes only the status section, preserving in-progress form edits and window position. */
function refreshSelection() {
  const root = activeRoot;
  if (!root || !activeDialog || busy) return;
  let snapshot, details;
  try {
    snapshot = selectedTokenIds();
    details = inspectSelection(snapshot);
  } catch (error) { notify(error); return; }
  const counts = summary(details);
  const contextKey = `${snapshot.sceneId ?? ""}:${snapshot.tokenIds.join(",")}`;
  if (contextKey !== lastSelection) {
    lastSelection = contextKey;
    // On a single enhanced NPC show the existing settings, ready to modify.
    // On no selection, or on selection of a new ordinary NPC, retain GM's preset.
    if (details.length === 1 && details[0].canUpdate && details[0].config) {
      try { setValues(root, validateEnhancement(details[0].config), details[0].preset); }
      catch (error) { console.warn("[ZFT] ⚠️ | Invalid saved NPC preset", error); }
    }
  }
  const count = root.querySelector(".zft-ne-count");
  if (count) count.textContent = `${details.length} selected`;
  const list = root.querySelector(".zft-ne-token-list");
  if (list) list.innerHTML = details.length ? details.map(d => {
    const state = d.status === "unsupported" ? "Unavailable" :
      d.status === "unenhanced" ? "Not enhanced" : `Enhanced: ${d.preset}`;
    const tooltip = d.reason ? ` title="${escapeHTML(d.reason)}"` : "";
    const css = d.status === "enhanced" ? "enhanced" : d.status === "unsupported" ? "unsupported" : "plain";
    return `<span class="zft-ne-token ${css}"${tooltip}><i class="fa-solid fa-chess-pawn" aria-hidden="true"></i> ${escapeHTML(d.name)} <small>${escapeHTML(state)}</small></span>`;
  }).join("") : `<p class="zft-ne-empty">Select NPCs on the canvas to begin.</p>`;
  const status = root.querySelector(".zft-ne-selection-help");
  if (status) {
    const text = [];
    if (counts.legacy.length) text.push(`${counts.legacy.length} older or incomplete enhancement(s) must be removed before replacement.`);
    if (counts.unsupported.length) text.push(`${counts.unsupported.length} invalid/linked/PC token(s) cannot be modified.`);
    if (!text.length && counts.update.length && counts.apply.length) text.push("Apply affects new NPCs; Update and Remove affect already enhanced NPCs.");
    status.textContent = text.join(" ");
  }
  for (const action of ["apply", "update", "remove"]) {
    const button = root.querySelector(`[data-ne-action="${action}"]`);
    if (!button) continue;
    button.hidden = counts[action].length === 0;
    button.disabled = counts[action].length === 0;
    const labels = { apply: "Apply", update: "Update", remove: "Remove" };
    button.querySelector("span").textContent = `${labels[action]} (${counts[action].length})`;
  }
  scheduleFit();
}

function listenToSceneSelection() {
  stopListeners();
  const events = ["controlToken", "canvasReady", "canvasTearDown", "updateToken", "deleteToken",
    "updateActor", "createActiveEffect", "updateActiveEffect", "deleteActiveEffect"];
  const callback = () => { if (!busy) refreshSelection(); };
  const registered = events.map(event => [event, Hooks.on(event, callback)]);
  const onViewportResize = () => scheduleFit();
  if (typeof window !== "undefined") window.addEventListener("resize", onViewportResize);
  stopListeners = () => {
    if (typeof window !== "undefined") window.removeEventListener("resize", onViewportResize);
    for (const [event, id] of registered) Hooks.off(event, id);
    stopListeners = () => {};
  };
}

async function takeAction(action, root) {
  if (busy) return;
  let ids, details, selection, values, stealth;
  try {
    ids = selectedTokenIds();
    details = inspectSelection(ids);
    selection = summary(details)[action];
    if (!selection?.length) { refreshSelection(); return; }
    values = action === "remove" ? null : readValues(root);
    stealth = fieldInput(formFrom(root), "stealth")?.checked !== false;
  } catch (error) { notify(error); return; }
  busy = true;
  const resultNode = root.querySelector(".zft-ne-result");
  if (resultNode) resultNode.textContent = `Working on ${selection.length} token(s)…`;
  root.querySelectorAll("[data-ne-action]").forEach(button => { button.disabled = true; });
  try {
    const results = await runSelected(action, { sceneId: ids.sceneId, tokenIds: selection.map(d => d.id) },
      values?.config, values?.preset, { stealth });
    const success = results.filter(r => ["applied", "updated", "removed"].includes(r.status)).length;
    const problems = results.filter(r => ["skipped", "failed"].includes(r.status));
    if (resultNode) resultNode.textContent = `${success} token(s) ${action === "apply" ? "enhanced" : action === "update" ? "updated" : "restored"}.` +
      (problems.length ? ` ${problems.length} skipped or failed. See console.` : "");
  } catch (error) { notify(error); if (resultNode) resultNode.textContent = error.message; }
  finally { busy = false; refreshSelection(); }
}

function contentMarkup() {
  const config = PRESETS.elite;
  return `<div class="zft-ne-shell">
    <form class="zft-npc-enhancer-form">
      <section class="zft-ne-section zft-ne-selection" aria-label="Selected NPC tokens">
        <div class="zft-ne-section-head"><strong>Selected NPCs</strong><span class="zft-ne-count">0 selected</span></div>
        <div class="zft-ne-token-list" aria-live="polite" aria-label="Current selection"></div>
        <p class="zft-ne-selection-help" aria-live="polite"></p>
      </section>
      <section class="zft-ne-section zft-ne-editor" aria-label="Enhancement settings">
        <div class="zft-ne-preset-row">
          <label class="zft-ne-preset-label" for="zft-ne-preset">Preset</label>
          <select name="preset" id="zft-ne-preset"><option value="sturdy">Sturdy</option>
            <option value="elite" selected>Elite</option><option value="boss">Boss</option><option value="custom">Custom</option></select>
          <span class="zft-ne-preset-help" aria-live="polite">${descriptions.elite}</span>
        </div>
        <div class="zft-ne-stat-grid" role="group" aria-label="Stat adjustments">
          ${fields.map(f => `<label class="zft-ne-field" for="zft-ne-${f.key}">
            <span class="zft-ne-field-label">${f.label}</span>
            <span class="zft-ne-input-wrap"><input id="zft-ne-${f.key}" name="${f.key}"
              type="number" min="${f.min}" max="${f.max}" step="1" value="${config[f.key]}"
              title="${f.hint}" required/><span class="zft-ne-unit" aria-hidden="true">${f.suffix}</span></span>
          </label>`).join("")}
        </div>
      </section>
      <div class="zft-ne-options">
        <label class="zft-ne-stealth" title="Hide only this module's floating status and HP text on all clients; the Actor's visible statistics are not concealed.">
          <input type="checkbox" name="stealth" aria-label="Stealth Mode" checked/>
          <i class="fa-solid fa-eye-slash" aria-hidden="true"></i> Stealth Mode
        </label>
        <span class="zft-ne-footnote"><i class="fa-solid fa-lock" aria-hidden="true"></i> Unlinked NPCs only. Wounds preserved.</span>
      </div>
      <p class="zft-ne-result" role="status" aria-live="polite"></p>
      <div class="zft-ne-actions" role="group" aria-label="Enhancement actions">
        <button type="button" class="zft-ne-primary" data-ne-action="apply" hidden><i class="fa-solid fa-shield-halved" aria-hidden="true"></i> <span>Apply</span></button>
        <button type="button" class="zft-ne-primary" data-ne-action="update" hidden><i class="fa-solid fa-pen" aria-hidden="true"></i> <span>Update</span></button>
        <button type="button" class="zft-ne-danger" data-ne-action="remove" hidden><i class="fa-solid fa-rotate-left" aria-hidden="true"></i> <span>Remove</span></button>
        <button type="button" class="zft-ne-close" data-ne-action="close"><i class="fa-solid fa-xmark" aria-hidden="true"></i> <span>Close</span></button>
      </div>
    </form>
  </div>`;
}

/** Open once, permit live canvas token changes, and retain the same window after an action. */
export function openEnhancer() {
  try { verifyEnvironment(); } catch (error) { notify(error); return; }
  if (activeDialog) {
    activeDialog.bringToTop?.();
    refreshSelection();
    return activeDialog;
  }
  lastSelection = "";
  activeDialog = new Dialog({
    title: "ZFT NPC Enhancer",
    content: contentMarkup(),
    buttons: {}, // Actions are inside the window: Dialog.submit would close it.
    render: html => {
      const root = html[0] ?? html;
      activeRoot = root;
      const form = formFrom(root);
      if (!form) return;
      form.addEventListener("submit", event => event.preventDefault());
      const stealthInput = fieldInput(form, "stealth");
      if (stealthInput) {
        stealthInput.checked = getStealthPreference();
        stealthInput.addEventListener("change", () => {
          Promise.resolve(game.settings?.set?.(MODULE_ID, STEALTH_SETTING, stealthInput.checked))
            .catch(error => console.warn("[ZFT] ⚠️ | Could not save Stealth Mode preference", error));
        });
      }
      const preset = fieldInput(form, "preset");
      const description = root.querySelector(".zft-ne-preset-help");
      const updateDescription = () => {
        if (description) description.textContent = descriptions[preset.value] ?? descriptions.custom;
        scheduleFit();
      };
      preset.addEventListener("change", () => {
        if (PRESETS[preset.value]) setValues(root, PRESETS[preset.value], preset.value);
        updateDescription();
      });
      for (const { key } of fields) {
        fieldInput(form, key).addEventListener("input", () => { preset.value = "custom"; updateDescription(); });
      }
      for (const action of ["apply", "update", "remove"]) {
        root.querySelector(`[data-ne-action="${action}"]`).addEventListener("click", () => void takeAction(action, root));
      }
      root.querySelector('[data-ne-action="close"]').addEventListener("click", () => void activeDialog?.close());
      listenToSceneSelection();
      refreshSelection();
    },
    close: () => { stopListeners(); activeRoot = null; activeDialog = null; busy = false; lastSelection = ""; }
  }, { width: 460, height: "auto", classes: DIALOG_CLASSES, resizable: true });
  activeDialog.render(true);
  return activeDialog;
}

/** Backwards-compatible API alias; opens the same combined window. */
export const removeEnhancer = openEnhancer;

export function isSupported() {
  try { verifyEnvironment(); return true; }
  catch { return false; }
}
export function registerUI() {
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = Object.freeze({ open: openEnhancer, remove: removeEnhancer,
    selectedTokenIds, inspectSelection, runSelected });
}
