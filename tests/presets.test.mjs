import test from "node:test";
import assert from "node:assert/strict";
import { PRESETS, validateEnhancement, hpBonus, reversedHp, effectChanges } from "../scripts/presets.mjs";

test("all presets validate", () => {
  for (const preset of Object.values(PRESETS)) assert.deepEqual(validateEnhancement(preset), preset);
});
test("invalid and no-op configurations rejected", () => {
  assert.throws(() => validateEnhancement({hpPercent:99,ac:0,attack:0,damage:0,saves:0}));
  assert.throws(() => validateEnhancement({hpPercent:100,ac:0,attack:0,damage:0,saves:0}));
  assert.throws(() => validateEnhancement({hpPercent:150,ac:12,attack:0,damage:0,saves:0}));
});
test("HP bonus uses base max and does not overwrite existing wounds", () => {
  assert.equal(hpBonus(100,150),50);
  assert.equal(hpBonus(75,150),38);
  assert.equal(hpBonus(100,200),100);
});
test("HP reversal preserves damage and never goes negative", () => {
  assert.deepEqual(reversedHp(150,110,50), {max:100,value:60});
  assert.deepEqual(reversedHp(150,30,50), {max:100,value:0});
  assert.deepEqual(reversedHp(150,150,50), {max:100,value:100});
  assert.deepEqual(reversedHp(100,70,0), {max:100,value:70});
});
test("5.2.x Active Effect produces old-schema roll bonuses and numeric max HP value", () => {
  const changes=effectChanges(PRESETS.elite,2,50);
  assert.equal(changes.length,11);
  assert(changes.some(c=>c.key==="system.attributes.hp.max"&&c.value==="50"&&c.mode===2));
  assert(changes.some(c=>c.key==="system.attributes.ac.bonus"&&c.value==="1"));
  assert(changes.some(c=>c.key==="system.bonuses.abilities.save"&&c.value==="1"));
  assert(changes.some(c=>c.key==="system.bonuses.mwak.attack"&&c.value==="1"));
  assert(changes.some(c=>c.key==="system.bonuses.msak.damage"&&c.value==="2"));
});
test("Sturdy creates a visible HP Active Effect instead of empty changes", () => {
  assert.deepEqual(effectChanges(PRESETS.sturdy,2,50), [
    { key: "system.attributes.hp.max", mode: 2, value: "50", priority: 20 }
  ]);
  assert.deepEqual(effectChanges(PRESETS.sturdy,2,0), []);
  assert.throws(() => effectChanges(PRESETS.sturdy, 2, -50), /HP bonus/);
});
