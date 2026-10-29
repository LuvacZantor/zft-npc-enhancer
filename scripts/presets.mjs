/** ZFT NPC Enhancer v13.0.0-dev.7 — pure, testable preset rules. */
export const MODULE_ID = "zft-npc-enhancer";
export const VERSION = "13.0.0-dev.7";

export const PRESETS = Object.freeze({
  sturdy: Object.freeze({ hpPercent: 150, ac: 0, attack: 0, damage: 0, saves: 0 }),
  elite:  Object.freeze({ hpPercent: 150, ac: 1, attack: 1, damage: 2, saves: 1 }),
  boss:   Object.freeze({ hpPercent: 200, ac: 2, attack: 2, damage: 4, saves: 2 })
});

const LIMITS = Object.freeze({
  hpPercent: [100, 300], ac: [0, 5], attack: [0, 5], damage: [0, 10], saves: [0, 5]
});

export function validateEnhancement(input) {
  if (!input || typeof input !== "object") throw new Error("Missing enhancement configuration.");
  const result = {};
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    const value = Number(input[key]);
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(`${key} must be an integer between ${min} and ${max}.`);
    }
    result[key] = value;
  }
  if (result.hpPercent === 100 && result.ac === 0 && result.attack === 0 &&
      result.damage === 0 && result.saves === 0) {
    throw new Error("Select at least one nonzero enhancement.");
  }
  return result;
}

/** Add only the additional HP, not a replacement total. */
export function hpBonus(max, hpPercent) {
  if (!Number.isSafeInteger(max) || max < 1) throw new Error("NPC maximum HP must be a positive integer.");
  if (!Number.isInteger(hpPercent) || hpPercent < 100 || hpPercent > 300) {
    throw new Error("HP percentage is outside the supported range.");
  }
  return Math.round(max * (hpPercent - 100) / 100);
}

/** Prevent unbuffing from healing damage, introducing negative HP, or leaving value above max. */
export function reversedHp(max, current, bonus) {
  if (![max, current, bonus].every(Number.isSafeInteger) || bonus < 0) {
    throw new Error("Invalid HP state for reversal.");
  }
  const nextMax = Math.max(1, max - bonus);
  const nextValue = Math.min(nextMax, Math.max(0, current - bonus));
  return { max: nextMax, value: nextValue };
}

/** D&D5e 5.2.x–5.3.x paths, not the redesigned D&D5e 6.x roll paths. */
export function effectChanges(config, addMode, hpDelta = 0) {
  if (!Number.isSafeInteger(hpDelta) || hpDelta < 0) throw new Error("Invalid calculated HP bonus.");
  const changes = [];
  const push = (key, bonus) => {
    if (bonus > 0) changes.push({ key, mode: addMode, value: String(bonus), priority: 20 });
  };
  // D&D5e NPC HP max is a numeric schema field. Keeping this value in the
  // managed effect makes it visible, reversible, and token-local.
  push("system.attributes.hp.max", hpDelta);
  push("system.attributes.ac.bonus", config.ac);
  for (const type of ["mwak", "rwak", "msak", "rsak"]) {
    push(`system.bonuses.${type}.attack`, config.attack);
    push(`system.bonuses.${type}.damage`, config.damage);
  }
  push("system.bonuses.abilities.save", config.saves);
  return changes;
}
