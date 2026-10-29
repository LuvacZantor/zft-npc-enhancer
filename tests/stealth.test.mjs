import test from "node:test";
import assert from "node:assert/strict";
import { STEALTH_SETTING, getStealthPreference, hpUpdateOptions, installStealthStatusFilter,
  registerStealthSetting } from "../scripts/stealth.mjs";
import { MODULE_ID } from "../scripts/presets.mjs";

test("client setting defaults on and is not a world setting", () => {
  let definition;
  const values = new Map();
  globalThis.game = { settings: {
    register(ns, name, data) { assert.equal(ns, MODULE_ID); assert.equal(name, STEALTH_SETTING); definition=data; },
    get(ns,name) {return values.get(`${ns}.${name}`) ?? definition.default;}
  } };
  registerStealthSetting();
  assert.equal(definition.scope, "client");
  assert.equal(definition.default, true);
  assert.equal(definition.config, false);
  assert.equal(getStealthPreference(), true);
  values.set(`${MODULE_ID}.${STEALTH_SETTING}`,false);
  assert.equal(getStealthPreference(), false);
});

test("HP update options suppress only NPC Enhancer bookkeeping", () => {
  assert.deepEqual(hpUpdateOptions(true), {isAdvancement:true,dnd5e:{concentrationCheck:false},zftNpcEnhancer:{stealth:true}});
  assert.deepEqual(hpUpdateOptions(false), {dnd5e:{concentrationCheck:false}});
});

test("V13 scrolling effects use a narrow wrapper shared by GM/player; unrelated effects pass through", () => {
  let calls=0;
  class MockEffect {
    constructor(flags) { this.flags=flags; }
    getFlag(ns,key) {return this.flags?.[ns]?.[key];}
    _displayScrollingStatus(enabled) { calls++; return `displayed:${enabled}`; }
  }
  globalThis.CONFIG={ActiveEffect:{documentClass:MockEffect}};
  assert.equal(installStealthStatusFilter(),true);
  const original=MockEffect.prototype._displayScrollingStatus;
  assert.equal(installStealthStatusFilter(),true);
  assert.equal(MockEffect.prototype._displayScrollingStatus,original, "install is idempotent");
  const silent=new MockEffect({[MODULE_ID]:{kind:"enhancement",stealth:true}});
  const loud=new MockEffect({[MODULE_ID]:{kind:"enhancement",stealth:false}});
  const legacy=new MockEffect({[MODULE_ID]:{kind:"enhancement"}});
  const other=new MockEffect({"other-module":{kind:"enhancement",stealth:true}});
  assert.equal(silent._displayScrollingStatus(true),undefined);
  assert.equal(calls,0);
  assert.equal(loud._displayScrollingStatus(true),"displayed:true");
  assert.equal(legacy._displayScrollingStatus(false),"displayed:false");
  assert.equal(other._displayScrollingStatus(true),"displayed:true");
  assert.equal(calls,3);
});
