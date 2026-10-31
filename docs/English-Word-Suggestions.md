# Automatic English words and sentences

ASignLive uses a two-tier automatic pipeline. No word selection or Finish word action is required.

1. **Words:** after each confirmed letter, a browser worker asynchronously posts the current letter group to `/api/recognition/nlp/word`. Express validates it and forwards it to the private Python `/nlp/word` endpoint using the existing internal recognition credential. Python uses the installed `symspellpy==6.10.0` package and its bundled English frequency dictionary. The worker processes one request at a time and retains only the newest waiting spelling. After a two-second pause, the best matching result is recorded automatically. A late matching response can finish the word after the pause; stale responses cannot consume newer letters. Unknown words and failed requests preserve the detected spelling.
2. **Sentences:** raw detected letter groups and their provisional corrections are asynchronously posted to `/api/recognition/nlp/sentence`. Complete word-stage corrections are protected: HEXLO corrected to HELLO must not become HEX LOT when the sentence is assembled. Groups with at least three raw and corrected letters generally act as anchors. Before anchoring, a three-letter prefix plus a one- or two-letter continuation can join if their exact combined dictionary word is more frequent than either fragment: HEL + LO becomes HELLO, while THE + ME remains separate. Only adjacent short fragment groups between anchors are considered for resegmentation, and existing valid short-word boundaries are retained. HE + L + LO + THERE can therefore become HELLO THERE, even if the first tier provisionally changed L to I. A fragment repair is accepted only if it preserves every raw letter and all resulting words are in the dictionary. If a repair is not reliable, or a word-stage expansion makes raw/corrected group alignment ambiguous, provisional results are preserved. After the last word finishes, sentence completion requires four continuous seconds with hands observed out of frame and the matching NLP result available. Holding a sign keeps the sentence open; a busy or failed camera-recognition request is not treated as hand removal. Stopping the camera also permits pending text to finish. The sentence is then capitalized and given a final period. This is about six seconds after the last confirmed letter under normal response times. A slow NLP response delays completion. This does not infer grammar or missing meaning. Proper names and ambiguous boundaries remain limitations.

Camera sampling and recognition continue independently. Word and sentence correction run alongside camera recognition on the backend; each browser worker has one request in flight and only the newest input waiting. The existing bounded latest-frame transport remains in place. No external AI service or additional API key is used. Raw letter groups and provisional sentence text are sent to the application backend; final capitalization and punctuation run in the browser. Text is not saved to an account or database.

## Correction behavior

SymSpell lookup uses nearest edit distance, then dictionary frequency. Short inputs allow fewer changes; longer inputs allow up to two edits. Insertions, deletions, substitutions and adjacent transpositions are supported. For a group without a single-word match, exact dictionary segmentation can restore omitted spaces, such as HELLOWORLD to HELLO WORLD. This fallback only accepts segments whose concatenation preserves the original letters and which all occur in the dictionary. Unfinished prefix completions are not automatically accepted.

Ambiguous input can still produce the wrong word: HELO has several close matches. The UI preserves raw recent detections and an expandable comparison of every recorded word with its detected spelling. It does not ask the user to choose. Pauses longer than two seconds inside a word can split it; these timing values require live-signing evaluation. A short hand-away interval supports double letters without waiting for a word boundary. The service's release rule remains independent of the word and sentence timers.

Clear all text clears current letters, word history, sentence buffers and completed sentences, invalidates outstanding responses, and resets recognition. Stopping the camera stops frames but permits pending text to finish automatically. Worker/API failures retain detected letters. Limits are 200 recent detections, 200 letters per current group, 200 recent word groups and 50 completed sentences. At the letter-group limit the UI asks for a pause; further detections remain in recent history until the group finishes.

## Dependencies and attribution

`symspellpy==6.10.0` is pinned in `server/recognition/requirements.txt` and installed in `server/.recognition-deps`. Install the requirements with the configured recognition Python when setting up another machine, then restart the recognition service after changes. The browser no longer contains the previous custom correction engine or its 20,000-word dictionary subset.

SymSpell Python port: https://github.com/mammothb/symspellpy
Original SymSpell: https://github.com/wolfgarbe/SymSpell
Python package documentation: https://symspellpy.readthedocs.io/

The bundled dictionary derives from Google Books Ngram frequencies (CC BY 3.0) and SCOWL word lists. Notices are in `/nlp-notices.txt`, `/nlp-symspellpy-license.txt` and `/nlp-scowl-notices.txt`. Package license files are also retained in the private installed dependency.

## Verification

- Client: `npm test`, `npm run lint`, `npm run build`, then `node scripts/word-worker.test.mjs`.
- Backend: `npm run build`, `npm run test:nlp` (actual SymSpell and Python endpoint), `node --test tests/nlp-gateway.test.mjs` (Express transport).
- Python HTTP and localhost tests may require execution outside the filesystem/network sandbox on this host.

Tests cover actual package version, missing/mistaken letters, transpositions, double letters, exact segmentation, unknown input, authentication, validation, request forwarding, private-token exclusion, automatic pause timing, stale responses, failure fallback and sentence assembly. A deterministic timing regression holds a hand in frame for ten seconds between HEL and LO, then verifies that hands-away completion yields Hello. rather than Hel. Lo. Physical-camera accuracy and correction quality on real signing remain a separate live check.
