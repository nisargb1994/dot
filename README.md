# DOT

An infinite dotted canvas for projects: arrange images, videos, text, shapes and arrows on an endless grid. Sign in and your boards follow you to any computer.

**Live:** https://nisargb1994.github.io/dot/

## Using it
- Right-click the grid to add an image, video, a link (image or video, detected automatically), heading, subheading or paragraph.
- Drag on empty space to select; right-click a selection to duplicate it, copy it, or turn it into a new project.
- Hold Space and drag (or use the Hand tool) to pan; ⌘/Ctrl + scroll or pinch to zoom.
- Shift-drag snaps to the dots. Option/Alt-drag duplicates. Drag the bottom-right handle to resize and the top-right handle to rotate (Shift for 15° steps).
- Arrows: press **A** (or right-click → Add Line) and drag. Drop an end on an image, video or text to attach it — it follows the item when moved, resized or rotated. Drag the middle dot to curve; right-click for arrowheads, Straighten or Detach.
- Right-click text → **Text style**: black text, white text, or Instagram-style black or white background that hugs each line.
- Group projects into folders: **+ Add Folder**, then drag projects onto it (or right-click a project → Move to folder).
- The black dot in the top-left corner opens your projects (⌘\). Your account and Sign out are at the bottom of that panel.
- Shapes (square, rectangle, triangle, circle) from the toolbar on the left; right-click a shape to change its colour.
- Select a text box and press Enter to edit it; right-click text to switch Heading / Subheading / Paragraph or change alignment.
- Select several items and drag the corner of the dashed box to scale them together.
- Instagram post and reel links show the post's preview.
- Right-click a project → **Share project** to get a link. Opening it on any computer adds a copy of the project there (a snapshot; share again to send updates). Shared projects are stored in Supabase Storage (bucket `dot-shares`) and anyone with the link can view them.
- ⌘Z / ⇧⌘Z undo and redo. ⌘C / ⌘V / ⌘X / ⌘D copy, paste, cut and duplicate. Press L to jump back to the last thing you edited.

## Accounts and sync
- Sign in with Google, with any email + password, or with a username + password (no email needed).
- Boards are kept in the browser (IndexedDB, one database per account) and synced to Supabase: the `dot_docs` table (row-level security — each account sees only its own rows) and the private `dot-media` storage bucket (one folder per account). Changes made offline are queued and sent when you're back online.
- The boards that were in a browser before accounts existed move into the first account that signs in there.

## Running locally
Static files only — open with any static server:

```bash
python3 -m http.server 8000
```

`build.py` bundles the app into a single `publish/dot.html` for hosting as a claude.ai artifact.
