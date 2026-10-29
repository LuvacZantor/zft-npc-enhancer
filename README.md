# ZFT NPC Enhancer — v13.0.0-dev.7

**Development build, not live-verified.** First version is specifically for the Friday campaign's production generation: Foundry **V13 Build 351** and D&D5e **5.2.x or 5.3.x**. V14 is not supported by this package.

## Active Effect values (dev.3)

The Active Effect Changes tab now includes a numeric **maximum HP** increase for every preset that raises HP. The effect itself owns this bonus: the Actor's source maximum HP field is no longer overwritten for new enhancements. The module grants current HP once on application, and subtracts that grant before removing the effect, preserving wounds.

On an unlinked NPC token whose original maximum is **100 HP**, the generated Active Effect changes are:

| Preset | HP maximum | AC | Melee/ranged weapon and spell attacks | Melee/ranged weapon and spell damage | Ability saving throws |
| --- | ---: | ---: | ---: | ---: | ---: |
| Sturdy | +50 | — | — | — | — |
| Elite | +50 | +1 | +1 | +2 | +1 |
| Boss | +100 | +2 | +2 | +4 | +2 |

For different starting HP, the HP value is computed from each selected NPC's **own** maximum HP and the preset percentage; odd fractions round to the nearest whole HP. The values use D&D5e 5.2.x/5.3.x Active Effect `ADD` mode, with `system.attributes.hp.max`, `system.attributes.ac.bonus`, `system.bonuses.{mwak,rwak,msak,rsak}.{attack,damage}`, and `system.bonuses.abilities.save`.

**Compatibility with dev.2:** Existing token enhancements applied by dev.2 use an older storage mechanism. The Remove action still recognizes and reverses those legacy values. Remove the old enhancement before reapplying dev.4 if you want to see the HP bonus in the effect's Changes tab.

## Persistent GM window (dev.4)

- **One toolbar icon:** **NPC Enhancer** opens or focuses a single GM window, with or without ZFT Tools installed. The former separate Remove icon is gone.
- The window may be opened **before selecting any NPC**. Changing controlled tokens while it is open refreshes token names and enhancement status without closing the window, repositioning it, or clearing ongoing edits.
- **Unenhanced** NPC: only **Apply** is offered (plus Close). **Enhanced** NPC: **Update** and **Remove** are offered (plus Close). Mixed selections show eligible action buttons with counts; each action only affects tokens in its status category. Unsupported PCs, linked tokens, or actors without ownership are identified and not modified.
- For one previously enhanced NPC, the stored preset and values are loaded for modification. When moving to a new unenhanced NPC, the current preset is retained for convenient repeated use.
- **Update** changes schema 2 managed Active Effect values *in place*, retaining the Active Effect ID and the total number of wounds. It neither stacks a second effect nor modifies unrelated effects. Legacy or partial enhancements cannot be updated automatically; Remove and then Apply them.
- Apply, Update, or Remove does **not close** the window. The native title-bar X or the in-window **Close** button exits. Selection hooks are detached on close.
- The former programmatic `remove()` API still opens the same combined window for compatibility.

## Compact adaptive workspace (dev.5)

The dev.5 V13 GM window opened at approximately 610px wide with a content-sized height. The duplicate large title, tall separate preset/stat panels, per-field description rows, and green information banner have been removed. The compact UI displays selected NPC status, one preset selector, five side-by-side adjustment fields, a short safety note, and context-aware action buttons. The title-bar X and bottom Close action both work; the window remains open after applying, updating, or removing an enhancement.

Selecting different tokens updates their status without resetting in-progress inputs. The app automatically recalculates height when selection changes or the browser resizes. A narrow window wraps stat fields responsively. If many tokens are selected or the viewport is shorter than the content, scrolling remains available as an accessibility fallback instead of clipping controls. This is a **presentation-only** change; enhancement calculations, effect data, ownership checks and rollback semantics match dev.4.

## Smaller, box-shaped workspace (dev.6)

