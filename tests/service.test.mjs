import test from "node:test";
import assert from "node:assert/strict";
import { runSelected, selectedTokenIds, inspectSelection, verifyEnvironment } from "../scripts/service.mjs";
import { PRESETS, MODULE_ID } from "../scripts/presets.mjs";

function setup({ actorType = "npc", actorLink = false, gm = true, owner = true, hp = 100, value = 70, version = "5.2.5" } = {}) {
  const tokenFlags = new Map();
  const source = { hp: { max: hp, value } };
  let effectSequence = 0;
  const effects = new Map();
  effects.find = predicate => [...effects.values()].find(predicate);
  const actor = {
    type: actorType, isOwner: owner, effects, _updates: [],
    system: { attributes: { hp: { max: hp, value } } },
    _baseMax: hp,
    prepareData() {
      const bonus = [...effects.values()].filter(e => !e.disabled)
        .flatMap(e => e.changes ?? [])
        .filter(c => c.key === "system.attributes.hp.max" && c.mode === 2)
        .reduce((sum, c) => sum + Number(c.value), 0);
      this.system.attributes.hp.max = this._baseMax + bonus;
      this.system.attributes.hp.value = Math.min(this.system.attributes.hp.max, this.system.attributes.hp.value);
    },
    async createEmbeddedDocuments(type, payloads) {
      assert.equal(type,"ActiveEffect");
      return payloads.map(data=>{
        const id=`effect${++effectSequence}`;
        const effect={...data,id,getFlag(ns,key){return this.flags?.[ns]?.[key]},
          async update(changes){
            for (const [key,value] of Object.entries(changes)) {
              if (key === `flags.${MODULE_ID}`) this.flags[MODULE_ID]=structuredClone(value);
              else if (key === `flags.${MODULE_ID}.stealth`) (this.flags[MODULE_ID] ??= {}).stealth=value;
              else this[key]=structuredClone(value);
            }
            actor.prepareData();
          }};
        effects.set(id,effect);return effect;
      }).map(effect => { this.prepareData(); return effect; });
    },
    async deleteEmbeddedDocuments(type, ids) { for (const id of ids) effects.delete(id); this.prepareData(); },
    async update(changes, options = {}) {
      this._updates.push({ changes: structuredClone(changes), options: structuredClone(options) });
      const hp=this.system.attributes.hp;
      if (changes["system.attributes.hp.max"]!==undefined) this._baseMax=changes["system.attributes.hp.max"];
      if (changes["system.attributes.hp.value"]!==undefined) hp.value=changes["system.attributes.hp.value"];
      this.prepareData();
    }
  };
  const token={
    id:"abc",uuid:"Scene.scene1.Token.abc",name:"Test Orc",actor,actorLink,
    getFlag:(ns,key)=>tokenFlags.get(`${ns}.${key}`),
    async setFlag(ns,key,val){tokenFlags.set(`${ns}.${key}`,structuredClone(val));},
    async unsetFlag(ns,key){tokenFlags.delete(`${ns}.${key}`);}
  };
  const tokens=new Map([[token.id,token]]);
  globalThis.game={release:{generation:13},version:"13.351",system:{id:"dnd5e",version},user:{isGM:gm}};
  globalThis.canvas={scene:{id:"scene1",tokens},tokens:{controlled:[{document:token}]}};
  globalThis.CONST={ACTIVE_EFFECT_MODES:{ADD:2}};
  globalThis.foundry={utils:{deepClone:structuredClone}};
  globalThis.ui={notifications:{info(){},warn(){},error(){}}};
  return {token,actor,source,ids:{sceneId:"scene1",tokenIds:["abc"]}};
}

