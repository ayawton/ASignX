import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'server/.recognition-deps'))
sys.path.insert(0, str(ROOT / 'server/recognition'))
import json
import math
import time
import unittest
import cv2
import numpy as np
from fastapi.testclient import TestClient
from engine import Models, Recognition, Stabilizer, static_features, sequence_features
from service import create_app, jpeg_size, MAX_FRAME, Registry, MAX_SESSIONS

FIXTURES = json.loads(Path(__file__).with_name('fixtures.json').read_text())
JPEG = cv2.imencode('.jpg', np.zeros((480, 640, 3), np.uint8))[1].tobytes()
KEY = 'test-internal-secret'
HEADERS = {'X-Recognition-Key': KEY}
FRAME_HEADERS = {**HEADERS, 'Content-Type': 'image/jpeg', 'X-Frame-Timestamp': '1000'}

class FakeEngine:
    def __init__(self): self.count, self.closed = 0, False
    def reset(self): self.count = 0
    def close(self): self.closed = True
    def process(self, body, timestamp):
        self.count += 1
        return {'count': self.count}

class RecognitionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.models = Models()
    def test_static_model_and_preprocessing_match_original_python(self):
        for fixture in FIXTURES['static']:
            data = static_features(fixture['landmarks'], fixture['handedness'], 'left_x_reflection_v1')
            np.testing.assert_allclose(data, fixture['features'], atol=1e-5, rtol=1e-5)
            logits = self.models.sessions['static'].run(['logits'], {'landmarks': data[None]})[0][0]
            np.testing.assert_allclose(logits, fixture['logits'], atol=1e-4, rtol=1e-4)
    def test_sequence_model_matches_original_python_including_gaps_and_padding(self):
        for fixture in FIXTURES['sequence']:
            frames = [[np.asarray(hand, np.float32) if hand is not None else np.full((21, 3), np.nan, np.float32) for hand in frame] for frame in fixture['frames']]
            data = sequence_features(frames)
            np.testing.assert_allclose(data.ravel(), fixture['features'], atol=1e-5, rtol=1e-5)
            logits = self.models.sessions['sequence'].run(['logits'], {'sequence': data[None]})[0][0]
            np.testing.assert_allclose(logits, fixture['logits'], atol=1e-4, rtol=1e-4)
        self.assertIsNone(sequence_features([np.full((2,21,3), np.nan)]*30))
    def test_repeated_sign_release_and_stale_candidate(self):
        stable = Stabilizer(3, 2)
        self.assertEqual(stable.update('A'), (None, None)); stable.update('A')
        self.assertEqual(stable.update('A'), ('A', 'A'))
        self.assertEqual(stable.update('A'), ('A', None))
        self.assertEqual(stable.update('B'), (None, None))
        stable.update(None); stable.update(None); stable.update('A'); stable.update('A')
        self.assertEqual(stable.update('A'), ('A','A'))
    def test_repeated_letters_release_by_elapsed_time_at_different_frame_rates(self):
        for step in [67, 500]:
            stable = Stabilizer(required=3)
            for timestamp in [0, step, step*2]:
                _, emitted = stable.update('T', timestamp)
            self.assertEqual(emitted, 'T')
            self.assertEqual(stable.update('T', step*3), ('T', None), 'Holding a sign must not repeat it')
            stable.update(None, step*4)
            stable.update('T', step*4+300)
            stable.update('T', step*5+300)
            self.assertEqual(stable.update('T', step*6+300), ('T', 'T'), 'A hand-away interval must permit double letters')
    def test_brief_detection_flicker_does_not_duplicate_a_letter(self):
        stable = Stabilizer(required=2)
        stable.update('T', 0); self.assertEqual(stable.update('T', 67), ('T', 'T'))
        stable.update(None, 100); stable.update('T', 167)
        self.assertEqual(stable.update('T', 234), ('T', None))
    def test_internal_authorization_and_no_model_downloads(self):
        with TestClient(create_app(FakeEngine, KEY)) as client:
            self.assertEqual(client.post('/sessions').status_code, 401)
            for path in ['/models/sign_classifier_canonical.onnx', '/private/models/asignx/sign_classifier_canonical.onnx', '/docs', '/openapi.json']:
                self.assertEqual(client.get(path, headers=HEADERS).status_code, 404)
    def test_isolated_sessions_reset_delete_and_expiry(self):
        app = create_app(FakeEngine, KEY)
        with TestClient(app) as client:
            first = client.post('/sessions', headers=HEADERS).json()['session_id']
            second = client.post('/sessions', headers=HEADERS).json()['session_id']
            self.assertNotEqual(first, second)
            for key in [first, second]:
                response = client.post(f'/sessions/{key}/frames', headers=FRAME_HEADERS, content=JPEG)
                self.assertEqual(response.json(), {'count': 1})
                self.assertEqual(response.headers['cache-control'], 'no-store')
            client.post(f'/sessions/{first}/reset', headers=HEADERS)
            self.assertEqual(app.state.registry.sessions[first].engine.count, 0)
            self.assertEqual(app.state.registry.sessions[second].engine.count, 1)
            engine = app.state.registry.sessions[first].engine
            self.assertEqual(client.delete(f'/sessions/{first}', headers=HEADERS).status_code, 204)
            self.assertTrue(engine.closed)
            app.state.registry.sessions[second].touched -= 61
            self.assertEqual(client.post(f'/sessions/{second}/frames', headers=FRAME_HEADERS, content=JPEG).status_code, 410)
            app.state.registry.prune()
            self.assertEqual(len(app.state.registry.sessions), 0)
    def test_input_limits_and_session_capacity(self):
        with TestClient(create_app(FakeEngine, KEY)) as client:
            key = client.post('/sessions', headers=HEADERS).json()['session_id']
            url = f'/sessions/{key}/frames'
            self.assertEqual(client.post(url, headers=HEADERS, content=JPEG).status_code, 415)
            self.assertEqual(client.post(url, headers=FRAME_HEADERS, content=b'not JPEG').status_code, 422)
            self.assertEqual(client.post(url, headers=FRAME_HEADERS, content=b'x'*(MAX_FRAME+1)).status_code, 413)
            self.assertEqual(client.post(url, headers={**FRAME_HEADERS,'X-Frame-Timestamp':'nan'}, content=JPEG).status_code, 422)
            for _ in range(MAX_SESSIONS-1): client.post('/sessions', headers=HEADERS)
            self.assertEqual(client.post('/sessions', headers=HEADERS).status_code, 503)
        self.assertEqual(jpeg_size(JPEG), (640,480))
        oversized = bytearray(JPEG)
        # Dimensions are rejected before decoding, not after allocating the image.
        marker = oversized.index(b'\xff\xc0')
        oversized[marker+7:marker+9] = (65000).to_bytes(2,'big')
        self.assertRaises(ValueError, jpeg_size, oversized)
    def test_actual_detector_and_models_process_blank_frame(self):
        engine = Recognition(self.models)
        try:
            result = engine.process(JPEG, 1000)
            self.assertEqual(result['hands'], [])
            self.assertEqual(result['emissions'], [])
            self.assertRaises(ValueError, engine.process, JPEG, 999)
            self.assertNotIn('landmarks', json.dumps(result))
        finally: engine.close()

if __name__ == '__main__': unittest.main(verbosity=2)
