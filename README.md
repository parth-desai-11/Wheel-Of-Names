# Wheel of Names

A browser-based name picker with custom probabilities and equal-sized visual slices. The compact dark toolbar, large colorful wheel, right-side pointer, and Entries/Results editor follow the layout at [wheelofnames.com](https://wheelofnames.com/), with an independent implementation.

## Use

- Edit names and weights in the entries panel. The **Chance** column shows the normalized probability: an entry's weight divided by the sum of all weights. Weights of 60 and 40 produce chances of 60% and 40%; weights of 3 and 1 produce 75% and 25%. Weights do not need to total 100.
- A weight of zero keeps an entry visible but excludes it from selection. Every entry always gets the same angular slice, regardless of weight. At least one entry needs a positive weight to spin.
- Click the wheel, use **Spin the wheel**, or press Ctrl+Enter, Command+Enter, or Space. After the draw, keep or remove the selected entry. Winner announcements and results history never display selection probabilities; those are shown only in the entries editor.
- Click **Hide panel** above the wheel to hide the entries, weights, and results while you present or spin. Click **Show panel** to edit again. Toggle **Advanced** to show or hide the weight and chance columns while keeping the names and image buttons visible. Both visibility preferences are saved in this browser and keep all weights in effect. Use **Shuffle** to randomize entry order or **Sort** to alphabetize it.
- Click the image icon beside any name to upload, replace, or remove its winner picture. The picture appears in the winner popup, including when the entries panel is hidden. Pictures stay attached when entries are renamed or shuffled and survive a refresh. Uploads up to 10 MB are resized to at most 800 pixels on the longest edge and saved as a static image in this browser's IndexedDB. They do not upload to a server or appear in CSV exports. Replacing the entire entries list removes its previous pictures.
- Import a CSV/TSV file or paste names. Headers are optional; accepted column headers include `name`, `entry`, `weight`, `probability`, and `chance`. Quoted values, escaped quotes, multiline fields, UTF-8 BOMs, tabs, semicolons, and percentage values are supported. Limits: 1 MB per uploaded file, 1,000 entries, and 120 characters per name.
- Export entries and weights as CSV. Recent results (up to 100), entries, and settings save automatically in this browser. They do not synchronize between devices.
- Settings include wheel name, sound, and spin duration. Reduced-motion preferences shorten the animation and disable confetti.

Example CSV:

```csv
name,weight
Alex,60
Jordan,30
Sam,10
```

## Run locally

Requires Python 3 for the preview and Node 18+ for tests. No installation or build step is needed.

```sh
npm start
# http://localhost:4173
npm test
```

The `dist/` directory can be served by any static web server. All application assets use relative paths, so GitHub Pages repository subpaths work.

## GitHub Pages

The included workflow tests the core behavior and deploys `dist/` after each push to `main`. Set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. After a successful deployment the expected address is:

https://parth-desai-11.github.io/Wheel-Of-Names/

## How selection works

The browser's `crypto.getRandomValues()` supplies a random value in [0, 1). Cumulative normalized weights determine the selected entry. The animation then makes several full turns and stops inside that entry's equal-sized slice. The visual wheel is an animation of the weighted result, not a physical uniform-angle draw. A second random value varies the stopping position safely inside the slice.

CSV files are parsed locally. Names are rendered with text nodes or canvas, never interpreted as HTML. Fonts and application assets are served locally without external font requests.

Tests cover probability boundaries, zero and very large weights, a 100,000-draw deterministic distribution, landing geometry for up to 1,000 slices, malformed CSVs, and import/export round trips.
