# Arabic text provenance

The supplied 39-page matn PDF is the reading reference. A cached, vocalized digital edition of the same work (Shamela book 8204) was used as a transcription aid, followed by explicit PDF-page comparison and corrections. The electronic edition is not a literal match: it expands transmission formulas, uses other wordings, and omits the mosque greeting episode in report 44.

`arabic-transcription.json` is the reviewed, editable source of truth for the 40 cards. The ordered `reports` numbers link cards to the digital reference; card 14 contains report 15, not report 14 (the latter belongs to the previous subject). Cards 29 and 35 include multiple reports. Card 18 and card 22 retain the short explanatory glosses present in the supplied matn. No automatic OCR/fuzzy alignment is used to produce the deployed text.

`arabic-editorial-changes.json` records explicit differences applied to the digital transcription during comparison against PDF pages 7–37. The transmission chains retain the PDF's abbreviations. Honorific ligatures are transcribed in text; printed page markers and footnote numbers are omitted, punctuation and Quran verse references are normalized. The original PDF remains linked from every card for independent checking.

The old source images remain in the repository for comparison/history; the practice UI renders native Unicode text only. The Russian translations are unchanged.

The abandoned OCR boundary selection script is retained under `scripts/archive/`; it can truncate phrases and must not regenerate production text.
