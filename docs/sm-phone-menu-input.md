# SM phone menu input

## Incident and cause

SM and GM already render the same `CollapsibleMenu` with click-toggle enabled.
Separate touch and mouse handlers processed a phone tap twice: touchend opened
the menu, then browser compatibility mouse events selected a row or reopened
the newly mounted page's menu. A real emulated touchscreen reproduced a single
opening tap producing one navigation and a collapsed menu instead of opening.
This was an input-event problem, not missing SM routing or database data.

## Fix

- One pointer-event stream for touch, mouse and pen. No parallel touch/mouse
  navigation listeners. Prevent compatibility mouse handling at pointerdown.
- Capture the initiating primary pointer and ignore other pointers/buttons.
- Clear gesture ownership and the hold timer before releasing capture or
  navigating, so an old gesture cannot continue on the next page.
- A tap opens; a tap on an expanded row selects once. Stationary long press
  opens without selecting the row animated beneath the finger.
- Hold-and-slide still selects the row under release. Hit testing uses actual
  animated row bounds on both axes; release outside cannot select another row.
- Stationary taps remember the pressed row during opening animation. Cancelled
  or lost-capture gestures clear state without navigation. Short accidental
  swipes without a hold do not navigate.
- Settings/chat retain their own input handlers and do not start a menu gesture.
- Appearance, destinations, SM/GM permissions, and backend/database are unchanged.
  The repair is in the shared input handler, so both phone menus use it.

## Verification

Development-only `/dev/sm-menu` uses the real component and remounts it on each
simulated navigation. It does not authenticate, submit visits, or query/write
the database. It is unavailable in production.

Start localhost, then run:

```text
npx agent-browser --session sm-menu open http://localhost:3000/dev/sm-menu
npx agent-browser --session sm-menu get cdp-url
npm run test:sm-menu-browser -- <returned-local-CDP-websocket-URL>
```

The browser regression drives real Chrome touchscreen and mouse input, not just
React callbacks. It covers repeated navigation, stationary hold, hold-slide,
cancellation, outside release, short swipe, settings, mouse buttons, and rapid
selections during the opening animation. This is mobile Chromium emulation;
physical iPhone Safari has not been exercised in this task.
