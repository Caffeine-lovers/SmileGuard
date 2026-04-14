# SmileGuard — Inference Infrastructure Handoff

**Modal.com Deployment — Setup, Operations & Maintenance Guide**

| | |
|---|---|
| **Model** | YOLOv8m — `smileguard_best.pt` |
| **Platform** | Modal.com (serverless GPU) |
| **Classes** | cavity, caries, decay, calculus, gingivitis, tooth_discoloration |
| **Free tier** | $30/mo GPU credits — no idle cost |

---

## 1. Why Modal — the decision context

Three platforms were evaluated. This section documents why Modal was selected so future engineers understand the tradeoffs, not just the outcome.

| Platform | Free tier | Verdict for SmileGuard |
|---|---|---|
| HF Serverless API | Free but restricted | Rejected — custom `.pt` not supported |
| HF Inference Endpoints | None — pay from dollar one | Rejected — ~$360/mo minimum |
| Modal.com | $30/mo GPU credits, pay-per-second | **Selected** — best fit for current stage |

> **Key distinction:** Hugging Face has two separate inference products. The free Serverless API only supports publicly hosted models with natively supported architectures. SmileGuard's custom `smileguard_best.pt` is neither. The paid Inference Endpoints product does support custom models but has no free tier.

---

## 2. System architecture

SmileGuard inference runs on two parallel paths depending on the client surface:

| Component | Description |
|---|---|
| **Web portal (patient-facing)** | React / Next.js — calls Modal endpoint via `POST /predict` over HTTPS |
| **Doctor mobile app** | ONNX model runs offline on-device. Syncs results to Supabase when online. Does not call Modal. |
| **Modal — `modal_inference.py`** | FastAPI endpoint running `smileguard_best.pt` on GPU T4. Scales to zero, cold starts in ~15–30s. |
| **Modal Volume** | Persistent storage for model weights. Survives redeployments. Uploaded once via `upload_weights.py`. |
| **Supabase** | Stores all detection results, patient records, images. Both web and mobile write here. |

```
Web portal (Next.js)          Doctor mobile app
        |                            |
        | HTTPS POST /predict        | ONNX (offline)
        |                            |
        ▼                            ▼ (online sync only)
  ┌─────────────────────────────┐   Supabase
  │  Modal — serverless GPU     │      ▲
  │  ┌─────────────┐  ┌───────┐ │      |
  │  │ FastAPI     │→ │ YOLO  │ │──────┘
  │  │ endpoint    │  │ v8m   │ │
  │  └─────────────┘  └───────┘ │
  └─────────────────────────────┘
```

---

## 3. File inventory

| File | Purpose |
|---|---|
| `modal_inference.py` | Main Modal app. Defines the GPU container, loads the model once on startup, exposes `/predict` (POST) and `/health` (GET). |
| `upload_weights.py` | One-time script. Pushes `smileguard_best.pt` to a Modal Volume. Run again only when updating model weights. |
| `smileguard_client.py` | Python helper for the Flask sidecar or backend. Handles base64 encoding and the HTTP call to Modal. |

---

## 4. First-time deployment

### Prerequisites