Default V13 Dialog width is now **460 CSS pixels** rather than 610, with a minimal selection/status panel, a condensed preset row, and a **3 + 2** stat field arrangement (HP/AC/Attack above Damage/Saves). The redundant introductory instruction has been removed from occupied selections, and the concise no-selection prompt remains within the status panel. The layout follows window width through scoped CSS container queries, shrinking to two fields per row when manually resized narrower. Height continues to fit the visible content; it only scrolls when the browser viewport is too short or many NPC tokens are selected.

No changes to effects, presets, stored flags, ownership, action controls, or token-selection hooks. Test in V13 351 at normal size, with multiple/long token names, custom values, optional ZFT Tools, and manually resized narrow windows.

## GUI branding

This version follows the central [`UI-STANDARDS.md`](https://github.com/LuvacZantor/zft-standards/blob/main/UI-STANDARDS.md) and the existing ZFT Tools Organizer visual language. The GM apply/remove dialogs use a scoped dark-plum/emerald theme, clear token chips, grouped settings, readable labels and distinct safe/danger actions. No global theme overrides or additional gameplay features are introduced.

## What it does

- One GM-only toolbar action to open a persistent window containing **Apply, Update, and Remove** as appropriate to the selected NPCs.
- Three presets, Sturdy, Elite, Boss, plus editable custom values.
- Apply to multiple selected unlinked NPC tokens in the currently displayed scene.
- Apply attack/damage bonuses, AC bonuses, and saving-throw bonuses through one uniquely flagged D&D5e Active Effect per NPC token.
- The numeric bonus to **maximum HP** is now inside the token's Active Effect; only current HP is adjusted directly to preserve existing wounds. Token flags track the bonus and allow safe removal.
- No modifications to source/world Actors, PCs, linked tokens, other Active Effects, Items, or Activities.
- Works without third-party dependencies. When ZFT Tools is active, actions register into its shared toolbar. Otherwise provides a standalone canvas group.

## Presets

| Preset | HP total | AC | Attack rolls | Damage rolls (flat) | Saving throws |
| --- | ---: | ---: | ---: | ---: | ---: |
| Sturdy | 150% | +0 | +0 | +0 | +0 |
| Elite | 150% | +1 | +1 | +2 | +1 |
| Boss | 200% | +2 | +2 | +4 | +2 |

These are **initial experiment values**, not official CR recalculations. Bonuses to damage are *flat* additions to relevant D&D5e attack damage rolls, not a percentage and not a guaranteed bonus for all unusual Item Activities or third-party automation.

## Installation (manual extraction)

1. Extract `zft-npc-enhancer-v13.0.0-dev.7.zip` into the Foundry V13 server's `Data/modules/` directory.
2. Confirm `Data/modules/zft-npc-enhancer/module.json` exists.
3. Restart the server if necessary, enable **ZFT NPC Enhancer** in the V13 D&D5e 5.2.x or 5.3.x world, and refresh the GM browser.

This ZIP is **not** a manifest-managed GitHub Release asset; it is a manual installation archive.

## Test in a cloned/test world before Friday's live session

1. Select a newly placed **unlinked** NPC token. Note world Actor HP, original token HP/AC and action bonuses.
2. Click the **NPC Enhancer** icon once (in ZFT Tools if installed, otherwise the standalone NPC Enhancer canvas group).
3. Verify the window shows **Not enhanced** and an **Apply** option. Apply Elite; the window should stay open. Expect a single flagged Active Effect whose Changes tab includes an individual numeric HP maximum bonus (+50 when original max is 100) plus the other keyed bonuses. Both displayed maximum and current HP should rise by 50% of the old maximum, preserving the original numerical HP deficit.
4. Deal combat damage. Select the same token again if necessary. Verify the window shows **Enhanced: elite** with **Update** and **Remove**. Change the preset to Boss and click Update, then click Remove. Verify other effects, Item Activities and the combat damage are preserved. Reversal subtracts the original HP bonus and clamps HP to `[0, remaining max]`.
5. While the window remains open, select other unlinked NPC tokens, including a mix of enhanced and unenhanced ones. Verify the status and available actions update immediately; each action must affect only the matching tokens. Test batch application and removal independently.
6. Select a PC and a **linked NPC token**. They must be skipped; inspect the JS console for the reason.
7. Test with and without ZFT Tools active. Confirm there is just **one** NPC Enhancer toolbar icon, multiple clicks focus the same window, and Close/X detaches selection tracking. Open a player client and confirm it cannot use the actions.
8. Test in an actual combat workflow with Midi-QOL/CPR if those modules are installed. They are optional and their roll interoperability has **not** been live verified.

## Known limitations / safety

- Enhancements persist until manually removed. They do **not** automatically expire on combat end.
- Linked tokens are intentionally skipped so the module cannot unintentionally edit the Actor Directory's shared NPC.
- Re-applying to an already enhanced token is blocked. Use **Update** on schema 2 managed effects, or Remove then Apply for legacy enhancements.
- New maximum HP increases are **Active Effect changes**, not direct writes to the source max field. Current HP grants are token-local Actor changes. Remove via the provided toolbar action **before** manually deleting the Active Effect. If the effect is deleted directly, D&D5e may clamp current HP when max decreases, irreversibly losing some temporary HP, so the Remove action conservatively avoids subtracting a second time and warns. Legacy dev.2 enhancements still use their original direct-HP removal path.
- If a failure interrupts removal after current HP is adjusted but before state flags can be cleared, the module records a removal plan; a retry checks that plan instead of subtracting twice. If HP has changed in between, review the token before retrying. Keep a world backup for first test.
- Certain bespoke Activity types may not consume D&D5e's global attack/damage bonus fields; verify with the Friday group's automation stack.
- No action economy, legendary reactions, spell DC, condition resistances, or automatic encounter balance are included in this base build.

## Development baseline / source status

Repository: `LuvacZantor/zft-npc-enhancer`, `main` at `c691cdb1619ed7eedd05a98462102cb85c171a3d` (only original README and license). `develop` did not exist at inspection. The module was built locally without any GitHub push or branch creation. The central ZFT standard is normally V14-first for new work, but this V13-targeted baseline follows the owner's explicit campaign requirement.

No V13 or V14 live verification has been performed. Use `[ZFT]`-prefixed console diagnostics for errors.

## Stealth Mode (dev.7)

Stealth Mode is enabled by default in the compact GM window. It is stored as a **client-only preference** (`zft-npc-enhancer.stealthMode`) and can be disabled per action. On Apply/Update/Remove, the selected option is passed to the service. With stealth enabled:

- The module marks its Active Effects with `flags.zft-npc-enhancer.stealth=true`. On *each connected client*, a narrow V13 status-text wrapper suppresses only these managed effects' on-token scrolling status text. Other effects continue to animate normally.
- The module's current-HP bookkeeping uses D&D5e's `isAdvancement` update option, which excludes its own HP changes from D&D5e's damage/healing scrolling text and concentration checks. This also means those bookkeeping updates do not emit D&D5e's heal/damageActor hook. D&D5e concentration checks are suppressed for the module's HP bookkeeping in both modes; they are not attacks. Real combat changes are unaffected.
- Legacy managed effects receive the necessary flag before removing them.
- The GM receives normal messages in the window. **Stealth does not conceal information already visible through token HP bars, Actor ownership, Active Effect sheets, third-party HUDs, or change auditing.** It only suppresses the specified floating animations. Other modules may add additional proprietary popups that require their own integrations.

Acceptance: Test with two active clients (GM and player) in Foundry V13 Build 351 / D&D5e 5.2.x; verify Apply, Update, Remove with Stealth on (no effect title or HP numbers over the NPC on either client) and off (normal messages). Verify a separate attack/heal and an unrelated Active Effect still display their usual popups. Disable NPC Enhancer and confirm no persistent global setting was changed.


## GitHub development checkpoint

The complete `13.0.0-dev.7` source is preserved on `main` by explicit owner instruction as a development checkpoint. Automated tests passed; live V13 GM/player acceptance of Stealth Mode is still pending. This is **not** a stable tagged release.
