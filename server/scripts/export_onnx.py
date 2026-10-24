"""Export existing ML checkpoints without changing their source repository.

Run using the ML project's Python environment, with --ml-root pointing to it.
Optional dependencies are installed separately in server/.onnx-export-deps.
"""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'server/.onnx-export-deps'))
parser = argparse.ArgumentParser()
parser.add_argument('--ml-root', type=Path, required=True)
args = parser.parse_args()
sys.path.insert(0, str(args.ml_root))

import numpy as np
import onnx
import onnxruntime as ort
import torch
from ml.model import load_checkpoint
from ml.sequence_model import load_sequence_checkpoint
from ml.preprocessing import FEATURE_COLUMNS, canonicalize_static_features

OUT = ROOT / 'server/private/models/asignx'
OUT.mkdir(parents=True, exist_ok=True)
torch.set_num_threads(1)
torch.manual_seed(42)
rng = np.random.default_rng(42)

def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def real_static_samples(labels, mode):
    samples, counts = [], dict.fromkeys(labels, 0)
    with (args.ml_root / 'ml/data/landmarks.csv').open(newline='', encoding='utf-8-sig') as file:
        for row in csv.DictReader(file):
            label = row['label']
            if label not in counts or counts[label] >= 4:
                continue
            values = np.array([float(row[key]) for key in FEATURE_COLUMNS], dtype=np.float32)
            samples.append(canonicalize_static_features(values, row['handedness'], mode))
            counts[label] += 1
            if all(count >= 4 for count in counts.values()):
                break
    if not all(counts.values()):
        raise RuntimeError('Missing real static verification samples')
    return np.stack(samples), counts

report = {'versions': {'torch': torch.__version__, 'onnx': onnx.__version__, 'onnxruntime': ort.__version__}, 'models': []}
for kind, name, loader in [('static', 'sign_classifier_canonical', load_checkpoint), ('sequence', 'sequence_classifier', load_sequence_checkpoint)]:
    source = args.ml_root / f'ml/models/{name}.pth'
    source_hash = sha256(source)
    model, labels, checkpoint = loader(source)
    model.eval()
    width = int(checkpoint['num_features'])
    shape = (1, width) if kind == 'static' else (1, int(checkpoint['sequence_length']), width)
    input_name = 'landmarks' if kind == 'static' else 'sequence'
    target = OUT / f'{name}.onnx'
    # Explicit legacy exporter keeps opset 17 and avoids automatic exporter changes.
    # Export errors propagate; no TorchScript fallback is accepted.
    torch.onnx.export(model, torch.zeros(shape), str(target), dynamo=False,
        opset_version=17, input_names=[input_name], output_names=['logits'],
        dynamic_axes={input_name: {0: 'batch_size'}, 'logits': {0: 'batch_size'}},
        external_data=False)
    graph = onnx.load(str(target))
    onnx.checker.check_model(graph, full_check=True)
    session = ort.InferenceSession(str(target), providers=['CPUExecutionProvider'])
    batches = [np.zeros(shape, dtype=np.float32)]
    for batch_size in [1, 2, 8]:
        batches.append(rng.normal(0, 0.3, (batch_size, *shape[1:])).astype(np.float32))
    real_counts = None
    if kind == 'static':
        real, real_counts = real_static_samples(labels, model.static_hand_preprocessing)
        batches.extend([real[i:i+1] for i in range(len(real))])
    else:
        # Saved NPZ sequences are already preprocessed. Only use compatible arrays.
        for path in sorted((args.ml_root / 'dist/data/sequences').glob('*/*.npz')):
            with np.load(path, allow_pickle=False) as saved:
                for key in ['features', 'sequence', 'landmarks']:
                    if key in saved and saved[key].shape == shape[1:] and np.isfinite(saved[key]).all():
                        batches.append(saved[key].astype(np.float32)[None])
                        break
    max_error, matches, total = 0., 0, 0
    for batch in batches:
        with torch.inference_mode():
            reference = model(torch.from_numpy(batch)).numpy()
        result = session.run(['logits'], {input_name: batch})[0]
        np.testing.assert_allclose(result, reference, rtol=1e-4, atol=1e-4)
        max_error = max(max_error, float(np.max(np.abs(reference-result))))
        matches += int(np.sum(reference.argmax(axis=1) == result.argmax(axis=1)))
        total += len(batch)
    if matches != total:
        raise RuntimeError('ONNX and PyTorch predicted labels differ')
    if sha256(source) != source_hash:
        raise RuntimeError('Source checkpoint changed during export')
    metadata = {'model_type': 'static_sign_resmlp' if kind == 'static' else 'dynamic_sequence',
        'labels': labels, 'input_name': input_name, 'output_name': 'logits',
        'input_shape': ['batch_size', *shape[1:]], 'input_dim': width,
        'output_shape': ['batch_size', len(labels)], 'preprocessing': checkpoint['preprocessing'],
        'model_config': model.config, 'source_sha256': source_hash,
        'onnx_sha256': sha256(target), 'opset': 17,
        'use_kinematic_features': bool(model.config.get('use_kinematics')),
        'use_cosine_head': bool(model.config.get('cosine_head'))}
    if kind == 'static':
        metadata.update(static_hand_preprocessing=model.static_hand_preprocessing,
            class_centroids=checkpoint.get('class_centroids', {}),
            input_contract='Normalize wrist-relative/max-radius, then apply handedness canonicalization. Graph includes kinematic features; do not enrich input twice.')
    else:
        metadata.update(sequence_length=shape[1], sampling_fps=checkpoint.get('training', {}).get('sampling_fps', 15.0),
            backbone=model.config.get('backbone'),
            input_contract='30 preprocessed frames with 126 features: stable Left then Right hand slots, sequence_anchor_trajectory_v2. Graph includes kinematic features.')
    target.with_suffix('.meta.json').write_text(json.dumps(metadata, indent=2)+'\n', encoding='utf-8')
    item = {'file': str(target.relative_to(ROOT)).replace('\\','/'), 'bytes': target.stat().st_size,
        'source_sha256': source_hash, 'onnx_sha256': metadata['onnx_sha256'],
        'input_shape': metadata['input_shape'], 'labels': labels, 'validation': {
            'onnx_checker': 'passed', 'runtime': 'ONNX Runtime CPU', 'samples': total,
            'matching_predictions': matches, 'max_absolute_logit_error': max_error,
            'real_static_samples_per_label': real_counts,
            'real_sequence_samples': len(batches)-4 if kind == 'sequence' else None}}
    report['models'].append(item)
    print(json.dumps(item))
report['limitations'] = ['Numerical equivalence verifies conversion, not recognition accuracy.', 'Browser/WASM/WebGPU and live camera behavior have not been verified.']
(ROOT / 'docs/onnx-export-report.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
