"""Private ONNX inference and per-session temporal state; no image persistence."""
from collections import deque
from pathlib import Path
import json
import math
import cv2
import mediapipe as mp
import numpy as np
import onnxruntime as ort

MODELS = Path(__file__).resolve().parents[1] / 'private/models'

def static_features(points, side, mode):
    points = np.asarray(points, dtype=np.float32)
    centered = points - points[0]
    scale = float(np.linalg.norm(centered, axis=1).max())
    if not np.isfinite(points).all() or scale <= 1e-8:
        raise ValueError('Invalid hand geometry')
    result = centered / scale
    if mode == 'left_x_reflection_v1' and side == 'Left':
        result[:, 0] *= -1
    return result.reshape(63).astype(np.float32)

def sequence_features(frames, length=30):
    if len(frames) < math.ceil(length / 2):
        return None
    raw = np.asarray(frames, dtype=np.float32).copy()
    valid = np.isfinite(raw).all(axis=(2, 3))
    if valid.any(axis=1).mean() < .5:
        return None
    for side in range(2):
        known = np.flatnonzero(valid[:, side])
        if not len(known):
            continue
        gap = 0
        for visible in valid[:, side]:
            gap = 0 if visible else gap + 1
            if gap > 3:
                return None
        values = raw[known, side].reshape(len(known), 63)
        raw[:, side] = np.stack([np.interp(np.arange(len(raw)), known, values[:, col]) for col in range(63)], axis=1).reshape(len(raw), 21, 3)
        valid[:, side] = True
    first_time, first_side = np.argwhere(valid)[0]
    origin = raw[first_time, first_side, 0].copy()
    radii = [float(np.linalg.norm(raw[t, h] - raw[t, h, 0], axis=1).max()) for t, h in np.argwhere(valid)]
    radii = [r for r in radii if r > 1e-8]
    if not radii:
        return None
    scale = float(np.median(radii))
    out = np.zeros_like(raw, dtype=np.float32)
    out[valid] = (raw[valid] - origin) / scale
    out = out.reshape(len(raw), 126)
    return np.vstack((np.zeros((length-len(raw), 126), np.float32), out))

class Stabilizer:
    def __init__(self, required=5, release=10, release_ms=250):
        self.required, self.release = required, release
        self.release_ms, self.missing_since = release_ms, None
        self.candidate, self.emitted, self.count, self.missing = None, None, 0, 0
    def update(self, label, timestamp=None):
        if label is None:
            self.candidate, self.count = None, 0
            self.missing += 1
            if self.missing_since is None:
                self.missing_since = timestamp
            if (timestamp is not None and timestamp-self.missing_since >= self.release_ms) or (timestamp is None and self.missing >= self.release):
                self.emitted = None
            return None, None
        # A sampled hand-away interval also counts when the hand returns between requests.
        if timestamp is not None and self.missing_since is not None and timestamp-self.missing_since >= self.release_ms:
            self.emitted = None
        self.missing_since = None
        self.missing = 0
        self.count = self.count + 1 if label == self.candidate else 1
        self.candidate = label
        stable = label if self.count >= self.required else None
        emitted = stable if stable != self.emitted else None
        if emitted:
            self.emitted = emitted
        return stable, emitted

class Models:
    def __init__(self):
        options = ort.SessionOptions()
        options.intra_op_num_threads = 1
        self.sessions, self.metadata = {}, {}
        for kind, name in [('static', 'sign_classifier_canonical'), ('sequence', 'sequence_classifier')]:
            path = MODELS / 'asignx' / name
            self.metadata[kind] = json.loads(path.with_suffix('.meta.json').read_text())
            self.sessions[kind] = ort.InferenceSession(str(path.with_suffix('.onnx')), sess_options=options, providers=['CPUExecutionProvider'])
        if self.metadata['static']['preprocessing'] != 'wrist_max_radius_v1' or self.metadata['sequence']['preprocessing'] != 'sequence_anchor_trajectory_v2':
            raise RuntimeError('Unsupported model preprocessing')
    def predict(self, kind, features):
        meta = self.metadata[kind]
        logits = self.sessions[kind].run([meta['output_name']], {meta['input_name']: features[None]})[0][0]
        scores = np.exp(logits - np.max(logits))
        scores /= scores.sum()
        index = int(scores.argmax())
        confidence = float(scores[index])
        return (meta['labels'][index] if confidence >= .8 else None), confidence

