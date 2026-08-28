# Let the user close the "Build your price" panel so chat continues at the bottom

## Problem

The "Build your price" panel stays open under the conversation once a vehicle is looked up. When the customer types a follow-up question, the assistant's reply appears **above** the panel instead of at the bottom, making it feel like the chat is interrupted. There is no way to dismiss the panel.

## Target

`src/components/ai-sandbox/SandboxChatWindow.tsx` — the `PriceOptionsPanel` mount and the panel itself.

## Changes

### 1. Add a dismiss/close control to the price panel
- Add an `onClose` prop to `PriceOptionsPanel`.
- Render a small **X / Close** button in the panel header so the customer can hide it.
- When closed, set local state `pricePanelOpen` to `false` and the panel unmounts immediately.

### 2. Re-open the panel only when pricing is actually requested
- Keep `hasPriceQuote` as the trigger (price was quoted or vehicle was looked up), but also require `pricePanelOpen === true`.
- Reset `pricePanelOpen` to `true` when a new `get_indicative_price` tool runs — i.e. the customer explicitly asks for a price again.
- Do **not** re-open automatically on every new assistant message; the user must be in control.

### 3. Keep the panel anchored at the bottom of the chat
- The panel already renders after the message list; ensure it stays there and does not scroll new replies out of view.
- When the panel is open, the latest assistant message should still be visible just above it (auto-scroll already handles this).

### 4. Persist the dismissed state per session only
- Closing is a UI preference for the current chat session. If the customer ends the chat (X) and starts again, the panel behaves normally.

## Verification

- Typecheck/build.
- Browser test on `/used-car-warranty-uk/`:
  - Ask for a price → panel opens.
  - Close the panel with X → panel disappears; type a follow-up → assistant reply appears at the bottom of the chat.
  - Ask for a price again → panel reopens.
- Confirm chat remains only on `/used-car-warranty-uk/`.