test("apply elite, take damage, remove: preserve wounds and source",async()=>{
  const {token,actor,source,ids}=setup();
  assert.deepEqual(selectedTokenIds(),ids);
  let r=await runSelected("apply",ids,PRESETS.elite,"elite");
  assert.equal(r[0].status,"applied");
  assert.equal(actor.system.attributes.hp.max,150);
  assert.equal(actor.system.attributes.hp.value,120);
  assert.equal(actor.effects.size,1);
  assert.equal(actor._baseMax,100,"original numeric max is unchanged by the v2 effect");
  assert.equal(token.getFlag(MODULE_ID,"enhancement").schema,2);
  assert.equal(token.getFlag(MODULE_ID,"enhancement").hpDelta,50);
  assert.equal([...actor.effects.values()][0].changes.length,11);
  assert([...actor.effects.values()][0].changes.some(c => c.key === "system.attributes.hp.max" && c.value === "50"));
  actor.system.attributes.hp.value-=30;
  r=await runSelected("remove",ids);
  assert.equal(r[0].status,"removed");
  assert.deepEqual(actor.system.attributes.hp,{max:100,value:40});
  assert.equal(actor.effects.size,0);
  assert.equal(token.getFlag(MODULE_ID,"enhancement"),undefined);
  assert.deepEqual(source.hp,{max:100,value:70});
});
test("repeated apply prevented, repeated remove skips",async()=>{
  const {actor,ids}=setup();
  assert.equal((await runSelected("apply",ids,PRESETS.elite,"elite"))[0].status,"applied");
  assert.equal((await runSelected("apply",ids,PRESETS.boss,"boss"))[0].status,"skipped");
  assert.equal(actor.system.attributes.hp.max,150);
  assert.equal((await runSelected("remove",ids))[0].status,"removed");
  assert.equal((await runSelected("remove",ids))[0].status,"skipped");
});
test("linked tokens are untouched",async()=>{
  const {actor,ids}=setup({actorLink:true});
  assert.equal((await runSelected("apply",ids,PRESETS.boss,"boss"))[0].status,"skipped");
  assert.equal(actor.system.attributes.hp.max,100);
  assert.equal(actor.effects.size,0);
});
test("player characters are untouched",async()=>{
  const {actor,ids}=setup({actorType:"character"});
  assert.equal((await runSelected("apply",ids,PRESETS.boss,"boss"))[0].status,"skipped");
  assert.equal(actor.system.attributes.hp.max,100);
});
test("non-GM and incompatible D&D5e are blocked",async()=>{
  setup({gm:false});assert.throws(()=>verifyEnvironment(),/Only a GM/);
  setup({version:"5.3.3"});assert.doesNotThrow(()=>verifyEnvironment());
  setup({version:"6.0.0"});assert.throws(()=>verifyEnvironment(),/5.2.x or 5.3.x/);
});
test("manually deleted stat effect still allows recorded HP removal",async()=>{
  const {actor,ids}=setup();
  assert.equal((await runSelected("apply",ids,PRESETS.sturdy,"sturdy"))[0].status,"applied");
  actor.effects.clear();
  actor.prepareData();
  const result = (await runSelected("remove",ids))[0];
  assert.equal(result.status,"removed");
  assert.match(result.message, /already deleted/);
  assert.deepEqual(actor.system.attributes.hp,{max:100,value:100});
});

// A dev.2 token may be upgraded to dev.3 without removing its old buff first.
test("dev.2 token-local max HP state removes correctly after upgrading the module", async () => {
  const { token, actor, ids } = setup();
  const data = { name: "ZFT NPC Enhancement (elite)", changes: [{ key: "system.attributes.ac.bonus", mode: 2, value: "1" }],
    flags: { [MODULE_ID]: { kind: "enhancement" } } };
  const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  actor._baseMax = 150;
  actor.system.attributes.hp.value = 120;
  actor.prepareData();
  await token.setFlag(MODULE_ID, "enhancement", { schema: 1, effectId: effect.id, appliedTo: token.id,
    hpDelta: 50, hpReverted: false });
  actor.system.attributes.hp.value -= 20;
  const result = await runSelected("remove", ids);
  assert.equal(result[0].status, "removed");
  assert.deepEqual(actor.system.attributes.hp, { max: 100, value: 50 });
  assert.equal(actor.effects.size, 0);
});

test("new Sturdy effect carries concrete HP value and survives remove", async () => {
  const { actor, ids } = setup({ hp: 75, value: 55 });
  const result = await runSelected("apply", ids, PRESETS.sturdy, "sturdy");
  assert.equal(result[0].status, "applied");
  assert.deepEqual([...actor.effects.values()][0].changes.map(c => [c.key, c.value]), [["system.attributes.hp.max", "38"]]);
  assert.deepEqual(actor.system.attributes.hp, { max: 113, value: 93 });
  const out = await runSelected("remove", ids);
  assert.equal(out[0].status, "removed");
  assert.deepEqual(actor.system.attributes.hp, { max: 75, value: 55 });
});

