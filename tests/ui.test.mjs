/** Persistent V13 GUI and single tool regression suite. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { openEnhancer, removeEnhancer } from "../scripts/ui.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const css = readFileSync(join(root, "styles/main.css"), "utf8");
const main = readFileSync(join(root, "scripts/main.mjs"), "utf8");
let lastDialog, activeTestRoot;
const hooks = new Map();
globalThis.Hooks = {
  on(event, fn) { hooks.set(event, fn); return fn; },
  off(event, fn) { if (hooks.get(event) === fn) hooks.delete(event); }
};
class FakeDialog {
  constructor(config, options) { this.config = config; this.options = options; lastDialog = this; this.rendered = false; }
  render() { this.rendered = true; this.config.render(activeTestRoot); return this; }
  bringToTop() { this.raised = true; }
  close() { this.rendered = false; this.config.close(); }
}
globalThis.Dialog = FakeDialog;
const plain = { name: '<Orc & "Captain">', id: "t1", actorLink: false,
  actor: { type: "npc", isOwner: true, effects: { find:()=>null } }, getFlag:()=>null };
const enhanced = { name: "Elite Ogre", id: "t2", actorLink: false,
  actor: { type: "npc", isOwner: true, effects: { find:()=>({id:"fx2", disabled:false,getFlag:(_,key)=>({kind:"enhancement",schema:2})[key]}) } },
  getFlag:()=>({schema:2,hpMode:"activeEffect",effectId:"fx2",appliedTo:"t2",
    hpReverted:false,config:{hpPercent:150,ac:1,attack:1,damage:2,saves:1},preset:"elite"}) };
const tokens = new Map([["t1",plain],["t2",enhanced]]);
globalThis.game = { version:"13.351",release:{generation:13},system:{id:"dnd5e",version:"5.2.5"},user:{isGM:true},
  modules:new Map([["zft-npc-enhancer",{active:true}]]) };
globalThis.canvas = {scene:{id:"scene1",tokens},tokens:{controlled:[]}};
globalThis.ui = {notifications:{warn(){},info(){},error(){}}};

function fakeRoot() {
  const named = new Map([
    ["preset",{value:"elite",listeners:{},addEventListener(type,cb){this.listeners[type]=cb}}],
    ...["hpPercent","ac","attack","damage","saves"].map(name=>[name,{value:0,listeners:{},addEventListener(type,cb){this.listeners[type]=cb}}]),
    ["stealth",{checked:true,listeners:{},addEventListener(type,cb){this.listeners[type]=cb}}]
  ]);
  const form = {elements:{namedItem:key=>named.get(key)},addEventListener(type,cb){this.listener=cb}};
  const elements = new Map([
    ["form.zft-npc-enhancer-form",form],
    ...[".zft-ne-preset-help",".zft-ne-count",".zft-ne-token-list",".zft-ne-selection-help",".zft-ne-result"]
      .map(name=>[name,{textContent:"",innerHTML:""}]),
    ...["apply","update","remove","close"].map(name=>[`[data-ne-action="${name}"]`,{
      hidden:false,disabled:false,listener:null,label:{textContent:""},querySelector(){return this.label},
      addEventListener(type,cb){this.listener=cb}
    }])
  ]);
  return {nodes:elements,named,querySelector:s=>elements.get(s),querySelectorAll:()=>["apply","update","remove","close"].map(x=>elements.get(`[data-ne-action="${x}"]`))};
}
function button(action) { return activeTestRoot.nodes.get(`[data-ne-action="${action}"]`); }
function choose(...tokens) {
  canvas.tokens.controlled=tokens.map(document=>({document}));
  hooks.get("controlToken")?.();
}

test("a single toolbar opener is registered, with no second remove tool", () => {
  assert.match(main,/name: "npc-enhancer"/);
  assert.doesNotMatch(main,/name: "npc-enhance-remove"/);
  assert.match(css, /zft-npc-enhancer-select/);
});

test("GM window opens with no token, is singleton and stays open", () => {
  activeTestRoot=fakeRoot(); choose();
  const d=openEnhancer();
  assert.deepEqual(d.options.classes,["dialog","zft-npc-enhancer-dialog"]);
  assert.equal(d.options.width,460);
  assert.equal(d.options.height,"auto");
  assert.deepEqual(d.config.buttons,{});
  assert.doesNotMatch(d.config.content,/class="zft-ne-intro"/, "redundant introduction removed");
  assert.doesNotMatch(d.config.content, /<h2>NPC Enhancement<\/h2>/, "native window title is not repeated");
  assert.match(d.config.content, /zft-ne-stat-grid/);
  assert.match(d.config.content, /zft-ne-preset-row/);
  assert.match(activeTestRoot.nodes.get(".zft-ne-token-list").innerHTML,/Select NPCs on the canvas/);
  assert.equal(button("apply").hidden,true);
  assert.equal(button("update").hidden,true);
  assert.equal(button("remove").hidden,true);
  assert.strictEqual(openEnhancer(),d);
  assert.equal(d.raised,true);
  assert.equal(d.rendered,true);
  d.close();
  assert.equal(hooks.size,0);
});

test("live selection shows no buff, existing buff, and only appropriate actions", () => {
  activeTestRoot=fakeRoot(); choose();
  const dialog=openEnhancer();
  choose(plain);
  assert.match(activeTestRoot.nodes.get(".zft-ne-token-list").innerHTML,/&lt;Orc &amp; &quot;Captain&quot;&gt;/);
  assert.match(activeTestRoot.nodes.get(".zft-ne-token-list").innerHTML,/Not enhanced/);
  assert.equal(button("apply").hidden,false);
  assert.equal(button("update").hidden,true);
  assert.equal(button("remove").hidden,true);
  // Preset remains unchanged as we continue working on new tokens.
  activeTestRoot.named.get("preset").value="boss";
  choose(enhanced);
  assert.match(activeTestRoot.nodes.get(".zft-ne-token-list").innerHTML,/Enhanced: elite/);
  assert.equal(button("apply").hidden,true);
  assert.equal(button("update").hidden,false);
  assert.equal(button("remove").hidden,false);
  assert.equal(activeTestRoot.named.get("preset").value,"elite", "single enhanced token loads its values");
  choose(plain,enhanced);
  assert.equal(button("apply").hidden,false);
  assert.equal(button("update").hidden,false);
  assert.equal(button("remove").hidden,false);
  choose();
  assert.equal(button("apply").hidden,true);
  dialog.close();
});

test("preset controls still populate numeric fields and support Custom", () => {
  activeTestRoot=fakeRoot();choose();
  const dialog=openEnhancer();
  const preset=activeTestRoot.named.get("preset");
  preset.value="boss";preset.listeners.change();
  assert.equal(activeTestRoot.named.get("hpPercent").value,200);
  assert.equal(activeTestRoot.named.get("damage").value,4);
  activeTestRoot.named.get("damage").listeners.input();
  assert.equal(preset.value,"custom");
  assert.match(activeTestRoot.nodes.get(".zft-ne-preset-help").textContent,/individually/);
  dialog.close();
});

test("X or Close button is an intentional exit; legacy remove API opens same window", () => {
  activeTestRoot=fakeRoot();choose();
  const d=removeEnhancer();
  assert.strictEqual(openEnhancer(),d);
  button("close").listener();
  assert.equal(hooks.size,0);
  assert.equal(d.rendered,false);
});

test("styles use scoped ZFT branding, focus and reduced-motion support", () => {
  assert.match(css,/\.zft-npc-enhancer-dialog\s*\{/);
  assert.match(css,/--zft-ne-accent:\s*#28e887/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/\.zft-ne-actions button\[hidden\]/);
  assert.doesNotMatch(css,/(^|\n)\s*(?:body|:root|\.window-content)\s*\{/);
});


test("compact square layout uses 3+2 stat grid and no default nested scrollbars", () => {
  assert.match(css,/grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(css,/nth-child\(n\+4\)\s*\{\s*grid-column:\s*span 3/);
  assert.match(css,/@container \(max-width: 365px\)/);
  assert.match(css,/\.window-content\s*\{[^}]*overflow: visible/s);
  assert.match(css,/\.zft-ne-token-list\s*\{[^}]*overflow: visible/s);
  assert.match(css,/zft-ne-viewport-constrained \.window-content/);
  assert.match(css,/@media \(max-width: 480px\)/);
  assert.doesNotMatch(css,/position:\s*sticky/);
});

test("auto-sizing follows changing selection and falls back only when viewport is too short", () => {
  const previousWindow = globalThis.window;
  const previousFrame = globalThis.requestAnimationFrame;
  let resizeHandler, constrained = false, rectTop = 90;
  globalThis.window = { innerHeight: 740, addEventListener:(_name,fn)=>{resizeHandler=fn;},removeEventListener:()=>{} };
  globalThis.requestAnimationFrame = fn => fn();
  try {
    activeTestRoot = fakeRoot();
    activeTestRoot.nodes.set(".zft-ne-shell", { scrollHeight: 285 });
    const app = {
      querySelector:s=>s===".window-header"?{offsetHeight:33}:null,
      getBoundingClientRect:()=>({top:rectTop}),
      classList:{toggle:(_name,state)=>{constrained=state;}}
    };
    activeTestRoot.closest = ()=>app;
    choose();
    const d = openEnhancer();
    d.setPosition = function(position) {this.fitted = position;};
    choose(plain);
    assert.equal(d.fitted.height,"auto");
    assert.equal(constrained,false);
    window.innerHeight = 230;
    resizeHandler();
    assert.equal(constrained,true);
    assert.equal(d.fitted.height,206);
    window.innerHeight = 740;
    resizeHandler();
    assert.equal(constrained,false);
    assert.equal(d.fitted.height,"auto");
    d.close();
  } finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousFrame === undefined) delete globalThis.requestAnimationFrame; else globalThis.requestAnimationFrame = previousFrame;
  }
});


test("small-window layout removes redundant intro while preserving all five controls and action buttons", () => {
  activeTestRoot=fakeRoot(); choose();
  const d=openEnhancer();
  assert.equal(d.options.width,460);
  assert.doesNotMatch(d.config.content,/zft-ne-intro/);
  for (const field of ["hpPercent","ac","attack","damage","saves"]) {
    assert.match(d.config.content,new RegExp(`name="${field}"`));
  }
  for (const action of ["apply","update","remove","close"]) {
    assert.match(d.config.content,new RegExp(`data-ne-action="${action}"`));
  }
  assert.match(css,/zft-ne-editor\s*\{\s*container-type:\s*inline-size/);
  assert.match(css,/\.zft-ne-stat-grid \.zft-ne-field:last-child\s*\{\s*grid-column:\s*1 \/ -1/);
  d.close();
});

test("compact Stealth Mode checkbox defaults on and remains after selecting other tokens", () => {
  activeTestRoot=fakeRoot();choose();
  const d=openEnhancer();
  assert.match(d.config.content, /name="stealth"/);
  assert.match(d.config.content, /fa-eye-slash/);
  assert.equal(activeTestRoot.named.get("stealth").checked,true);
  choose(plain); choose(enhanced); choose();
  assert.equal(activeTestRoot.named.get("stealth").checked,true);
  assert.match(css, /zft-ne-stealth/);
  d.close();
});
