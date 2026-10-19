# Visual reference

Design copied at the user's request from https://github.com/cevekanovshoma-lab/40-hadiths-ajurri, commit `e76f0e20dbce09a7e6fdbb85cff5cc8fd221ea4c`.

The reference's HTML structure, original CSS variables/rules, SVG ornaments, header, card geometry, navigation, and icon are retained. The original Amiri and Inter font faces were downloaded from the same Google Fonts stylesheet as the reference and saved under `dist/assets/fonts/` with their OFL licenses. Arabic defaults: Amiri regular 400, centered, 26 px below 640 px, 30 px from 640 px, line-height 2.2. Font enlargement is an optional study setting.

Tailwind v3 utility rules were compiled once with 3.4.19 and retained in `styles/reference-utilities.css` (MIT notice in the generated stylesheet). `scripts/build_styles.py` concatenates these utilities with the original visual rules and the study controls in `styles/source.css`. The deployed site needs neither a CDN CSS compiler nor npm dependencies.

Added controls are limited to reading/self-testing modes, progressive Arabic reveal, optional translation, text size, copying, and local repetition progress. The reference repository contains shortened Arabic passages and explanatory text; those data are not imported. The complete reviewed Arabic text and original Russian translations in this repository are unchanged by the redesign.