- Python 3.11+ installed
- Modal account created at [modal.com](https://modal.com) (free, no credit card for free tier)
- `smileguard_best.pt` weights file available locally

### Step 1 — install and authenticate Modal

```bash
pip install modal
modal token new
```

This opens a browser window. Log in to your Modal account. Token is saved locally.

### Step 2 — upload model weights (once only)

```bash
python upload_weights.py --path /path/to/smileguard_best.pt
```

This creates a Modal Volume called `smileguard-weights` and pushes the `.pt` file. Only repeat this step when you update the model after retraining.

### Step 3 — deploy the inference server

```bash
modal deploy modal_inference.py
```

Modal builds the container image, installs ultralytics, and deploys. Two URLs are printed:

```
https://<workspace>--smileguard-smileguarddetector-predict.modal.run
https://<workspace>--smileguard-smileguarddetector-health.modal.run
```

### Step 4 — set environment variable

```bash
export SMILEGUARD_ENDPOINT=https://<workspace>--smileguard-...predict.modal.run
```

Add this to your `.env` in the Next.js project and the Flask sidecar environment.

### Step 5 — verify deployment

```bash
curl https://<workspace>--smileguard-...health.modal.run
```

Expected response:
```json
{"status": "ok", "model": "smileguard_best.pt", "classes": [...]}
```

---

## 5. API contract

### POST `/predict`

Send a base64-encoded image. Returns detections with class names, confidence scores, and bounding boxes.

**Request body:**
```json
{
  "image_b64": "<base64-encoded JPEG or PNG>",
  "conf": 0.30,
  "iou":  0.45
}
```

`conf` and `iou` are optional — defaults are 0.30 and 0.45.

**Response body:**
```json
{
  "detections": [
    {
      "class_id":   1,
      "class_name": "calculus",
      "confidence": 0.7821,
      "bbox_xyxy":  [120.5, 80.2, 310.1, 205.8],
      "bbox_xywhn": [0.334, 0.449, 0.296, 0.376]
    }
  ],
  "count":      1,
  "image_size": [640, 480],
  "model":      "smileguard_best.pt"
}
```

`bbox_xyxy` is in pixels. `bbox_xywhn` is normalized (center x, center y, width, height).

### GET `/health`

Returns model load status and class list. Call this before sending patient images to confirm the endpoint is live.

---

## 6. Updating the model after retraining

After each training run in Colab that produces a new `best.pt`, follow this sequence exactly:

1. Copy `best.pt` from Google Drive to your local machine
2. Run: `python upload_weights.py --path best.pt`
3. Run: `modal deploy modal_inference.py`
4. Hit `/health` to confirm the new model is live
5. Send a test image via `smileguard_client.py` and verify detections look correct

> **Keep `smileguard_best.pt` filename consistent.** The Modal app hardcodes this filename. If you rename the weights file, update `MODEL_FILENAME` in `modal_inference.py` before deploying.

---

## 7. Throughput reference

YOLOv8m on a T4 processes a single 640px image in ~15–25ms GPU time. With network and pre/post processing, each request takes ~80–150ms end-to-end. With `max_inputs=4` per container:

| Traffic level | Containers needed | Within free $30/mo? |
|---|---|---|
| Pilot — 50 scans/day | 1 | Yes, comfortably |
| Active clinic — 500/day | 1–2 | Yes |
| Multi-clinic — 5,000/day | 2–4 | Likely exceeds free tier |

Modal autoscales new T4 containers automatically when the queue fills. The Starter plan default allows up to ~10 concurrent containers (40 simultaneous requests), which is ~300–500 requests/minute — far beyond SmileGuard's current needs.

### SDK note — `allow_concurrent_inputs` is deprecated

Modal 1.0 replaced `allow_concurrent_inputs` with `@modal.concurrent`. Update `modal_inference.py`:

```python
@modal.concurrent(max_inputs=4)
@app.cls(
    image=inference_image,
    gpu="T4",
    volumes={MODEL_DIR: model_volume},
    container_idle_timeout=300,
)
class SmileGuardDetector:
    ...
```

---

## 8. Do's

- Always run `/health` after every new deploy before sending real patient images.
- Keep `smileguard_best.pt` and `last.pt` backed up in Google Drive before uploading new weights.
- Set `container_idle_timeout` to at least 300 seconds. Shorter values cause cold starts mid-session.
- Use `conf=0.30` as the default threshold. Lower for higher sensitivity, raise if results are noisy.
- Use `smileguard_client.py` for all server-side calls — it handles base64 encoding and timeouts correctly.
- Monitor your Modal usage dashboard monthly. Know when you are approaching the $30 free tier limit.
- Keep the Modal Volume name `smileguard-weights` consistent across `modal_inference.py` and `upload_weights.py`.
- Test with a real dental image after every deploy. Blank images return zero detections and give a false green signal.
- Version your weights before uploading. Rename the old file as `smileguard_best_v{N}.pt` in Drive as a rollback checkpoint.

---

## 9. Don'ts

### Deployment

- **Never** use the HF Serverless Inference API for SmileGuard. It does not support custom `.pt` weights and will silently fail or fall back to the wrong model.
- **Never** commit `smileguard_best.pt` to a public GitHub repo. The weights encode proprietary training data. Use the Modal Volume or Google Drive only.
- **Never** set `container_idle_timeout` to 0 or omit it. The endpoint will cold-start on every single request, adding 15–30 seconds of latency to every patient session.
- **Never** skip `upload_weights.py` on first deploy. Without it the container throws `FileNotFoundError` on startup and the endpoint fails silently.

### Training

- **Never** use `copy_paste` or `mixup` augmentation. These caused NaN loss spikes in previous runs. Keep `mosaic` at 0.5 maximum.
- **Never** train with `amp=True`. AMP causes NaN loss on resume branches. `amp=False` is mandatory permanently.
- **Never** use `shutil.rmtree` on the Google Drive training directory during any sync. Use `dirs_exist_ok=True` with `shutil.copytree`. `rmtree` has previously destroyed saved checkpoints.

### Metrics and data

- **Never** judge model performance from a validation set smaller than ~70 images. The earlier 12-image val set produced noisy, unreliable mAP metrics.
- **Never** deploy a new model without checking per-class recall. Calculus recall is historically the weakest class and can drop significantly between runs.
- **Never** balance classes by annotation count. Balance by unique image count. Calculus was image-starved in early runs despite appearing balanced on paper.

---

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| `FileNotFoundError` on startup | Run `upload_weights.py` first. Check Modal Volume contains `smileguard_best.pt`. |
| First request takes 30+ seconds | Normal cold start. Set `container_idle_timeout=300` to keep warm during sessions. |
| All confidence scores very low | Lower `conf` threshold. Try `0.20` for more sensitive screening. |
| Zero detections on a valid image | Check image is RGB. Grayscale DICOM exports need conversion before sending. |
| HTTP 500 from Modal | Run `modal logs smileguard` — check for ultralytics import errors or CUDA OOM. |
| Endpoint URL stopped working | Re-run `modal deploy modal_inference.py` — the URL is stable across deploys for the same app name. |

---

*SmileGuard — Confidential internal documentation. Not for distribution.*