'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function AnalysisPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('Please select an image first');
      return;
    }

    setUploading(true);
    try {
      // Mock AI analysis
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setResult(
        'AI Analysis Complete: The image shows good overall oral health. Regular brushing and flossing recommended.'
      );
      setSelectedFile(null);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to analyze image');
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
              <p className="text-green-700">{result}</p>
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
