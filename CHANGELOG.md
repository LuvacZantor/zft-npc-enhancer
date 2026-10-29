# Changelog

## 13.0.0-dev.7 — Stealth Mode for NPC Enhancer animations

- Add an opt-out **Stealth Mode** checkbox (enabled by default; client preference retained) to the existing compact GM window.
- Suppress scrolling Active Effect status text on all clients **only** for NPC Enhancer effects marked stealth, using a narrow Foundry V13 ActiveEffect method wrapper. Do not globally disable scrolling text or override other modules' effects.
- Use D&D5e's existing `isAdvancement` HP-update option only for the module's HP adjustments when stealth is enabled; suppress healing/damage floating numbers without changing combat HP calculations or invoking concentration checks for noncombat buff bookkeeping.
- Handle both newly created effects and pre-dev.7 effects being updated or removed. Restore normal effect notifications when Stealth Mode is disabled for an operation.
- Preserve the 460px window, preset values, all Apply/Update/Remove mechanics and earlier effect identities. Verify the GM and player clients in Foundry V13 before considering live acceptance.

## 13.0.0-dev.6 — Smaller box-style GM window

- Reduce default window width from 610 to 460 CSS pixels and remove the redundant introductory row.
- Arrange five stat fields in a balanced 3+2 grid, with container-query reflow for a manually narrowed window.
- Reduce panel whitespace while preserving readable input labels, status feedback, per-token chips and all contextual action buttons.
- Preserve the automatic content-height fit and viewport-only scrollbar fallback, ZFT palette, existing enhancement logic, metadata and action lifecycle.
- Add compact-layout regressions; live Foundry V13 appearance is pending.

## 13.0.0-dev.5 — Compact, auto-fitting GM window

- Remove duplicate large window heading, oversized stat cards and redundant notice panel.
- Condense token status to an inline strip, preset selection to one row, and HP/AC/attack/damage/saves to five compact adjacent controls.
- Auto-fit the V13 window height to changing token selection, messages, and browser dimensions; show a scrollbar only if content cannot physically fit the viewport.
- Keep one icon, the stay-open Apply/Update/Remove workflow, original Active Effect logic, accessible labels, ZFT Tools branding, and GM permissions unchanged.
- Add layout and simulated viewport tests; Foundry V13 live acceptance remains pending.

## 13.0.0-dev.4 — One icon, persistent selection-aware window

- Replace separate Apply/Remove toolbar icons with one **NPC Enhancer** opener in ZFT Tools and standalone fallback.
- Use one GM window that remains open across Apply, Update, and Remove and refreshes selected token statuses via bounded Foundry V13 hooks while open.
- Show whether each selected token is unenhanced, enhanced (preset), or unsupported; display only eligible operations. Mixed selections can be handled without adding duplicate enhancements.
- Add safe **Update** for schema 2 effects in place, preserving the original managed Active Effect ID and the current wounds. Legacy/partial enhancements continue to require Remove then Apply.
- Preserve editable preset values, the ZFT theme, existing effects/flags, original source Actors, and current service semantics. Add regression coverage.

## 13.0.0-dev.3 — Visible Active Effect HP values

- Write the calculated, token-specific maximum HP bonus into each managed Active Effect using D&D5e 5.2.x/5.3.x `ADD` mode and the native `system.attributes.hp.max` key.
- Keep the existing AC, attack, damage, and saving-throw formulas; preset values are now all represented in the effect Changes tab. Sturdy no longer creates an empty-change Active Effect.
- Adjust only current HP directly, preserving the existing number of wounds; remove that grant before deleting the managed effect.
- Recognize and safely remove schema 1 enhancements produced by dev.1/dev.2 without rewriting unrelated Actor content.
- Include explicit warnings if an effect was deleted outside this module and its HP restoration can no longer be guaranteed.
- Retain branded dialogs and optional ZFT Tools integration; expand regression coverage.

## 13.0.0-dev.2

- Restyled the GM Apply/Remove dialogs to match ZFT Tools branding (dark plum, emerald accents, clear hierarchy and grouped controls).
- Added responsive, scoped CSS, keyboard focus styling and descriptive preset help without changing enhancement calculations or Actor operations.
- Adopted the central `zft-standards/UI-STANDARDS.md` UI design baseline.
- V13 live-world verification remains pending.

## 13.0.0-dev.1

- First V13/D&D5e 5.2.x and 5.3.x development build.
- GM-only selected-token enhancements with Sturdy, Elite, Boss and Custom presets.
- Native Active Effects for AC, attack, damage, and saving-throw bonuses.
- Token-synthetic Actor HP increases with on-token recovery metadata and explicit removal workflow.
- Skip linked tokens and PCs to protect source Actors.
- Optional integration with ZFT Tools, standalone toolbar fallback, and testable pure rules.
- No GitHub publication or live-world verification.
