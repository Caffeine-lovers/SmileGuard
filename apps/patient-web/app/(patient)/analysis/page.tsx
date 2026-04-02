'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Detection {
  class_id: number;
  class_name: string;
  confidence: number;
  bbox_xyxy: number[];
  bbox_xywhn: number[];
}

interface AnalysisResult {
  detections: Detection[];
  count: number;
  image_size: number[];
  model: string;
}

export default function AnalysisPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null); // Reset previous result when a new image is selected
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        // Remove the data:image/jpeg;base64, prefix
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('Please select an image first');
      return;
    }

    setUploading(true);
    try {
      const endpoint = process.env.NEXT_PUBLIC_SMILEGUARD_ENDPOINT;
      if (!endpoint) {
        throw new Error('Modal Prediction URL is not set in environment variables.');
      }

      // Convert image to base64
      const image_b64 = await fileToBase64(selectedFile);

      // Send to Modal.com Serverless GPU
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_b64: image_b64,
          conf: 0.30,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data: AnalysisResult = await response.json();
      setResult(data);
    } catch (error: any) {
      console.error('Error uploading image:', error);
      alert(`Failed to analyze image: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-screen">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-brand-cyan mb-2">🔍 AI Oral Analysis</h1>
        <p className="text-text-secondary mb-8">Upload a photo of your teeth for AI-powered analysis</p>

        <div className="bg-bg-surface rounded-card shadow-sm border border-border-card p-8">
          {/* Image Upload */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-text-primary mb-4">
              Upload Image
            </label>
            <div className="border-2 border-dashed border-brand-primary/30 rounded-lg p-8 text-center hover:border-brand-primary transition">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-primary file:text-text-on-avatar hover:file:bg-brand-primary/90"
              />
              {selectedFile && (
                <p className="text-sm text-green-600 mt-2">✓ {selectedFile.name} selected</p>
              )}
              <p className="text-xs text-text-secondary mt-4">JPG, PNG or WebP image (max 5MB)</p>
            </div>
          </div>

          {/* Upload Button */}
          <div className="mb-6">
            <button
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
              className="w-full p-3 bg-brand-primary text-text-on-avatar font-semibold rounded-pill hover:bg-brand-primary/90 disabled:bg-border-card transition"
            >
              {uploading ? 'Analyzing...' : 'Analyze Image'}
            </button>
          </div>

          {/* Results */}
          {result && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-card">
              <h3 className="font-semibold text-green-800 mb-2">Analysis Results</h3>
              {result.count === 0 ? (
                <p className="text-green-700">No issues detected! Your teeth look clean based on this image.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-green-700 font-medium">Found {result.count} potential issue{result.count > 1 ? 's' : ''}:</p>
                  <ul className="list-disc pl-5 mt-2 text-green-800">
                    {result.detections.map((det, index) => (
                      <li key={index} className="capitalize">
                        <strong>{det.class_name.replace('_', ' ')}</strong> ({(det.confidence * 100).toFixed(1)}% confidence)
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-green-700 mt-4 italic">Please show these results to your dentist for a professional diagnosis.</p>
                </div>
              )}
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 bg-brand-primary/5 border border-brand-primary/20 rounded-card text-sm text-text-primary">
            <p className="font-semibold mb-2">💡 Tips for best results:</p>
            <ul className="list-disc pl-5 space-y-1 text-text-secondary">
              <li>Ensure good lighting and clear visibility of your teeth</li>
              <li>Take a straight-on photo of your front teeth</li>
              <li>Keep the image steady and in focus</li>
              <li>This analysis is for informational purposes only. Consult your dentist for diagnosis.</li>
            </ul>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-8">
          <Link href="/dashboard" className="text-text-link hover:text-brand-primary/90 font-medium">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
