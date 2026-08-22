# V0 Stabilization

No new gameplay is merged to main until the reliability gate passes.

Rules:
- map table background contains no pickup objects;
- compass and flashlight are separate transparent assets;
- collected objects disappear by removing their overlay and hotspot, never by masking the background;
- map detail is a dedicated scene asset;
- production assets are served from this GitHub repository;
- browser QA must pass on desktop Chromium and iPhone WebKit before merge;
- public GitHub Pages is verified after merge before a version is announced as working.