class Recognition:
    def __init__(self, models, detector=None):
        self.models = models
        self.detector = detector or mp.tasks.vision.HandLandmarker.create_from_options(mp.tasks.vision.HandLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(MODELS / 'mediapipe/hand_landmarker.task')),
            running_mode=mp.tasks.vision.RunningMode.VIDEO, num_hands=2,
            min_hand_detection_confidence=.5, min_hand_presence_confidence=.5, min_tracking_confidence=.5))
        self.reset()
    def reset(self):
        self.stable = {side: Stabilizer() for side in ['Left', 'Right']}
        self.dynamic = Stabilizer(3, 8)
        self.motion = {side: deque() for side in ['Left', 'Right']}
        self.frames = deque(maxlen=30)
        self.next_sample, self.last_timestamp, self.last_motion, self.dynamic_reading = None, None, -math.inf, None
    def close(self):
        self.detector.close()
    def moving(self, side, points, timestamp):
        history = self.motion[side]
        if history and timestamp-history[-1][0] > 500:
            history.clear()
        history.append((timestamp, points[[0, 4, 8, 12, 16, 20]].copy()))
        while len(history) > 2 and timestamp-history[0][0] > 7000/30:
            history.popleft()
        if len(history) < 2:
            return False
        distance = sum(float(np.linalg.norm(b[1]-a[1], axis=1).mean()) for a, b in zip(history, list(history)[1:]))
        return distance / (30 * (timestamp-history[0][0]) / 1000) >= .045
    def process(self, jpeg, timestamp):
        if not math.isfinite(timestamp) or timestamp < 0 or timestamp > 1e12 or (self.last_timestamp is not None and timestamp <= self.last_timestamp):
            raise ValueError('Frame timestamps must increase')
        image = cv2.imdecode(np.frombuffer(jpeg, np.uint8), cv2.IMREAD_COLOR)
        if image is None or image.shape[0] > 1280 or image.shape[1] > 1280:
            raise ValueError('Send a valid JPEG no larger than 1280 pixels per side')
        self.last_timestamp = timestamp
        result = self.detector.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(image, cv2.COLOR_BGR2RGB)), int(timestamp))
        hands = {}
        for points, categories in zip(result.hand_landmarks, result.handedness):
            side = categories[0].category_name
            if side in ('Left', 'Right'):
                hands[side] = np.array([[p.x, p.y, p.z] for p in points], np.float32)
        readings, emissions, moving = [], [], False
        for side in ['Left', 'Right']:
            if side not in hands:
                self.motion[side].clear(); self.stable[side].update(None, timestamp)
                continue
            is_moving = self.moving(side, hands[side], timestamp)
            moving |= is_moving
            label, confidence = self.models.predict('static', static_features(hands[side], side, self.models.metadata['static']['static_hand_preprocessing']))
            readings.append({'hand': side, 'label': None if is_moving else label, 'confidence': confidence})
        if moving:
            self.last_motion = timestamp
        dynamic_active = bool(hands) and timestamp-self.last_motion <= 350
        interval = 1000 / self.models.metadata['sequence'].get('sampling_fps', 15)
        if self.next_sample is None:
            self.next_sample = timestamp
        if timestamp + 1e-5 >= self.next_sample:
            if timestamp-self.next_sample > interval*3:
                self.frames.clear(); self.next_sample = timestamp
            missing = np.full((2, 21, 3), np.nan, np.float32)
            while timestamp-self.next_sample >= interval-1e-5:
                self.frames.append(missing.copy()); self.next_sample += interval
            frame = missing.copy()
            for index, side in enumerate(['Left', 'Right']):
                if side in hands:
                    frame[index] = hands[side]
            self.frames.append(frame); self.next_sample += interval
            features = sequence_features(list(self.frames)) if dynamic_active else None
            label, confidence = self.models.predict('sequence', features) if features is not None else (None, 0.)
            stable, emitted = self.dynamic.update(label, timestamp)
            self.dynamic_reading = {'hand': 'Motion', 'label': label, 'confidence': confidence, 'stable': stable} if dynamic_active else None
            if emitted:
                emissions.append({'label': emitted, 'hand': 'Motion', 'confidence': confidence})
        for reading in readings:
            stable, emitted = self.stable[reading['hand']].update(None if dynamic_active else reading['label'], timestamp)
            reading['stable'] = stable
            if emitted:
                emissions.append({'label': emitted, 'hand': reading['hand'], 'confidence': reading['confidence']})
        # Return only predictions and counts. No images, raw landmarks, weights or metadata.
        return {'hands': [{'handedness': side} for side in hands], 'readings': readings,
            'dynamic': self.dynamic_reading if dynamic_active else None, 'moving': dynamic_active, 'emissions': emissions}
