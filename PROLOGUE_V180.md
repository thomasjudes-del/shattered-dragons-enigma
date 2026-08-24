# Shattered Dragons: Enigma - Prologue V180

## Goal
Turn the current image-navigation prototype into a short playable point-and-click prologue with persistent state, inventory use, backtracking, one observation puzzle and a final lore reveal.

## Playable loop
Observe -> collect -> understand -> use -> return -> unlock -> discover.

## Scene graph
- Camp: hub. Field table, optional team briefing, expedition gear, route into jungle.
- Team: optional narrative briefing only.
- Map: collect compass and flashlight; open map detail.
- Map detail: inspect the red X to record the 042 NE approach.
- Camp revisited: select compass and use it on the route to reach the entrance.
- Buried entrance: use pruning saw on roots; inspect mechanism; discover missing crank.
- Camp revisited: recover detachable crank from survey winch.
- Buried entrance revisited: use crank; passage unlocks.
- Underground lab: darkness blocks exploration until flashlight is used.
- Lab machinery: observe physical pressure stops LOW / HIGH / LOW.
- Emergency panel: set three selectors to LOW / HIGH / LOW to restore power.
- Powered lab: use compass on western wall to detect magnetic anomaly and finish the prologue.

## Core items
- Compass: route alignment, later anomaly detection.
- Flashlight: underground visibility.
- Pruning saw: physical obstacle removal.
- Winch crank: mechanical activation, consumed when installed.

## State flags
- briefingRead
- mapExamined
- routeAligned
- entranceCleared
- mechanismInspected
- entranceOpened
- flashlightActive
- machineInspected
- powerRestored
- anomalyDetected

## Difficulty principles
- No arbitrary numeric code.
- Every solution is signposted by an environmental clue or object affordance.
- Wrong or premature actions give contextual feedback, not a dead end.
- Backtracking is limited to meaningful revisits.
- Objects have credible functions and at least one item, the compass, has two distinct uses.

## Save and QA
- Save key: sde-save-v180.
- State, inventory, history and current scene persist in localStorage.
- RESET clears the V180 save and legacy inventory keys.
- Back follows visit history rather than scene index.
