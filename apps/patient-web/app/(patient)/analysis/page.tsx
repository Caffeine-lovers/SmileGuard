'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@smileguard/shared-hooks';
import { supabase } from '@smileguard/supabase-client';
import type { PreflightCheckResult } from '@smileguard/shared-types';
import {
  AlertTriangle,
  RefreshCw,
  Camera,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

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
  xai_annotated_image_b64?: string;
}

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#ABEBC6'
];

export default function AnalysisPage() {
  const { currentUser } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [inspectionStep, setInspectionStep] = useState<'idle' | 'preflight' | 'anomaly_detection'>('idle');
  const [preflightRejection, setPreflightRejection] = useState<PreflightCheckResult | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const isAnalyzingRef = useRef(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null); // Reset previous result when a new image is selected
      setPreflightRejection(null); // Reset previous preflight rejection
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
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
    if (isAnalyzingRef.current || uploading) {
      console.warn('[Analysis] Analysis already in flight. Throttling duplicate call.');
      return;
    }

    if (!selectedFile) {
      alert('Please select an image first');
      return;
    }

    if (!consentGiven) {
      alert('Please grant Data Privacy Consent (RA 10173) before proceeding with the analysis.');
      return;
    }

    isAnalyzingRef.current = true;
    setUploading(true);
    setPreflightRejection(null);
    setResult(null);
    setInspectionStep('preflight');

    try {
      // 1. Convert image to base64
      const image_b64 = await fileToBase64(selectedFile);

      // 2. Stage 1: Pre-Flight Clinical Quality Gate
      console.log('[Analysis] Initiating Stage 1: Pre-Flight Quality Gate...');
      const preflightRes = await fetch('/api/analysis/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_b64 }),
      });

      const preflightData: PreflightCheckResult = await preflightRes.json();

      if (!preflightData.passed) {
        console.warn('[Analysis] ⚠️ Pre-Flight Gate REJECTED image:', preflightData.rejection_reason);
        setPreflightRejection(preflightData);
        setUploading(false);
        setInspectionStep('idle');
        return; // HALT pipeline — do not waste GPU compute or report false positives
      }

      console.log('[Analysis] ✅ Pre-Flight Quality Gate PASSED. Proceeding to Stage 2: YOLOv8m inference...');
      setInspectionStep('anomaly_detection');

      // 3. Stage 2: Send certified photo to Modal.com Serverless GPU
      const endpoint = process.env.NEXT_PUBLIC_SMILEGUARD_ENDPOINT;
      if (!endpoint) {
        throw new Error('Modal Prediction URL is not set in environment variables.');
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_b64: image_b64,
          conf: 0.10, // Recall-calibrated threshold
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data: AnalysisResult = await response.json();
      
      // CRITICAL: Stop throbber immediately as soon as results arrive!
      setResult(data);
      setUploading(false);
      setInspectionStep('idle');

      // Debug: log response shape
      console.log('[Analysis] API response keys:', Object.keys(data));
      console.log('[Analysis] xai_annotated_image_b64 present:', !!data.xai_annotated_image_b64);
      console.log('[Analysis] Detection count:', data.count);

      // Background Upload of XAI annotated image to Supabase (non-blocking)
      if (data.xai_annotated_image_b64) {
        (async () => {
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData?.session) {
              console.log('[Analysis] No active Supabase session — skipping XAI cloud backup.');
              return;
            }

            const byteCharacters = atob(data.xai_annotated_image_b64!);
            const byteArray = new Uint8Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteArray[i] = byteCharacters.charCodeAt(i);
            }

            const userName = currentUser?.name
              || sessionData.session.user.user_metadata?.name
              || currentUser?.id
              || sessionData.session.user.id
              || 'unknown';
            const userIdentifier = userName.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
            const filename = `${userIdentifier}_xai.jpg`;

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('Analyzed images')
              .upload(filename, byteArray, {
                contentType: 'image/jpeg',
                upsert: true,
              });

            if (uploadError) {
              console.warn('[Analysis] Supabase background upload:', uploadError.message);
            } else {
              console.log('[Analysis] ✅ Background XAI image saved:', uploadData?.path);
            }
          } catch (uploadErr) {
            console.warn('[Analysis] Background upload non-fatal exception:', uploadErr);
          }
        })();
      }
    } catch (error: any) {
      console.error('Error uploading image:', error);
      alert(`Failed to analyze image: ${error.message}`);
    } finally {
      setUploading(false);
      setInspectionStep('idle');
      // Cooldown throttle release
      setTimeout(() => {
        isAnalyzingRef.current = false;
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen bg-bg-screen">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-brand-cyan mb-2"> AI Oral Analysis</h1>
        <p className="text-text-secondary mb-8">Upload a photo of your teeth for AI-powered analysis</p>

        <div className="bg-bg-surface rounded-card shadow-sm border border-border-card p-8">
          {/* Image Upload */}
          <div className="mb-6 flex flex-col items-center">
            <label className="block text-sm font-semibold text-text-primary mb-4">
              Upload Image
            </label>
            <div className="w-full max-w-md border-2 border-dashed border-brand-primary/30 rounded-lg p-8 text-center hover:border-brand-primary transition">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="block mx-auto text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-primary file:text-text-on-avatar hover:file:bg-brand-primary/90 cursor-pointer"
              />
              {selectedFile && (
                <p className="text-xs font-bold text-emerald-700 mt-2">{selectedFile.name} selected</p>
              )}
              <p className="text-xs text-text-secondary mt-4">JPG, PNG or WebP image (max 5MB)</p>
            </div>
          </div>

          {/* Case A: Data Privacy Consent (RA 10173) */}
          <div className="mb-6 flex flex-col items-center">
            <div className="w-full max-w-md p-4 bg-bg-card rounded-card border border-border-card text-left transition hover:border-brand-primary/40 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-primary shrink-0" />
                <p className="font-semibold text-xs text-text-primary">
                  Data Privacy & AI Processing Consent (RA 10173)
                </p>
              </div>
              <p className="text-text-secondary text-[11px] leading-relaxed">
                Oral photographs are collected, stored securely, and processed solely for preliminary informational screening under the <strong>Philippine Data Privacy Act of 2012</strong>. This does not replace clinical diagnosis by a licensed dentist.
              </p>
              <label className="flex items-center gap-2.5 pt-2 border-t border-border-card cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="h-4 w-4 rounded border-border-card text-brand-primary focus:ring-brand-primary cursor-pointer"
                />
                <span className="text-xs font-semibold text-text-primary group-hover:text-brand-primary transition">
                  I understand and give consent
                </span>
              </label>
            </div>
          </div>

          {/* Pre-Flight Inspection In-Progress Banner */}
          {uploading && (
            <div className="mb-6 p-4 bg-teal-50 border-2 border-teal-300 rounded-card flex items-start gap-3 text-teal-900 shadow-sm animate-in fade-in duration-200">
              <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold uppercase tracking-wider text-teal-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  {inspectionStep === 'preflight'
                    ? 'Step 1/2: Clinical Pre-Flight Inspection...'
                    : 'Step 2/2: YOLOv8m Oral Anomaly Detection...'}
                </p>
                <p className="text-teal-800 leading-relaxed">
                  {inspectionStep === 'preflight'
                    ? 'Screening photo for dental presence, verifying absence of orthodontic braces, and evaluating illumination...'
                    : 'Transmitting verified intraoral photo to cloud GPU container for deep lesion segmentation...'}
                </p>
              </div>
            </div>
          )}

          {/* Pre-Flight AI Rejection / Throwback Banner */}
          {preflightRejection && !preflightRejection.passed && (
            <div className="mb-6 p-6 bg-amber-50/80 border-2 border-amber-400 rounded-card shadow-sm animate-in fade-in duration-200 text-left">
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-amber-200/80 rounded-full text-amber-800 shrink-0 mt-0.5">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-200 px-2 py-0.5 rounded">
                      Pre-Flight AI Quality Gate
                    </span>
                    {preflightRejection.rejection_reason && (
                      <span className="text-[11px] font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                        {preflightRejection.rejection_reason}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-black text-amber-950">
                    {preflightRejection.patient_feedback?.headline || 'Photo Verification Notice'}
                  </h3>

                  <p className="text-xs text-amber-900 leading-relaxed">
                    {preflightRejection.patient_feedback?.description ||
                      'The uploaded image did not meet clinical screening criteria. Please ensure your photo focuses clearly on natural teeth without orthodontic braces.'}
                  </p>

                  {preflightRejection.patient_feedback?.tips &&
                    preflightRejection.patient_feedback.tips.length > 0 && (
                      <div className="mt-3 p-3 bg-white/80 border border-amber-300 rounded-md">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-900 mb-1.5 flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-amber-700" />
                          Tips for a Valid Intraoral Photo:
                        </p>
                        <ul className="text-xs text-amber-900 space-y-1 list-disc pl-4">
                          {preflightRejection.patient_feedback.tips.map((tip, idx) => (
                            <li key={idx}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setPreflightRejection(null);
                        setSelectedFile(null);
                        setImagePreview(null);
                      }}
                      className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold uppercase tracking-wider rounded-md transition flex items-center gap-2 cursor-pointer shadow-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Try Another Photo
                    </button>
                    {preflightRejection.rejection_reason === 'BRACES_DETECTED' && (
                      <Link
                        href="/appointments"
                        className="px-4 py-2 bg-white hover:bg-amber-100 text-amber-900 border border-amber-400 text-xs font-bold uppercase tracking-wider rounded-md transition"
                      >
                        Book Orthodontic Checkup
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Upload Button */}
          <div className="mb-6 flex flex-col items-center">
            <button
              onClick={handleUpload}
              disabled={uploading || !selectedFile || !consentGiven}
              className="w-full max-w-md p-3 bg-brand-primary text-text-on-avatar font-semibold rounded-pill hover:bg-brand-primary/90 disabled:bg-border-card disabled:cursor-not-allowed transition"
            >
              {uploading
                ? inspectionStep === 'preflight'
                  ? 'Step 1/2: Inspecting Quality...'
                  : 'Step 2/2: Detecting Anomalies...'
                : !consentGiven && selectedFile
                ? 'Consent Required to Analyze'
                : 'Analyze Image'}
            </button>
            {!consentGiven && selectedFile && (
              <p className="text-xs font-bold text-amber-700 mt-2">
                Please check the consent box above to proceed.
              </p>
            )}
          </div>

          {/* Results */}
          {result && (
            <div className="mb-6 space-y-4">
              {/* Original Image */}
              {imagePreview && (
                <div className="p-4 bg-bg-card rounded-card border border-border-card">
                  <h3 className="font-semibold text-text-primary mb-4">Original Image</h3>
                  <img 
                    src={imagePreview}
                    alt="Original" 
                    className="w-full border border-border-card rounded-card"
                  />
                </div>
              )}

              {/* Image with Bounding Boxes from YOLO */}
              {result.xai_annotated_image_b64 && result.count > 0 && (
                <div className="p-4 bg-bg-card rounded-card border border-border-card">
                  <h3 className="font-semibold text-text-primary mb-4">Detection Visualization</h3>
                  <img 
                    src={`data:image/jpeg;base64,${result.xai_annotated_image_b64}`}
                    alt="YOLO Detection" 
                    className="w-full border border-border-card rounded-card"
                  />
                </div>
              )}

              {/* Analysis Summary */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-card">
                <h3 className="font-semibold text-green-800 mb-2">Analysis Results</h3>
                {result.count === 0 ? (
                  <p className="text-green-700">No issues detected! Your teeth look clean based on this image.</p>
                ) : (
                  <p className="text-green-700 font-medium">Found {result.count} potential issue{result.count > 1 ? 's' : ''}:</p>
                )}
              </div>

              {/* Detailed Detections with Bounding Boxes */}
              {result.count > 0 && (
                <div className="space-y-3">
                  {result.detections.map((det, index) => (
                    <div 
                      key={index} 
                      className="p-4 border rounded-card"
                      style={{ borderColor: COLORS[index % COLORS.length] + '40' }}
                    >
                      <div className="flex items-start gap-3">
                        <div 
                          className="w-4 h-4 rounded-full mt-1 flex-shrink-0"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-text-primary capitalize">
                              {det.class_name.replace('_', ' ')}
                            </h4>
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium">
                              {(det.confidence * 100).toFixed(1)}% confidence
                            </span>
                          </div>
                          
                          {/* Bounding Box Information */}
                          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                            <div className="bg-bg-surface p-2 rounded">
                              <p className="text-text-secondary text-xs">Pixel Coordinates (X1, Y1, X2, Y2)</p>
                              <p className="font-mono text-text-primary">
                                ({det.bbox_xyxy[0].toFixed(0)}, {det.bbox_xyxy[1].toFixed(0)}, {det.bbox_xyxy[2].toFixed(0)}, {det.bbox_xyxy[3].toFixed(0)})
                              </p>
                            </div>
                            <div className="bg-bg-surface p-2 rounded">
                              <p className="text-text-secondary text-xs">Box Width × Height</p>
                              <p className="font-mono text-text-primary">
                                {(det.bbox_xyxy[2] - det.bbox_xyxy[0]).toFixed(0)} × {(det.bbox_xyxy[3] - det.bbox_xyxy[1]).toFixed(0)} px
                              </p>
                            </div>
                            <div className="bg-bg-surface p-2 rounded">
                              <p className="text-text-secondary text-xs">Normalized Coords (Xc, Yc, W, H)</p>
                              <p className="font-mono text-text-primary text-xs">
                                ({det.bbox_xywhn[0].toFixed(3)}, {det.bbox_xywhn[1].toFixed(3)}, {det.bbox_xywhn[2].toFixed(3)}, {det.bbox_xywhn[3].toFixed(3)})
                              </p>
                            </div>
                            <div className="bg-bg-surface p-2 rounded">
                              <p className="text-text-secondary text-xs">Class ID</p>
                              <p className="font-mono text-text-primary">
                                {det.class_id}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-sm text-text-secondary italic mt-4">Please show these results to your dentist for a professional diagnosis.</p>
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 bg-brand-primary/5 border border-brand-primary/20 rounded-card text-sm text-text-primary">
            <p className="font-semibold mb-2"> Tips for best results:</p>
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