test("only AC enhancement writes correct effect value without changing HP", async () => {
  const { actor, ids } = setup({ hp: 125, value: 100 });
  const config = { hpPercent: 100, ac: 2, attack: 0, damage: 0, saves: 0 };
  const result = await runSelected("apply", ids, config, "custom");
  assert.equal(result[0].status, "applied");
  const [effect] = [...actor.effects.values()];
  assert.deepEqual(effect.changes.map(c => [c.key, c.mode, c.value]), [["system.attributes.ac.bonus", 2, "2"]]);
  assert.deepEqual(actor.system.attributes.hp, { max: 125, value: 100 });
  assert.equal((await runSelected("remove", ids))[0].status, "removed");
  assert.deepEqual(actor.system.attributes.hp, { max: 125, value: 100 });
});

test("other effects survive managed enhancement removal", async () => {
  const { actor, ids } = setup();
  const [foreign] = await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: "Bless", changes: [{ key: "system.bonuses.abilities.save", mode: 2, value: "1d4" }], flags: {}
  }]);
  assert.equal((await runSelected("apply", ids, PRESETS.boss, "boss"))[0].status, "applied");
  const [enhanced] = [...actor.effects.values()].filter(e => e.id !== foreign.id);
  assert(enhanced.changes.some(c => c.key === "system.bonuses.abilities.save" && c.value === "2"));
  assert.equal((await runSelected("remove", ids))[0].status, "removed");
  assert.equal(actor.effects.size, 1);
  assert.equal(actor.effects.get(foreign.id), foreign);
});


test("selection status reports no buff, enhanced preset and unsupported linked NPC", async () => {
  const {token, ids}=setup();
  assert.equal(inspectSelection(ids)[0].status, "unenhanced");
  await runSelected("apply", ids, PRESETS.elite, "elite");
  const current=inspectSelection(ids)[0];
  assert.equal(current.status,"enhanced");
  assert.equal(current.preset,"elite");
  assert.equal(current.canUpdate,true);
  assert.deepEqual(current.config, PRESETS.elite);
  token.actorLink=true;
  assert.equal(inspectSelection(ids)[0].status,"unsupported");
});

test("update in place preserves original effect ID and previously dealt damage",async()=>{
  const {token,actor,ids}=setup();
  assert.equal((await runSelected("apply",ids,PRESETS.elite,"elite"))[0].status,"applied");
  const original=[...actor.effects.keys()][0];
  actor.system.attributes.hp.value -= 25;
  assert.equal((await runSelected("update",ids,PRESETS.boss,"boss"))[0].status,"updated");
  assert.equal(actor.system.attributes.hp.max,200);
  assert.equal(actor.system.attributes.hp.value,145); // 30 existing wounds + 25 recent wounds
  assert.equal([...actor.effects.keys()][0],original,"effect ID must not change");
  assert.equal(actor.effects.size,1);
  const effect=actor.effects.get(original);
  assert(effect.changes.some(c=>c.key==="system.attributes.hp.max"&&c.value==="100"));
  assert.equal(effect.flags[MODULE_ID].preset,"boss");
  assert.equal(token.getFlag(MODULE_ID,"enhancement").preset,"boss");
  assert.equal((await runSelected("remove",ids))[0].status,"removed");
  assert.equal(actor.system.attributes.hp.max,100);
  assert.equal(actor.system.attributes.hp.value,45);
});

test("update to lower HP percent keeps wounds and does not recreate effect",async()=>{
  const {actor,ids}=setup();
  await runSelected("apply",ids,PRESETS.boss,"boss");
  const original=[...actor.effects.keys()][0];
  actor.system.attributes.hp.value -= 10;
  const flat={hpPercent:100,ac:2,attack:0,damage:0,saves:0};
  assert.equal((await runSelected("update",ids,flat,"custom"))[0].status,"updated");
  assert.equal(actor.system.attributes.hp.max,100);
  assert.equal(actor.system.attributes.hp.value,60);
  assert.equal([...actor.effects.keys()][0],original);
  assert.deepEqual(actor.effects.get(original).changes.map(c=>c.key),["system.attributes.ac.bonus"]);
  await runSelected("remove",ids);
  assert.equal(actor.system.attributes.hp.value,60);
});

test("legacy enhancements cannot update without an explicit removal",async()=>{
  const {token,actor,ids}=setup();
  const [effect]=await actor.createEmbeddedDocuments("ActiveEffect", [{
    name:"Old",changes:[],flags:{[MODULE_ID]:{kind:"enhancement",schema:1}}
  }]);
  actor._baseMax=150;actor.system.attributes.hp.value=120;actor.prepareData();
  await token.setFlag(MODULE_ID,"enhancement",{schema:1,effectId:effect.id,appliedTo:token.id,hpDelta:50,hpReverted:false});
  const state=inspectSelection(ids)[0];
  assert.equal(state.status,"enhanced");
  assert.equal(state.canUpdate,false);
  assert.equal((await runSelected("update",ids,PRESETS.boss,"boss"))[0].status,"skipped");
  assert.equal(actor.system.attributes.hp.max,150);
  assert.equal(actor.effects.size,1);
});

