"""Combine the retained reference utilities and editable visual styles.

The utility stylesheet was compiled with Tailwind CSS 3.4.19 from this site's
HTML and JS. Keeping the result locally preserves the original v3 appearance
without a browser CDN or a Node dependency during development/deployment.
"""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
parts=[root/'styles/reference-utilities.css',root/'styles/source.css']
(root/'dist/style.css').write_text('\n'.join(p.read_text().strip() for p in parts)+'\n')
print('Built self-contained reference styles')
