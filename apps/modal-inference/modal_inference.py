import modal
from pydantic import BaseModel

# Build container image with dependencies
inference_image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "ultralytics", "fastapi[standard]", "pydantic", "python-multipart"
).apt_install("libgl1-mesa-glx", "libglib2.0-0")

model_volume = modal.Volume.from_name("smileguard-weights")
app = modal.App("smileguard")

MODEL_DIR = "/weights"
MODEL_FILENAME = "smileguard_best.pt"

class InferenceRequest(BaseModel):
    image_b64: str
    conf: float = 0.30
    iou: float = 0.45

# Start GPU container
@app.cls(
    image=inference_image,
    gpu="T4",
    volumes={MODEL_DIR: model_volume},
    scaledown_window=300,
)
@modal.concurrent(max_inputs=4)
class SmileGuardDetector:
    @modal.enter()
    def load_model(self):
        from ultralytics import YOLO
        import os
        
        model_path = os.path.join(MODEL_DIR, MODEL_FILENAME)
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model weights not found at {model_path}. Did you run upload_weights.py?")
        
        self.model = YOLO(model_path)
        self.classes = self.model.names

    @modal.method()
    def predict_logic(self, image_b64: str, conf: float, iou: float):
        import base64
        import io
        from PIL import Image
        
        # Decode base64 image
        image_data = base64.b64decode(image_b64)
        image = Image.open(io.BytesIO(image_data)).convert("RGB")
        
        # Run inference
        results = self.model.predict(image, conf=conf, iou=iou)
        
        # Extract detections
        detections = []
        count = 0
        for r in results:
            boxes = r.boxes
            for box in boxes:
                count += 1
                class_id = int(box.cls.item())
                detections.append({
                    "class_id": class_id,
                    "class_name": self.classes[class_id],
                    "confidence": float(box.conf.item()),
                    "bbox_xyxy": box.xyxy[0].tolist(),
                    "bbox_xywhn": box.xywhn[0].tolist()
                })
                
        # Generate Explainable AI (XAI) output - annotated image
        annotated_img = results[0].plot()
        annotated_img_pil = Image.fromarray(annotated_img[..., ::-1]) # Convert BGR to RGB
        buffered = io.BytesIO()
        annotated_img_pil.save(buffered, format="JPEG")
        annotated_b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
                
        return {
            "detections": detections,
            "count": count,
            "image_size": [image.width, image.height],
            "model": MODEL_FILENAME,
            "xai_annotated_image_b64": annotated_b64
        }

@app.function(image=inference_image)
@modal.fastapi_endpoint(method="POST")
def predict(req: InferenceRequest):
    detector = SmileGuardDetector()
    return detector.predict_logic.remote(req.image_b64, req.conf, req.iou)

@app.function(image=inference_image)
@modal.fastapi_endpoint(method="GET")
def health():
    return {"status": "ok", "model": MODEL_FILENAME, "classes": ["cavity", "caries", "decay", "calculus", "gingivitis", "tooth_discoloration"]}