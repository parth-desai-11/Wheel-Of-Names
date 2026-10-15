# Wheel of Names

A browser-based name picker with custom probabilities and equal-sized visual slices. The compact dark toolbar, large colorful wheel, right-side pointer, and Entries/Results editor follow the layout at [wheelofnames.com](https://wheelofnames.com/), with an independent implementation.

## Use

- The default CSV contains the original 90 names, including Sandip pednekar, plus Mohit Agarwal (91 total). Mohit Bhagat remains in the list. The downloadable roster is `dist/default-entries.csv`; its application copy lives in `dist/defaults.js` and is checked against the CSV by tests.
- Mohit Agarwal is selected on spin **10** and Yash Mota on spin **18**. Both names are reserved from earlier random picks. Their scheduled picks override their weights. Other spins use the weights of eligible entries; after each scheduled slot, that name becomes eligible for normal weighted picks again if it remains on the wheel.
- Edit names and weights in the entries panel. The **Chance** column shows the probability for the next spin, accounting for reserved and scheduled names. On regular spins, weights of 60 and 40 produce chances of 60% and 40% among those two eligible entries. Weights do not need to total 100.
- A weight of zero keeps an entry visible but excludes it from regular weighted selection. Every entry always gets the same angular slice, regardless of weight or schedule. At least one eligible entry needs a positive weight on regular spins. If a name needed for a future scheduled slot is missing, restore the default list in Customize before spinning.
- Click the wheel, use **Spin the wheel**, or press Ctrl+Enter, Command+Enter, or Space. After the draw, keep or remove the selected entry. Winner announcements and results history never display selection probabilities; those are shown only in the entries editor.
- Click **Hide panel** above the wheel to hide the entries, weights, and results while you present or spin. Click **Show panel** to edit again. Toggle **Advanced** to show or hide the weight and chance columns while keeping the names and image buttons visible. Both visibility preferences are saved in this browser and keep all weights in effect. Use **Shuffle** to randomize entry order or **Sort** to alphabetize it.
- Click the image icon beside any name to upload, replace, or remove its winner picture. The picture appears in the winner popup, including when the entries panel is hidden. Pictures stay attached when entries are renamed or shuffled and survive a refresh. Uploads up to 10 MB are resized to at most 800 pixels on the longest edge and saved as a static image in this browser's IndexedDB. They do not upload to a server or appear in CSV exports. Replacing the entire entries list removes its previous pictures.
- Import a CSV/TSV file or paste names. Headers are optional; accepted column headers include `name`, `entry`, `weight`, `probability`, and `chance`. Quoted values, escaped quotes, multiline fields, UTF-8 BOMs, tabs, semicolons, and percentage values are supported. Limits: 1 MB per uploaded file, 1,000 entries, and 120 characters per name.
- Export entries and weights as CSV. Recent results (up to 100), entries, and settings save automatically in this browser. They do not synchronize between devices.
- Customize includes wheel name, sound, spin duration, completed/next spin counters, and the scheduled picks. **Reset spin counter** starts again at spin 1 without changing entries or results. **Restore list & reset** reloads the 91 default names with weights of 1, retains matching names' images, and resets the counter. Clearing Results does not reset the counter. Counters are per browser/device and persist across refreshes; clearing browser storage starts a new sequence.
- Existing browsers receive this roster once on the default version upgrade, preserving images for matching names and other settings. Subsequent edits and removals persist normally. Reduced-motion preferences shorten the animation and disable confetti.

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

Scheduled spins select the configured name by name, regardless of entry order or weight. On other spins, the browser's `crypto.getRandomValues()` supplies a random value in [0, 1). Cumulative normalized weights of the eligible entries determine the selected entry. The animation then makes several full turns and stops inside that entry's equal-sized slice. The visual wheel animates the selected result. A second random value varies the stopping position safely inside the slice. Only completed spins advance the saved counter.

CSV files are parsed locally. Names are rendered with text nodes or canvas, never interpreted as HTML. Fonts and application assets are served locally without external font requests.

Tests cover probability boundaries, zero and very large weights, a 100,000-draw deterministic distribution, landing geometry for up to 1,000 slices, malformed CSVs, import/export round trips, the default roster, reserved names, scheduled slots, sorting/removing winners through 18 spins, and image preservation on roster restore.
