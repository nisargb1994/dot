# DOT

An infinite dotted canvas for projects. Projects on the left; on the right, an infinite grid where you arrange images, videos and text.

**Live:** https://nisargb1994.github.io/dot/

## Using it
- Right-click the grid to add an image, video, image link, video link, heading, subheading or paragraph.
- Drag on empty space to select; right-click a selection to duplicate it, copy it, or turn it into a new project.
- Hold Space and drag (or use the Hand tool) to pan; ⌘/Ctrl + scroll or pinch to zoom.
- Shift-drag snaps to the dots. Option/Alt-drag duplicates. Drag a corner to resize.
- ⌘C / ⌘V / ⌘X / ⌘D copy, paste, cut and duplicate. Press L to jump back to the last thing you edited.

Everything is saved in your own browser (IndexedDB); nothing is uploaded.

## Running locally
Static files only — open with any static server:

```bash
python3 -m http.server 8000
```

`build.py` bundles the app into a single `publish/dot.html` for hosting as a claude.ai artifact.
