/** ZFT NPC Enhancer v13.0.0-dev.7 — isolated token operations. */
import { MODULE_ID, VERSION, validateEnhancement, hpBonus, reversedHp, effectChanges } from "./presets.mjs";
import { hpUpdateOptions } from "./stealth.mjs";

const LOG = `[ZFT] 🛠️ v${VERSION} | NPC Enhancer`;
const activeOperations = new Set();

export function verifyEnvironment() {
  const core = Number(game.release?.generation ?? String(game.version ?? "").split(".")[0]);
  if (core !== 13) throw new Error(`This test build requires Foundry V13 (detected ${game.version ?? "unknown"}).`);
  if (game.system?.id !== "dnd5e") throw new Error("This module requires the D&D5e game system.");
  if (!/^5\.[23]\./.test(String(game.system.version ?? ""))) {
    throw new Error(`This build targets D&D5e 5.2.x or 5.3.x (detected ${game.system.version ?? "unknown"}).`);
  }
  if (!game.user?.isGM) throw new Error("Only a GM may manage NPC enhancements.");
}

export function selectedTokenIds() {
  verifyEnvironment();
  return { sceneId: canvas?.scene?.id, tokenIds: (canvas?.tokens?.controlled ?? []).map(t => t.document.id) };
}

function resolveTokens(sceneId, tokenIds) {
  verifyEnvironment();
  if (!canvas?.scene || canvas.scene.id !== sceneId) throw new Error("The active scene has changed. Reselect the tokens.");
  if (!Array.isArray(tokenIds) || !tokenIds.length || tokenIds.length > 100 ||
      tokenIds.some(id => typeof id !== "string")) {
    throw new Error("Select 1–100 NPC tokens first.");
  }
  return [...new Set(tokenIds)].map(id => canvas.scene.tokens.get(id)).filter(Boolean);
}

function checkNPC(token) {
  if (!token.actor) return "Token has no Actor.";
  if (token.actorLink) return "Linked token: skipping to protect the shared world Actor.";
  if (token.actor.type !== "npc") return "Not a D&D5e NPC Actor.";
  if (!token.actor.isOwner) return "GM lacks ownership of this token Actor.";
  return null;
}

function existingEffect(actor) {
  return actor.effects.find(effect => effect.getFlag(MODULE_ID, "kind") === "enhancement") ?? null;
}

/** Read-only scene token statuses for the persistent GM window. */
export function inspectSelection({ sceneId, tokenIds }) {
  verifyEnvironment();
  if (!sceneId || canvas?.scene?.id !== sceneId || !Array.isArray(tokenIds)) return [];
  return [...new Set(tokenIds)].slice(0, 100).map(id => {
    const token = canvas.scene.tokens.get(id);
    if (!token) return { id, name: "(Token missing)", status: "unsupported", reason: "Token no longer exists." };
    const reason = checkNPC(token);
    if (reason) return { id, name: token.name, status: "unsupported", reason };
    const state = token.getFlag(MODULE_ID, "enhancement");
    const effect = existingEffect(token.actor);
    if (!state && !effect) return { id, name: token.name, status: "unenhanced" };
    const stored = state ?? effect?.flags?.[MODULE_ID];
    const validConfig = stored?.config && Object.keys(stored.config).length === 5 ? stored.config : null;
    const updateAllowed = state?.schema === 2 && state.hpMode === "activeEffect" &&
      !state.hpReverted && !state.hpRemovalPlan && effect?.id === state.effectId &&
      effect?.disabled === false && effect?.getFlag(MODULE_ID, "schema") === 2;
    return { id, name: token.name, status: "enhanced", preset: stored?.preset ?? "unknown",
      config: validConfig, canUpdate: Boolean(updateAllowed),
      reason: updateAllowed ? "" : "Remove this legacy or incomplete enhancement before applying a new one." };
  });
}

