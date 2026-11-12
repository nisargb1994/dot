"""Bundle index.html + styles.css + app.js into one self-contained page for publishing.

Usage:  python3 build.py   ->  writes publish/dot.html
"""
from pathlib import Path

root = Path(__file__).resolve().parent
html = (root / "index.html").read_text()
css = (root / "styles.css").read_text()
js = (root / "app.js").read_text()

# Keep only the body markup; the host wraps the page in its own <html>/<head>/<body>.
body = html[html.index("<body>") + len("<body>"): html.index('<script src="app.js">')].strip()

page = f"""<meta charset="utf-8">
<title>DOT</title>
<style>
html, body {{ height: 100%; }}
{css}
</style>

{body}

<script>
{js}
</script>
"""

out = root / "publish" / "dot.html"
out.parent.mkdir(exist_ok=True)
out.write_text(page)
print(f"wrote {out.relative_to(root)} ({len(page) / 1024:.0f} KB)")
