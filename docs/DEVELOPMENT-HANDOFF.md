# ZFT NPC Enhancer — Development Handoff

- Built: October 29, 2026
- Version: `13.0.0-dev.7`
- Scope: base module, compact ZFT Tools-branded persistent selection-aware GUI, and token-local HP/AC/attack/damage/saving-throw values in native Active Effects
- Live target: Foundry V13 Build 351 + D&D5e 5.2.x or 5.3.x (actual deployed system version not independently queried)
- Current repository: `LuvacZantor/zft-npc-enhancer`, initial `main` commit `c691cdb1619ed7eedd05a98462102cb85c171a3d`
- At inspection, `develop` did not exist; remote contains only initial license and README
- GitHub actions: **none** (no branches, commits, pushes, tags, releases)
- Archive: `zft-npc-enhancer-v13.0.0-dev.7.zip`, manual extraction layout
- Validation: Node syntax checks, pure-rule and simulated GM/Actor tests (39 tests), JSON checks, ZIP integrity
- Live verification: **NOT TESTED**; requires V13 + D&D5e 5.2.x or 5.3.x world
- Optional dependency: ZFT Tools registration API verified by inspection of `zft-tools/develop/scripts/main.js` v0.1.0-dev.12
- New code targets D&D5e 5.2.x/5.3.x's `system.bonuses.*` Active Effect keys; not 6.x roll keys

## Design and preservation

- Only selected unlinked synthetic NPC Actors can receive changes
- World Actors, linked tokens, PCs, original Items/Activities, and preexisting effects are not edited
- Managed Active Effect covers numeric HP maximum (schema 2) and AC/attacks/damage/saving throws. Only current HP is adjusted on token Actor; schema 1 buffs installed by dev.1/dev.2 remain removable.
- Apply refuses duplicate enhancements; remove deletes only its flagged effect and reverses HP bonus while retaining normal wounds
- Automatic end-combat expiration is not part of first build
- Test real AC, attacks, damage and saving throws with user's automation modules before acceptance

## Next steps

1. Manual install of ZIP in a clone of the V13 test world.
2. Verify effects, HP, source Actor independence, multiple token behavior and rollback with damage.
3. Report any observed compatibility issues or modules that alter these roll paths.
4. After tests, owner may explicitly authorize a narrowly scoped push to `LuvacZantor/zft-npc-enhancer` `develop` (creating branch separately only if explicitly approved), retaining the initial source files and LICENSE.
5. Stable promotion, tags and GitHub Releases require separate authorization.

## Dev.2 UI change

- Changed `scripts/ui.mjs` and `styles/main.css` for ZFT Tools dark-plum/emerald theme; retained V13 Dialog handling and all service calculations.
- Updated module-facing versions, README and CHANGELOG; added presentation contract regression test.
- Central standard committed to `zft-standards/main` at `61bd543e09d09e1ab8ce3bac5c6a358133f883ab`, separately from this local build.
- No write to `zft-npc-enhancer` GitHub repository; `main` remains at initial `c691cdb1619ed7eedd05a98462102cb85c171a3d`.
- Test both Apply and Remove windows in actual V13 351, ensure non-GM cannot open them, verify keyboard navigation, and confirm no styling leaks into other modules.

## Dev.3 Active Effect value fix

- The prior Sturdy Active Effect had an empty Changes array, and no preset displayed its HP max increase in the Effect sheet.
- `scripts/presets.mjs` now includes `system.attributes.hp.max` as a numeric ADD change when calculated delta is positive.
- `scripts/service.mjs` grants current HP separately after validating the effect has raised effective max, stores schema 2 effect ownership in flags, and removes the current HP grant before deleting the effect.
- Original direct-write dev.2 enhancements remain recognized and reversible through their original schema 1 path. No startup migration is performed.
- Tests cover precise effect keys, Sturdy/Elite/Boss/Custom, wound preservation, duplicate prevention, manually missing effects, unrelated effects, and dev.2 cleanup. **20 Node unit/simulated tests pass.**
- No live V13 GM/player acceptance has been performed; verify effect Changes tab, combat roll hooks, HP removal/rollback and other modules.
- No GitHub write to `zft-npc-enhancer` is authorized or performed by this build.

## Dev.4 window and update workflow

- Use the verified full dev.3 archive as baseline. No source files or regression fixtures were discarded.
- `scripts/main.mjs`: reduce shared ZFT Tools / standalone canvas actions to **one** opener. Neutral fallback select tool is still registered for V13 but its visual button is hidden.
- `scripts/ui.mjs`: replace short-lived Apply/Remove dialogs with a singleton, resizable, nonmodal V13 Dialog whose action buttons live **inside** the window rather than the native auto-closing Dialog footer. Add live status updates on controlToken, scene changes and relevant document changes, with listeners cleaned on close. Reopen focuses the same instance.
- `scripts/service.mjs`: `inspectSelection` reports supported/unlinked NPC status, existing managed enhancement, stored preset and whether it is safe to Update. `runSelected("update")` modifies an existing schema 2 Active Effect in place (same ID), adjusts only current HP by the difference in old/new HP bonus, records updated flags, rolls back on partial failures and retains active-operations protections. Legacy schema 1 enhancements remain removable but must be removed first before applying fresh effects.
- UI action targets are snapshotted at click time, then filtered by eligibility: Apply to unenhanced; Update only to compatible enhanced; Remove enhanced. The currently selected token(s) may change without resetting an in-progress form. Unsupported linked tokens/PCs are shown but never mutated.
- `styles/main.css`: scope status badges and persistent footer buttons to NPC Enhancer, hide standalone fallback's neutral icon, preserve ZFT dark-plum/emerald styling.
- Updated README, changelog, automated UI and service tests. No new persistent settings, compatibility dependencies, other module edits, or GitHub writes.
- **Live acceptance pending:** V13 351 with actual D&D5e 5.2.x/5.3.x and ZFT Tools installed. Verify single icon, no modal canvas-blocking overlay, stay-open behavior, status after canvas selection, update while wounded, multi-selection and legacy removal, return of focus and cleanup after X/Close.