async function applyOne(token, config, preset, stealth) {
  const reason = checkNPC(token);
  if (reason) return { status: "skipped", token: token.name, message: reason };
  if (token.getFlag(MODULE_ID, "enhancement") || existingEffect(token.actor)) {
    return { status: "skipped", token: token.name, message: "Already enhanced; remove the existing enhancement first." };
  }
  if (activeOperations.has(token.uuid)) {
    return { status: "skipped", token: token.name, message: "Another enhancement operation is in progress." };
  }
  activeOperations.add(token.uuid);
  const actor = token.actor;
  let effect;
  let hpMutationAttempted = false;
  let prior;
  try {
    const hp = actor.system?.attributes?.hp;
    const max = Number(hp?.max);
    const value = Number(hp?.value);
    if (!Number.isSafeInteger(max) || max < 1 || !Number.isSafeInteger(value) || value < 0) {
      throw new Error("NPC must have valid numerical current and maximum HP.");
    }
    prior = { max, value };
    const delta = hpBonus(max, config.hpPercent);
    const created = await actor.createEmbeddedDocuments("ActiveEffect", [{
      name: `ZFT NPC Enhancement (${preset})`,
      icon: "icons/svg/shield.svg",
      disabled: false,
      transfer: false,
      description: `ZFT ${preset} enhancement: +${delta} max HP, +${config.ac} AC, +${config.attack} attack, +${config.damage} flat damage, +${config.saves} saves. Remove with NPC Enhancer to preserve combat wounds.`,
      changes: effectChanges(config, CONST.ACTIVE_EFFECT_MODES.ADD, delta),
      flags: { [MODULE_ID]: { kind: "enhancement", schema: 2, version: VERSION,
        tokenId: token.id, hpDelta: delta, config: { ...config }, preset, stealth } }
    }]);
    effect = created?.[0];
    if (!effect) throw new Error("Active Effect creation returned no document.");
    if (delta) {
      const effectiveMax = Number(actor.system?.attributes?.hp?.max);
      if (effectiveMax !== max + delta) {
        throw new Error(`The HP Active Effect did not update max HP (expected ${max + delta}, found ${effectiveMax}). No HP was granted.`);
      }
      // The effect owns maximum HP. Only current HP is stored on the Actor, and
      // is granted once to keep the same number of pre-existing wounds.
      hpMutationAttempted = true;
      await actor.update({ "system.attributes.hp.value": value + delta }, hpUpdateOptions(stealth));
    }
    await token.setFlag(MODULE_ID, "enhancement", {
      schema: 2, hpMode: "activeEffect", version: VERSION, effectId: effect.id, hpDelta: delta, preset, stealth,
      appliedTo: token.id, config: { ...config }, hpReverted: false
    });
    console.info(`${LOG} ✅ | Applied ${preset} to token ${token.uuid} (+${delta} HP)`);
    return { status: "applied", token: token.name, message: preset };
  } catch (error) {
    console.error(`${LOG} ❌ | Apply failed for ${token.uuid}`, error);
    // Roll back only our just-created resources, never any existing effects.
    if (hpMutationAttempted && prior) {
      try { await actor.update({ "system.attributes.hp.value": prior.value }, hpUpdateOptions(stealth)); }
      catch (rollbackError) { console.error(`${LOG} ❌ | HP rollback failed`, rollbackError); }
    }
    if (effect && actor.effects.get(effect.id)) {
      try { await actor.deleteEmbeddedDocuments("ActiveEffect", [effect.id]); }
      catch (rollbackError) { console.error(`${LOG} ❌ | Effect rollback failed`, rollbackError); }
    }
    return { status: "failed", token: token.name, message: error.message };
  } finally {
    activeOperations.delete(token.uuid);
  }
}

