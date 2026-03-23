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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">AI Oral Analysis</h1>
        <p className="text-gray-600 mb-8">Upload a photo of your teeth for AI-powered analysis</p>

        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Image Upload */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-4">
              Upload Image
            </label>
            <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:border-blue-500 transition">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
              />
              {selectedFile && (
                <p className="text-sm text-green-600 mt-2">✓ {selectedFile.name} selected</p>
              )}
              <p className="text-xs text-gray-500 mt-4">JPG, PNG or WebP image (max 5MB)</p>
            </div>
          </div>

          {/* Upload Button */}
          <div className="mb-6">
            <button
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
              className="w-full p-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {uploading ? 'Analyzing...' : 'Analyze Image'}
            </button>
          </div>

          {/* Results */}
          {result && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-2">Analysis Results</h3>
              <p className="text-green-700">{result}</p>
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-gray-700">
            <p className="font-semibold mb-2">Tips for best results:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Ensure good lighting and clear visibility of your teeth</li>
              <li>Take a straight-on photo of your front teeth</li>
              <li>Keep the image steady and in focus</li>
              <li>This analysis is for informational purposes only. Consult your dentist for diagnosis.</li>
            </ul>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-8">
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
