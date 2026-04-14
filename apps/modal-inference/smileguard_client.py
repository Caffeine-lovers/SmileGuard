import base64
import requests
import os
import json

def get_endpoint():
    endpoint = os.environ.get("SMILEGUARD_ENDPOINT")
    if not endpoint:
        raise ValueError("SMILEGUARD_ENDPOINT environment variable is not set.")
    return endpoint

def predict_image(image_path: str, conf: float = 0.30, iou: float = 0.45):
    """
    Sends a local image to the Modal inference server.
    """
    endpoint = get_endpoint()
        
    with open(image_path, "rb") as f:
        image_b64 = base64.b64encode(f.read()).decode("utf-8")
        
    payload = {
        "image_b64": image_b64,
        "conf": conf,
        "iou": iou
    }
    
    print(f"Sending request to {endpoint}...")
    response = requests.post(endpoint, json=payload, timeout=60)
    response.raise_for_status()
    
    return response.json()

def check_health():
    """
    Checks the health of the Modal inference server.
    """
    endpoint = get_endpoint()
    # Replace -predict with -health assuming standard endpoint suffix
    health_url = endpoint.replace("-predict.modal.run", "-health.modal.run")
    
    print(f"Checking health at {health_url}...")
    response = requests.get(health_url, timeout=10)
    response.raise_for_status()
    
    return response.json()

if __name__ == "__main__":
    # Quick debug block if run directly
    print("Health Check:")
    try:
        print(json.dumps(check_health(), indent=2))
    except Exception as e:
        print(f"Health check failed: {e}")
