"""English spelling correction using the installed SymSpell implementation."""
import re
from importlib.resources import files
from symspellpy import SymSpell, Verbosity


class EnglishWords:
    def __init__(self):
        self.spell = SymSpell(max_dictionary_edit_distance=2, prefix_length=7)
        dictionary = files('symspellpy').joinpath('frequency_dictionary_en_82_765.txt')
        if not self.spell.load_dictionary(str(dictionary), term_index=0, count_index=1):
            raise RuntimeError('English dictionary could not be loaded')

    def suggest(self, text):
        if not isinstance(text, str) or not re.fullmatch(r'[A-Za-z]{1,200}', text):
            raise ValueError('Send 1 to 200 English letters')
        word = text.lower()
        limit = min(2, len(word) // 3)
        suggestions = self.spell.lookup(word, Verbosity.CLOSEST, max_edit_distance=limit)
        result = [{'text': item.term.upper(), 'edits': item.distance, 'uncertain': False} for item in suggestions if re.fullmatch(r"[a-z]+(?:'[a-z]+)*", item.term)][:3]
        if not result and len(word) >= 6:
            # Restore omitted spaces only when every segment is an exact dictionary word.
            segmented = self.spell.word_segmentation(word, max_edit_distance=0).corrected_string
            parts = segmented.split()
            if len(parts) > 1 and ''.join(parts) == word and all(part in self.spell.words for part in parts):
                result = [{'text': ' '.join(parts).upper(), 'edits': 0, 'uncertain': False}]
        return {'original': text, 'suggestions': result, 'engine': 'symspellpy'}

    def sentence(self, text, fallback):
        if not isinstance(text, str) or not re.fullmatch(r'[A-Za-z]+(?: [A-Za-z]+)*', text) or len(text) > 2000:
            raise ValueError('Send up to 2000 sentence letters and spaces')
        if not isinstance(fallback, str) or len(fallback) > 4000 or not re.fullmatch(r"[A-Z]+(?:[' ][A-Z]+)*", fallback):
            raise ValueError('Send the provisional words')
        groups = text.lower().split()
        def known(word):
            return word in self.spell.words and (len(word) > 1 or word in ('a', 'i'))
        provisional = fallback.split()
        corrected = fallback
        # Preserve word-stage corrections as anchors. Resegment only adjacent short
        # fragments, never a whole corrected word (HEXLO -> HELLO) with its neighbor.
        # If the word stage already expanded a group, alignment is ambiguous: keep it.
        if len(groups) == len(provisional):
            # A rare three-letter prefix may itself be a dictionary entry (HEL).
            # Join a short continuation only when the exact combined word is more
            # frequent than either fragment; don't turn THE + ME into THEME.
            index = 0
            while index + 1 < len(groups):
                left, right = groups[index:index+2]
                joined = left + right
                count = self.spell.words.get(joined, 0)
                if len(left) == 3 and 1 <= len(right) <= 2 and count > max(self.spell.words.get(left, 0), self.spell.words.get(right, 0)):
                    groups[index:index+2] = [joined]
                    provisional[index:index+2] = [joined.upper()]
                else:
                    index += 1
            output, fragments = [], []
            def flush():
                if not fragments:
                    return
                raw = [groups[index] for index in fragments]
                repaired = ' '.join(provisional[index] for index in fragments)
                if len(raw) > 1 and not all(known(part) for part in raw):
                    joined = ''.join(raw)
                    segmented = self.spell.word_segmentation(joined, max_edit_distance=0).corrected_string
                    parts = segmented.split()
                    if ''.join(parts) == joined and all(known(part) for part in parts):
                        repaired = ' '.join(parts).upper()
                output.append(repaired)
                fragments.clear()
            for index, (raw, proposed) in enumerate(zip(groups, provisional)):
                if len(raw) >= 3 and len(proposed) >= 3:
                    flush()
                    output.append(proposed)
                else:
                    fragments.append(index)
            flush()
            corrected = ' '.join(output)
        return {'original': text, 'suggestions': [{'text': corrected, 'edits': 0, 'uncertain': False}], 'engine': 'symspellpy'}
