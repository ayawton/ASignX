# ASignLive backend recognition

ASignLive captures resized JPEG frames using the existing Start/Stop camera
controls. Detection, preprocessing, ONNX inference, confidence filtering, motion
routing and stabilization run on the backend. The client does not download models,
MediaPipe, or ONNX Runtime. Public and dashboard Live routes use the same pipeline.

## Local startup

Run these in separate terminals:

```powershell
cd server
npm run recognition
```

```powershell
cd server
npm run dev
```

```powershell
cd client
npm run dev
```

The Python service binds only to `127.0.0.1:8001`. Express exposes the bounded
recognition gateway under `/api/recognition`. The Vite development proxy forwards
`/api` requests to Express. Production should serve only `client/dist` and proxy
`/api` to Express; do not publish the server directory.

Both backend processes read `server/.env`. Configure:

- `RECOGNITION_URL`: internal Python service address.
- `RECOGNITION_INTERNAL_TOKEN`: one long random shared secret, never a VITE variable.
- `RECOGNITION_PYTHON`: optional path to the installed Python interpreter.
- `RECOGNITION_ALLOWED_ORIGINS`: optional comma-separated exact frontend origins
  when a proxy changes Host. No wildcard origins are accepted.

A local shared token and interpreter path were configured without printing or
committing credentials. Python dependencies are isolated in
`server/.recognition-deps`, ignored by Git. For another machine, install the
packages in `server/recognition/requirements.txt` using a Python environment, or
install into that target directory. Python 3.14 is used locally.

## Private assets

The trained graphs and metadata live in `server/private/models/asignx` and the
hand detector in `server/private/models/mediapipe/hand_landmarker.task`. These
assets are excluded from Git and must be provisioned privately on deployment.
The export script now writes directly into that private directory. The original
ML repository and trained PyTorch checkpoints are unchanged.

Neither service serves model files. Vite is restricted to the client directory
and explicitly denies private/backend dependency directories. Client production
builds are checked for ONNX, PyTorch, MediaPipe task, metadata and WASM files.
Generated browser inference runtimes and previous public model copies were removed.

## Transport and session behavior

- At most one JPEG frame is in flight. Frames have a maximum side of 640 pixels,
  JPEG quality 0.7, and a target maximum of 15 FPS. A slow connection/server reduces
  the frame rate rather than building a queue.
- Frames go to the application backend only after Start camera. The page explains
  this before starting. Frames are processed in memory, not written to disk,
  logged, sent to an external prediction service, or stored in the database.
- The private Python API requires the backend-only shared token. Browser sessions
  use separate random 256-bit capability IDs, retained in memory only.
- Each session has its own MediaPipe tracker, hand histories, dynamic sequence
  window and stabilizers. ONNX model sessions are shared for inference only.
- Idle sessions expire after 60 seconds and are reaped every 15 seconds. There
  are at most 16 sessions per Python process and two simultaneous frame jobs.
  The gateway limits session creation to six starts per minute per IP.
- Frames are limited to 256 KiB, image/jpeg, increasing timestamps, and dimensions
  of at most 1280 pixels per side. JPEG dimensions are validated before decoding.
- Clear resets the server session before the next frame and ignores stale results.
  Stop aborts the upload, deletes the recognition session, and releases the camera.
  Failure to deliver a stop request is handled by idle expiration.
- Backend errors are sanitized by the gateway. Busy responses retry briefly;
  disconnected or expired sessions offer Retry recognition. No recognition history
  is persisted; the browser keeps only 200 recent letters.

## Model behavior and limits

The static model supports A-I and K-Y; the sequence model supports J/Z. Static
inputs use wrist/max-radius normalization and handedness canonicalization.
Sequences use stable Left/Right slots, 15-FPS sampling, a 30-step window,
short-gap interpolation and sequence_anchor_trajectory_v2 normalization. Both
models use an 80% confidence threshold. Static labels stabilize over five updates;
J/Z over three sampled predictions. Hand release permits repeated letters.

These are alphabet models, not sentence translation. The two-class moving-sign
model can confuse unfamiliar movements with J/Z. A reliable network and enough
backend CPU/GPU capacity are required; weaker user devices avoid model inference
but still capture/compress video. Existing recognition accuracy has not been
established by these transport checks.

## Verification

- `client/npm test`: existing auth/routes plus frame resizing, cleanup/reset,
  backpressure, stale-result suppression, busy/error handling, and public-asset
  privacy checks.
- `server/npm test`: existing application/database/auth checks.
- `server/npm run test:recognition`: real ONNX output equivalence with Python
  fixtures, sequence preprocessing, repeat handling, isolated sessions,
  authorization, input limits, expiry, and actual MediaPipe blank-frame detection.
- A browser-generated blank video passed through client JPEG capture, Vite,
  Express, and Python. Two frames processed with no false hand/letter emission;
  session reset and deletion succeeded. This used synthetic video, not the user's
  physical camera. Real signing and network/device load tests remain unverified.
