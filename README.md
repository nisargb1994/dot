# DOT

An infinite dotted canvas for projects. Projects on the left; on the right, an infinite grid where you arrange images, videos and text.

**Live:** https://nisargb1994.github.io/dot/

## Using it
- Right-click the grid to add an image, video, a link (image or video, detected automatically), heading, subheading or paragraph.
- Drag on empty space to select; right-click a selection to duplicate it, copy it, or turn it into a new project.
- Hold Space and drag (or use the Hand tool) to pan; ⌘/Ctrl + scroll or pinch to zoom.
- Shift-drag snaps to the dots. Option/Alt-drag duplicates. Drag the bottom-right handle to resize and the top-right handle to rotate (Shift for 15° steps).
- Arrows: press **A** (or right-click → Add Line) and drag. Drop an end on an image, video or text to attach it — it follows the item when moved, resized or rotated. Drag the middle dot to curve; right-click for arrowheads, Straighten or Detach.
- Right-click text → **Text style**: black text, white text, or Instagram-style black or white background that hugs each line.
- Group projects into folders: **+ Add Folder**, then drag projects onto it (or right-click a project → Move to folder).
- The black bar on the left shows/hides your projects (⌘\), creates projects and folders, and lists keyboard shortcuts (?).
- Shapes (square, rectangle, triangle, circle) from the toolbar on the left; right-click a shape to change its colour.
- Select a text box and press Enter to edit it; right-click text to switch Heading / Subheading / Paragraph or change alignment.
- Select several items and drag the corner of the dashed box to scale them together.
- Instagram post and reel links show the post's preview.
- Right-click a project → **Share project** to get a link. Opening it on any computer adds a copy of the project there (a snapshot; share again to send updates). Shared projects are stored in Supabase Storage (bucket `dot-shares`) and anyone with the link can view them.
- ⌘Z / ⇧⌘Z undo and redo. ⌘C / ⌘V / ⌘X / ⌘D copy, paste, cut and duplicate. Press L to jump back to the last thing you edited.

Everything is saved in your own browser (IndexedDB); nothing is uploaded.

## Running locally
Static files only — open with any static server:

```bash
python3 -m http.server 8000
```

`build.py` bundles the app into a single `publish/dot.html` for hosting as a claude.ai artifact.
