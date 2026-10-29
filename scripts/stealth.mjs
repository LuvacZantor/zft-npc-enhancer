/** ZFT NPC Enhancer v13.0.0-dev.7 — narrow V13 effect-status suppression. */
import { MODULE_ID } from "./presets.mjs";

export const STEALTH_SETTING = "stealthMode";

/** Do not treat this as data secrecy: players may still see token resource bars or an Actor they own. */
export function registerStealthSetting() {
  game.settings.register(MODULE_ID, STEALTH_SETTING, {
    name: "NPC Enhancer Stealth Mode",
    hint: "Suppress floating token effect and HP text when NPC Enhancer changes an NPC. Normal combat feedback remains visible.",
    scope: "client", config: false, type: Boolean, default: true
  });
}

export function getStealthPreference() {
  try { return game.settings?.get(MODULE_ID, STEALTH_SETTING) !== false; }
  catch { return true; }
}

/** The D&D5e 5.2.x actor explicitly bypasses scrolling HP/heal text for isAdvancement.
 * Our adjustments are not in-combat healing or damage and must not trigger concentration saves.
 * Explicitly disable concentration checks even when popups are enabled: changing
 * the temporary HP grant is bookkeeping, not an attack. Document update options
 * are transmitted to every client, unlike a local animation suppressor.
 */
export function hpUpdateOptions(stealth = true) {
  return stealth ? { isAdvancement: true, dnd5e: { concentrationCheck: false }, zftNpcEnhancer: { stealth: true } }
    : { dnd5e: { concentrationCheck: false } };
}

let installed = false;
/**
 * Foundry V13 emits its scrolling status text in ActiveEffect._displayScrollingStatus.
 * This narrowly suppresses ONLY enabled, module-managed stealth effects, on all clients.
 * We wrap and call the original method for every other Active Effect.
 * V13 public API confirms this method; never patch createScrollingText globally.
 */
export function installStealthStatusFilter() {
  if (installed) return true;
  const proto = globalThis.CONFIG?.ActiveEffect?.documentClass?.prototype;
  const original = proto?._displayScrollingStatus;
  if (typeof original !== "function") {
    console.warn("[ZFT] ⚠️ | NPC Enhancer: V13 status-text suppression unavailable; check your Foundry build.");
    return false;
  }
  if (original.__zftNpcEnhancerStatusFilter) { installed = true; return true; }
  function zftNpcEnhancerStatusFilter(enabled) {
    if (this.getFlag?.(MODULE_ID, "kind") === "enhancement" &&
        this.getFlag?.(MODULE_ID, "stealth") === true) return;
    return original.call(this, enabled);
  }
  Object.defineProperty(zftNpcEnhancerStatusFilter, "__zftNpcEnhancerStatusFilter", {value:true});
  proto._displayScrollingStatus = zftNpcEnhancerStatusFilter;
  installed = true;
  console.info("[ZFT] 🔇 | NPC Enhancer scoped effect status-text filter registered");
  return true;
}
