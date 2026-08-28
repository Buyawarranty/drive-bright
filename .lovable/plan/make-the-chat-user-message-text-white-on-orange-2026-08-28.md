# Make the chat user-message text white on orange

## Problem

The screenshot shows a sent user message — "Check what's covered" — rendered as an orange bubble with dark text. The user wants white text on the orange bubble for better contrast.

## Target

`src/components/ai-sandbox/SandboxChatWindow.tsx`, around the `MessageContent` className for `message.role === 'user'`.

## Change

Update the user message bubble style from the current low-contrast `bg-primary/10 text-foreground` to a solid filled bubble using the theme's primary/foreground pair:

- `bg-primary text-primary-foreground`
- Keep the rounded shape and border as needed for consistency.

This only affects the chat window's user message bubbles; assistant messages and the rest of the site are untouched.

## Verification

- Typecheck/build.
- Browser check on `/used-car-warranty-uk/`: send "Check what's covered" and confirm the user bubble has white text on an orange background.
