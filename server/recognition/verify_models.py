"""Verify private assets against a versioned manifest without exposing contents."""
import hashlib
import json
from pathlib import Path


def verify(root=None):
    server = Path(__file__).resolve().parents[1]
    root = Path(root) if root is not None else server / 'private/models'
    manifest = json.loads(Path(__file__).with_name('model-manifest.json').read_text())
    for name, expected in manifest.items():
        target = root / name
        if not target.is_file() or hashlib.sha256(target.read_bytes()).hexdigest() != expected:
            raise RuntimeError(f'Missing or mismatched private model asset: {name}')
    print(f'Verified {len(manifest)} private model assets.')


if __name__ == '__main__':
    verify()