## Dev.5 compact, auto-fitting window (October 29, 2026)

- Baseline is the complete **dev.4** local ZIP, *not* the initial GitHub main branch. Current GitHub `main` remains initial commit `c691cdb1619ed7eedd05a98462102cb85c171a3d`, and no remote `develop` has been created.
- `scripts/ui.mjs`: remove duplicated hero/title and redundant prose, use one compact selection row, preset row and five-field grid. Keep existing native GM Dialog singleton, selection hook lifecycle, saved configurations, all action handlers, and token flags unchanged. Add an animation-frame viewport fit with the V13-supported `Application.setPosition({height: "auto"})`; when content cannot fit, constrain it to viewport height and allow accessible overflow. Preserve window placement when possible and resize on browser changes.
- `styles/main.css`: replace expansive CSS with application-scoped compact dark plum/emerald styles. Keep icon hiding and keyboard/reduced-motion rules. Five columns normally; responsive wrapping on narrow screens. No nested token-list scrollbars or sticky footer.
- Updated README/changelog and UI simulation tests. Service, preset mechanics, original actor safety, integrations and data migrations unchanged; no new settings.
- Test in live Foundry V13 Build 351: default view should fit without any scrollbars on a normal desktop; select one and several tokens, switch presets, apply/update/remove, change browser size and zoom, and check fallback scrolling only on genuinely constrained screen heights. Confirm window stays open and non-GM cannot act.
- New dev.5 artifact `zft-npc-enhancer-v13.0.0-dev.5.zip` was **manual install only**, locally validated, not live-verified or released. No GitHub changes made.

## Dev.6 narrower square layout (October 29, 2026)

- Full local **dev.5 ZIP** is the verified baseline; it exactly matched the preserved dev.5 work directory. Remote main still contains only initial README/LICENSE, and remote develop remains absent. No GitHub changes were requested or performed.
- Only presentation in `scripts/ui.mjs` and `styles/main.css`: default Dialog width 610 -> 460 CSS px, remove redundant instruction row, shorten existing footnote, compact 3+2 stat grid with CSS container-query fallback to 2 columns when manually resized. Keep native V13 Dialog, single toolbar action, stay-open selection-aware UI, GM permissions, and viewport-constrained fallback.
- `tests/ui.test.mjs` updated to check 460px, layout, all five inputs and all four contextual buttons. Version strings and docs updated to `13.0.0-dev.7`. Effect calculation service and persistence remain byte-equivalent except required version string.
- Validate in live Foundry V13 Build 351 / D&D5e 5.2.x: inspect screenshot at desktop scale, switch between one/several tokens (including long names), resize narrower, inspect controls and action feedback, and ensure only constrained viewports scroll.
- Not released and not pushed.

## Dev.7 stealth presentation (October 29, 2026)

- Baseline: complete locally verified dev.6 ZIP. GitHub `main` still contains only initial README/LICENSE at `c691cdb1619ed7eedd05a98462102cb85c171a3d`; remote `develop` not created. No GitHub writes performed.
- `scripts/stealth.mjs` registers a GM client preference defaulting true, adds a narrowly scoped wrapper for Foundry V13's documented `ActiveEffect._displayScrollingStatus`, and provides the D&D5e `isAdvancement` document-update option for noncombat HP bookkeeping when stealth is on. The wrapper is installed on every client (not just GM) and passes all other effects through.
- `scripts/main.mjs` registers the client setting and installs the presentation filter before the GM-only UI bootstrap. `scripts/ui.mjs` adds a compact Stealth Mode checkbox; selected value is honored for Apply, Update, Remove. `scripts/service.mjs` writes namespaced stealth flags and scopes HP update options to own writes, including error rollback and previously created effects.
- No change to stat formulas, token/world actor checks, preservation of wounds, original Item/Activity data, effect IDs, or the core interface layout.
- Multi-client test still required in live Foundry V13 Build 351 / D&D5e 5.2.x, especially third-party modules with custom effect notifications. Explicitly distinguish floating text suppression from concealment of token HP, effect icons, Actor sheet or external HUDs. No production deployment, branch creation or remote commit.

## Repository checkpoint — October 29, 2026

- **Repository:** `LuvacZantor/zft-npc-enhancer`
- **Branch:** `main` (owner explicitly requested this development checkpoint).
- **Contents:** complete `13.0.0-dev.7` local source including runtime scripts, styles, tests, and this handoff.
- **Validation:** 39 automated Node tests passed; JavaScript syntax, manifest and archive integrity checked.
- **Acceptance:** owner approved a stopping-point checkpoint to `main`. Stealth Mode has **not** been live-verified with a separate player client.
- **Release status:** development prerelease checkpoint only. No stable version, tag, GitHub Release, or deployment is implied.
- **Future work:** run live Foundry V13 351 / D&D5e 5.2.x GM-and-player tests before stable release promotion.