async function removeOne(token, stealth) {
  const reason = checkNPC(token);
  if (reason) return { status: "skipped", token: token.name, message: reason };
  const state = token.getFlag(MODULE_ID, "enhancement");
  const managed = existingEffect(token.actor);
  if (!state && !managed) return { status: "skipped", token: token.name, message: "Not enhanced." };
  if (activeOperations.has(token.uuid)) return { status: "skipped", token: token.name, message: "Operation in progress." };
  activeOperations.add(token.uuid);
  try {
    if (state && state.appliedTo !== token.id) throw new Error("Enhancement state belongs to another token.");
    const delta = Number(state?.hpDelta ?? 0);
    if (!Number.isSafeInteger(delta) || delta < 0) throw new Error("Invalid stored HP bonus. No changes made.");
    // Preserve the original dev.1/dev.2 direct-HP storage for already-enhanced
    // tokens. New schema 2 enhancements instead have a max-HP Active Effect.
    const effect = state?.effectId ? token.actor.effects.get(state.effectId) : managed;
    const ours = effect?.getFlag(MODULE_ID, "kind") === "enhancement" ? effect : null;
    const isEffectHP = state?.schema === 2 && state?.hpMode === "activeEffect";
    let warning;
    if (isEffectHP) {
      if (state && delta && !state.hpReverted && ours) {
        const hp = token.actor.system.attributes.hp;
        const currentMax = Number(hp.max);
        const currentValue = Number(hp.value);
        // Stage before touching HP so an interrupted operation cannot subtract twice.
        let plan = state.hpRemovalPlan;
        if (!plan) {
          if (!Number.isSafeInteger(currentMax) || currentMax <= delta ||
              !Number.isSafeInteger(currentValue) || currentValue < 0) {
            throw new Error("Invalid HP state; no changes made.");
          }
          plan = { fromMax: currentMax, fromValue: currentValue,
            toValue: Math.min(currentMax - delta, Math.max(0, currentValue - delta)) };
          await token.setFlag(MODULE_ID, "enhancement", { ...state, hpRemovalPlan: plan });
        }
        if (currentMax !== plan.fromMax) {
          throw new Error("Maximum HP changed during removal. Review before retrying.");
        }
        if (currentValue === plan.fromValue && currentValue !== plan.toValue) {
          await token.actor.update({ "system.attributes.hp.value": plan.toValue }, hpUpdateOptions(stealth));
        } else if (currentValue !== plan.toValue) {
          throw new Error("Current HP changed during an interrupted removal. Review before retrying.");
        }
        await token.setFlag(MODULE_ID, "enhancement", { ...state, hpRemovalPlan: plan, hpReverted: true });
      } else if (state && delta && !state.hpReverted && !ours) {
        // Manual deletion may have clamped HP already. Never blindly subtract
        // the bonus a second time after losing the original effect.
        warning = "HP effect was already deleted; current HP was left unchanged to avoid extra damage.";
      }
    } else if (state && delta && !state.hpReverted) {
      // Legacy schema 1: dev.1/dev.2 stored bonus max and value directly.
      const hp = token.actor.system.attributes.hp;
      const currentMax = Number(hp.max);
      const currentValue = Number(hp.value);
      let plan = state.hpRemovalPlan;
      if (!plan) {
        const next = reversedHp(currentMax, currentValue, delta);
        plan = { fromMax: currentMax, toMax: next.max };
        await token.setFlag(MODULE_ID, "enhancement", { ...state, hpRemovalPlan: plan });
      }
      if (currentMax === plan.fromMax) {
        const next = reversedHp(currentMax, currentValue, delta);
        await token.actor.update({ "system.attributes.hp.max": next.max, "system.attributes.hp.value": next.value }, hpUpdateOptions(stealth));
      } else if (currentMax !== plan.toMax) {
        throw new Error("HP changed during an interrupted reversal; review the token before retrying.");
      }
      await token.setFlag(MODULE_ID, "enhancement", { ...state, hpRemovalPlan: plan, hpReverted: true });
    }
    if (ours) {
      // Existing dev.6 (or earlier) effects have no stealth flag. Update the
      // managed effect before deletion so every client can suppress its popup.
      if (ours.getFlag(MODULE_ID, "stealth") !== stealth) {
        await ours.update({ [`flags.${MODULE_ID}.stealth`]: stealth });
      }
      await token.actor.deleteEmbeddedDocuments("ActiveEffect", [ours.id]);
    }
    if (state) await token.unsetFlag(MODULE_ID, "enhancement");
    console.info(`${LOG} ✅ | Removed enhancement from token ${token.uuid}`);
    return { status: "removed", token: token.name, ...(warning ? { message: warning } : {}) };
  } catch (error) {
    console.error(`${LOG} ❌ | Remove failed for ${token.uuid}`, error);
    return { status: "failed", token: token.name, message: error.message };
  } finally {
    activeOperations.delete(token.uuid);
  }
}