test("unknown actions fail before changing any token",async()=>{
  const {actor,ids}=setup();
  await assert.rejects(()=>runSelected("nonsense",ids,PRESETS.elite),/Unknown enhancement action/);
  assert.equal(actor.effects.size,0);
});

// Targeted privacy regression: inspect recorded document updates, not just flag shape.
test("Stealth Mode defaults on, flags created effect and silences own HP changes", async () => {
  const { actor, token, ids } = setup();
  const [applied] = await runSelected("apply", ids, PRESETS.elite, "elite");
  assert.equal(applied.status, "applied");
  const effect = [...actor.effects.values()][0];
  assert.equal(effect.getFlag(MODULE_ID, "stealth"), true);
  assert.equal(token.getFlag(MODULE_ID, "enhancement").stealth, true);
  assert.equal(actor._updates[0].options.isAdvancement, true);
  assert.equal(actor._updates[0].options.zftNpcEnhancer.stealth, true);
  actor.system.attributes.hp.value -= 10;
  assert.equal((await runSelected("remove", ids))[0].status, "removed");
  assert(actor._updates.at(-1).options.isAdvancement);
  assert.equal(actor.effects.size, 0);
  assert.equal(actor.system.attributes.hp.value, 60);
});

test("Opting out of Stealth Mode shows standard text but keeps HP concentration protected", async () => {
  const { actor, token, ids } = setup();
  assert.equal((await runSelected("apply", ids, PRESETS.elite, "elite", { stealth: false }))[0].status, "applied");
  assert.equal([...actor.effects.values()][0].getFlag(MODULE_ID, "stealth"), false);
  assert.equal(actor._updates[0].options.isAdvancement, undefined);
  assert.equal(actor._updates[0].options.dnd5e.concentrationCheck, false);
  assert.equal(token.getFlag(MODULE_ID, "enhancement").stealth, false);
  assert.equal((await runSelected("update", ids, PRESETS.boss, "boss", { stealth: false }))[0].status, "updated");
  assert.equal(actor._updates.at(-1).options.isAdvancement, undefined);
  assert.equal((await runSelected("remove", ids, null, "custom", { stealth: false }))[0].status, "removed");
  assert.equal(actor.effects.size, 0);
  assert.equal(actor.system.attributes.hp.value, 70);
});

test("Stealth update changes effect flag in place, preserving ID and wounds", async () => {
  const { actor, ids } = setup();
  await runSelected("apply", ids, PRESETS.elite, "elite", { stealth: false });
  const effect = [...actor.effects.values()][0];
  actor.system.attributes.hp.value -= 23;
  assert.equal((await runSelected("update", ids, PRESETS.boss, "boss", { stealth: true }))[0].status, "updated");
  assert.strictEqual([...actor.effects.values()][0], effect);
  assert.equal(effect.getFlag(MODULE_ID, "stealth"), true);
  assert.equal(actor.system.attributes.hp.value, 147);
  assert.equal(actor._updates.at(-1).options.isAdvancement, true);
  await runSelected("remove", ids, null, "custom", { stealth: true });
  assert.equal(actor.system.attributes.hp.value, 47);
});

test("A dev.6 enhancement without stealth flag can be silently removed", async () => {
  const { actor, ids } = setup();
  await runSelected("apply", ids, PRESETS.elite, "elite", { stealth: false });
  const effect = [...actor.effects.values()][0];
  delete effect.flags[MODULE_ID].stealth;
  assert.equal(effect.getFlag(MODULE_ID, "stealth"), undefined);
  const result = await runSelected("remove", ids, null, "custom", { stealth: true });
  assert.equal(result[0].status, "removed");
  assert.equal(effect.getFlag(MODULE_ID, "stealth"), true, "effect flagged before deletion");
  assert.equal(actor.system.attributes.hp.value, 70);
});

test("invalid Stealth Mode argument is rejected before any change", async () => {
  const { actor, ids } = setup();
  await assert.rejects(runSelected("apply", ids, PRESETS.elite, "elite", { stealth: "yes" }), /Invalid Stealth/);
  assert.equal(actor.effects.size, 0);
});
