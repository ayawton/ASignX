# ASignX ONNX export

The trained PyTorch models were exported without retraining or changing the ML
repository. Recognition now runs on the backend. Exported model files and metadata
are stored under `server/private/models/asignx`, excluded from Git and never
served by the website. Provision them privately for deployment.

From the website repository:

```powershell
& '..\ASignX ML\.venv\Scripts\python.exe' -B -m pip install --target server/.onnx-export-deps -r server/scripts/requirements-onnx-export.txt
& '..\ASignX ML\.venv\Scripts\python.exe' -B server/scripts/export_onnx.py --ml-root '..\ASignX ML'
```

Outputs:

- `sign_classifier_canonical.onnx` and `.meta.json`: 24 static alphabet letters,
  `landmarks` input `[batch, 63]`, `logits` output `[batch, 24]`.
- `sequence_classifier.onnx` and `.meta.json`: J/Z, `sequence` input
  `[batch, 30, 126]`, `logits` output `[batch, 2]`.

Graphs use opset 17 and include kinematic enrichment. Static preprocessing and
sequence trajectory normalization remain outside the graph, on the backend.
Export failures propagate instead of silently substituting TorchScript.

ONNX validation and CPU runtime comparisons passed all 136 initial checks.
`onnx-export-report.json` records versions, hashes and numerical differences.
These checks establish numerical conversion equivalence, not live accuracy.
See `ASignLive-Recognition.md` for the backend architecture and verification.