/** Change a schema 2 enhancement in-place, keeping its effect ID and existing wounds. */
async function updateOne(token, config, preset, stealth) {
  const reason = checkNPC(token);
  if (reason) return { status: "skipped", token: token.name, message: reason };
  if (activeOperations.has(token.uuid)) return { status: "skipped", token: token.name, message: "Operation in progress." };
  const state = token.getFlag(MODULE_ID, "enhancement");
  const effect = existingEffect(token.actor);
  if (!state && !effect) return { status: "skipped", token: token.name, message: "Not enhanced. Apply first." };
  if (state?.schema !== 2 || state.hpMode !== "activeEffect" || state.hpReverted || state.hpRemovalPlan ||
      state.appliedTo !== token.id || !effect || effect.id !== state.effectId || effect.disabled ||
      effect.getFlag(MODULE_ID, "schema") !== 2) {
    return { status: "skipped", token: token.name,
      message: "Legacy or incomplete enhancement: remove it before applying the replacement." };
  }
  const oldDelta = Number(state.hpDelta);
  const oldHp = token.actor.system?.attributes?.hp;
  const oldMax = Number(oldHp?.max);
  const oldValue = Number(oldHp?.value);
  const baseMax = oldMax - oldDelta;
  if (![oldMax, oldValue, oldDelta, baseMax].every(Number.isSafeInteger) ||
      oldDelta < 0 || baseMax < 1 || oldValue < 0 || oldValue > oldMax) {
    return { status: "failed", token: token.name, message: "Invalid current HP or enhancement state." };
  }
  const delta = hpBonus(baseMax, config.hpPercent);
  const targetMax = baseMax + delta;
  const targetValue = Math.min(targetMax, Math.max(0, oldValue + delta - oldDelta));
  // Keep the exact existing effect ID; never re-create it or touch other effects.
  const oldEffect = { name: effect.name, description: effect.description,
    changes: foundry.utils.deepClone(effect.changes), flags: foundry.utils.deepClone(effect.flags) };
  const updatedState = { ...state, version: VERSION, hpDelta: delta, preset, stealth, config: { ...config } };
  let changed = false;
  activeOperations.add(token.uuid);
  try {
    changed = true; // Also roll back if an effect update partially applies before rejecting.
    await effect.update({
      name: `ZFT NPC Enhancement (${preset})`,
      description: `ZFT ${preset} enhancement: +${delta} max HP, +${config.ac} AC, +${config.attack} attack, +${config.damage} flat damage, +${config.saves} saves. Remove with NPC Enhancer to preserve combat wounds.`,
      changes: effectChanges(config, CONST.ACTIVE_EFFECT_MODES.ADD, delta),
      [`flags.${MODULE_ID}`]: { ...effect.flags?.[MODULE_ID], kind: "enhancement", schema: 2,
        version: VERSION, tokenId: token.id, hpDelta: delta, config: { ...config }, preset, stealth }
    });
    changed = true;
    if (Number(token.actor.system?.attributes?.hp?.max) !== targetMax) {
      throw new Error(`Updated effect did not set expected maximum HP (${targetMax}).`);
    }
    if (Number(token.actor.system?.attributes?.hp?.value) !== targetValue) {
      await token.actor.update({ "system.attributes.hp.value": targetValue }, hpUpdateOptions(stealth));
    }
    await token.setFlag(MODULE_ID, "enhancement", updatedState);
    console.info(`${LOG} ✅ | Updated ${preset} on token ${token.uuid}; HP delta ${oldDelta} to ${delta}`);
    return { status: "updated", token: token.name, message: preset };
  } catch (error) {
    console.error(`${LOG} ❌ | Update failed for ${token.uuid}`, error);
    if (changed) {
      try {
        await effect.update(oldEffect);
        if (Number(token.actor.system?.attributes?.hp?.value) !== oldValue) {
          await token.actor.update({ "system.attributes.hp.value": oldValue }, hpUpdateOptions(stealth));
        }
      } catch (rollbackError) {
        console.error(`${LOG} ❌ | Update rollback failed for ${token.uuid}`, rollbackError);
        return { status: "failed", token: token.name,
          message: `Update failed and rollback requires GM inspection: ${rollbackError.message}` };
      }
    }
    return { status: "failed", token: token.name, message: error.message };
  } finally {
    activeOperations.delete(token.uuid);
  }
}

/** Summarized results; all mutations stay restricted to the current scene's unlinked token Actors. */
export async function runSelected(action, { sceneId, tokenIds }, configuration, preset = "custom", { stealth = true } = {}) {
  const tokens = resolveTokens(sceneId, tokenIds);
  if (!tokens.length) throw new Error("Selected tokens no longer exist in the active scene.");
  if (!["apply", "update", "remove"].includes(action)) throw new Error("Unknown enhancement action.");
  const config = action !== "remove" ? validateEnhancement(configuration) : null;
  if (typeof stealth !== "boolean") throw new Error("Invalid Stealth Mode selection.");
  const results = [];
  for (const token of tokens) {
    results.push(action === "apply" ? await applyOne(token, config, preset, stealth) :
      action === "update" ? await updateOne(token, config, preset, stealth) : await removeOne(token, stealth));
  }
  const successes = results.filter(r => r.status === "applied" || r.status === "updated" || r.status === "removed").length;
  const failures = results.filter(r => r.status === "failed").length;
  const skips = results.filter(r => r.status === "skipped").length;
  const warnings = results.filter(r => r.status === "removed" && r.message).length;
  console.info(`${LOG} 📦 | ${action}: ${successes} succeeded, ${skips} skipped, ${failures} failed`, results);
  if (failures) ui.notifications.error(`NPC Enhancer: ${successes} succeeded, ${failures} failed. See console.`);
  else if (warnings) ui.notifications.warn(`NPC Enhancer: ${successes} restored; ${warnings} may have already lost their HP effect. See console.`);
  else if (skips) ui.notifications.warn(`NPC Enhancer: ${successes} succeeded, ${skips} skipped. See console.`);
  else ui.notifications.info(`NPC Enhancer: ${successes} NPC${successes === 1 ? "" : "s"} ${action === "apply" ? "enhanced" : action === "update" ? "updated" : "restored"}.`);
  return results;
}
