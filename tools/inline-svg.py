#!/usr/bin/env python3
"""Re-inline assets/india.svg into index.html.

The hero outline is inlined rather than linked so it renders on first paint
and can be styled as ink. That means regenerating the SVG requires rewriting
the page, which is what this does — it replaces whatever <svg class="india">
element is currently in index.html.
"""
import re, sys, pathlib

page = pathlib.Path("index.html")
svg = pathlib.Path("assets/india.svg").read_text()
svg = svg.replace('<svg xmlns="http://www.w3.org/2000/svg" ', '<svg class="india" ')

html = page.read_text()
new, n = re.subn(r'<svg class="india".*?</svg>', lambda _: svg, html, count=1, flags=re.S)
if n != 1:
    sys.exit("could not find <svg class=\"india\"> in index.html — aborting rather "
             "than guessing where it goes")
page.write_text(new)
print(f"  inlined assets/india.svg into index.html ({len(svg):,} bytes)")
