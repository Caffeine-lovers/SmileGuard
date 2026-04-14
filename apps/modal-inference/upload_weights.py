import os
import argparse
import modal

volume = modal.Volume.from_name("smileguard-weights", create_if_missing=True)
app = modal.App("smileguard-upload-weights")

path = "apps\\modal-inference\\Weights\\best.pt"  # Update this to your local path of the weights file

@app.local_entrypoint()
def main(path: str):
    if not os.path.exists(path):
        raise FileNotFoundError(f"Weights file not found: {path} (Make sure you have downloaded smileguard_best.pt locally)")
    
    print(f"Uploading {path} to Modal Volume 'smileguard-weights' as 'smileguard_best.pt'...")
    with volume.batch_upload() as batch:
        batch.put_file(path, "smileguard_best.pt")
    print("Upload complete! You can now deploy the inference server.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Upload YOLO weights to Modal")
    parser.add_argument("--path", required=True, help="Path to smileguard_best.pt")
    args = parser.parse_args()
    main(args.path)