# eSpeak-NG (browser build)

Prebuilt Emscripten port of [eSpeak-NG](https://github.com/espeak-ng/espeak-ng), version 1.49.1,
from https://cdn.jsdelivr.net/espeakng.js/latest/ (source:
[espeak-ng/emscripten](https://github.com/espeak-ng/espeak-ng/tree/master/emscripten)).

License: GPL-3.0-or-later (see `LICENSE`). Copyright (C) 2014-2017 Eitan Isaacson and the
eSpeak-NG contributors.

Files are unmodified. `src/features/robot/EspeakVoice.ts` talks to `espeakng.worker.js` directly
instead of using the upstream `espeakng.min.js` wrapper.
