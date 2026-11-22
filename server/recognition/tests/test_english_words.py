import sys
from pathlib import Path
import unittest
from importlib.metadata import version

ROOT = Path(__file__).resolve().parents[3]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'server/.recognition-deps'))
sys.path.insert(0, str(ROOT / 'server/recognition'))
import httpx
from english_words import EnglishWords
from service import create_app

class EnglishWordTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.words = EnglishWords()
    def test_actual_symspell_package(self):
        self.assertEqual(version('symspellpy'), '6.10.0')
        self.assertEqual(self.words.suggest('HELLO')['engine'], 'symspellpy')
    def test_substitution_missing_letters_and_transposition(self):
        for raw, expected in [('HXLLO', 'HELLO'), ('RECOGNITN', 'RECOGNITION'), ('HLELO', 'HELLO')]:
            self.assertEqual(self.words.suggest(raw)['suggestions'][0]['text'], expected)
    def test_ambiguous_missing_letter_is_a_candidate(self):
        self.assertIn('HELLO', [item['text'] for item in self.words.suggest('HELO')['suggestions']])
    def test_exact_words_and_double_letters(self):
        for text in ['HELLO', 'LETTER', 'BETTER', 'BOOK']:
            result = self.words.suggest(text)
            self.assertEqual(result['original'], text)
            self.assertEqual(result['suggestions'][0]['text'], text)
            self.assertEqual(result['suggestions'][0]['edits'], 0)
    def test_exact_segmentation_without_manual_spaces(self):
        self.assertEqual(self.words.suggest('HELLOWORLD')['suggestions'][0]['text'], 'HELLO WORLD')
    def test_unknown_and_validation(self):
        self.assertEqual(self.words.suggest('QZXQ')['suggestions'], [])
        for invalid in ['', '<script>', 'A'*201, None, 'HELLO WORLD']:
            with self.assertRaises(ValueError): self.words.suggest(invalid)
    def test_sentence_repairs_pause_fragments_from_raw_letters(self):
        for raw, provisional in [('HE L LO THERE', 'HE L LO THERE'), ('HE L LO THERE', 'HE I LO THERE'), ('H EL L O THERE', 'H EL I O THERE'), ('HEL LO THERE', 'HEL LO THERE')]:
            result = self.words.sentence(raw, provisional)
            self.assertEqual(result['original'], raw)
            self.assertEqual(result['suggestions'][0]['text'], 'HELLO THERE')
    def test_partial_hello_is_repaired_without_merging_common_short_words(self):
        self.assertEqual(self.words.sentence('HEL LO', 'HEL LO')['suggestions'][0]['text'], 'HELLO')
        self.assertEqual(self.words.sentence('THE ME', 'THE ME')['suggestions'][0]['text'], 'THE ME')
    def test_sentence_preserves_known_boundaries_and_unknown_fallback(self):
        self.assertEqual(self.words.sentence('THE RAPIST', 'THE RAPIST')['suggestions'][0]['text'], 'THE RAPIST')
        self.assertEqual(self.words.sentence('HXLLO WORLD', 'HELLO WORLD')['suggestions'][0]['text'], 'HELLO WORLD')
        self.assertEqual(self.words.sentence('QZXQ', 'QZXQ')['suggestions'][0]['text'], 'QZXQ')
        with self.assertRaises(ValueError): self.words.sentence('A'*2001, 'A')
    def test_sentence_does_not_undo_corrected_complete_words(self):
        for raw, provisional in [('HEXLO THERE', 'HELLO THERE'), ('HXLLO WORLD', 'HELLO WORLD'), ('RECOGNITN WORKS', 'RECOGNITION WORKS'), ('HELLOWORLD', 'HELLO WORLD')]:
            self.assertEqual(self.words.sentence(raw, provisional)['suggestions'][0]['text'], provisional)
    def test_sentence_repairs_fragments_without_changing_neighbor_corrections(self):
        self.assertEqual(self.words.sentence('HE L LO HEXLO', 'HE I LO HELLO')['suggestions'][0]['text'], 'HELLO HELLO')
        self.assertEqual(self.words.sentence('HE L LO THERE QZXQ', 'HE I LO THERE QZXQ')['suggestions'][0]['text'], 'HELLO THERE QZXQ')

class WordEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def test_authorization_correction_and_input_validation(self):
        app = create_app(factory=lambda: None, token='nlp-test-secret')
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            denied = await client.post('/nlp/word', json={'text': 'HXLLO'})
            self.assertEqual(denied.status_code, 401)
            headers = {'X-Recognition-Key': 'nlp-test-secret'}
            result = await client.post('/nlp/word', json={'text': 'HXLLO'}, headers=headers)
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json()['suggestions'][0]['text'], 'HELLO')
            self.assertEqual(result.headers['cache-control'], 'no-store')
            sentence = await client.post('/nlp/sentence', json={'text': 'HE L LO THERE', 'fallback': 'HE L LO THERE'}, headers=headers)
            self.assertEqual(sentence.status_code, 200)
            self.assertEqual(sentence.json()['suggestions'][0]['text'], 'HELLO THERE')
            corrected = await client.post('/nlp/sentence', json={'text': 'HEXLO THERE', 'fallback': 'HELLO THERE'}, headers=headers)
            self.assertEqual(corrected.json()['suggestions'][0]['text'], 'HELLO THERE')
            invalid = await client.post('/nlp/word', json={'text': '<script>'}, headers=headers)
            self.assertEqual(invalid.status_code, 422)
            oversized = await client.post('/nlp/word', content=b'x'*2049, headers=headers)
            self.assertEqual(oversized.status_code, 413)

if __name__ == '__main__': unittest.main(verbosity=2)
