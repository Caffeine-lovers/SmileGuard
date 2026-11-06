'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@smileguard/shared-hooks';
import { saveScan } from '@/lib/scanHistory';
import ScanHistory from '@/components/analysis/ScanHistory';
import ImageCropper from '@/components/analysis/ImageCropper';
import type { PreflightCheckResult } from '@smileguard/shared-types';
import { showAlert } from '@/components/ui/AppDialog';
import {
  AlertTriangle,
  RefreshCw,
  Camera,
  Sparkles,
  ShieldCheck,
  UploadCloud,
  CheckCircle2,
  X,
  Smartphone,
  Info,
  FlipHorizontal,
  Crop,
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

const SCAN_CONFIDENCE_THRESHOLD = 0.1;

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#ABEBC6'
];

type CameraSource = 'device' | 'phone';

// Cameras that are really a phone streamed to the PC (Windows Phone Link, macOS Continuity, common apps)
const PHONE_CAMERA_RE = /(phone link|connected camera|windows virtual camera|link to windows|continuity|iphone|android|galaxy|pixel|droidcam|epoccam|iriun|ivcam|camo)/i;
// Other software cameras that should never be picked as "this computer's camera"
const VIRTUAL_CAMERA_RE = /(virtual|obs|snap camera|manycam|xsplit|nvidia broadcast)/i;

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))
  );
}

// Device labels are only exposed after camera permission is granted, so request it once if needed.
async function listVideoInputs(): Promise<MediaDeviceInfo[]> {
  let devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
  if (devices.length && devices.every((d) => !d.label)) {
    const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    probe.getTracks().forEach((t) => t.stop());
    devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
  }
  return devices;
}

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
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Camera & Capture state
  const [inputMode, setInputMode] = useState<'camera' | 'upload'>('camera');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isMobile, setIsMobile] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  // Cropping: keep the uncropped original so the user can re-crop from scratch
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [isCropped, setIsCropped] = useState(false);
  const [cameraSource, setCameraSource] = useState<CameraSource>('device');
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Callback ref to guarantee stream is attached immediately when video element mounts
  const setVideoRef = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    if (element && mediaStreamRef.current) {
      if (element.srcObject !== mediaStreamRef.current) {
        element.srcObject = mediaStreamRef.current;
      }
      element.play().catch((err) => {
        console.warn('[Camera] Autoplay waiting for user gesture:', err);
      });
    }
  }, []);

  // Stop camera media stream
  const stopCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsCameraLoading(false);
  }, []);

  // Start a camera stream from an explicit source:
  //  - 'device': this computer's own webcam (skips Phone Link / virtual cameras)
  //  - 'phone' : a phone exposed to the PC as a camera (Windows Phone Link, Continuity Camera, etc.)
  // On real mobile devices both use facingMode, since there is only the device itself.
  const startCamera = useCallback(async (
    source: CameraSource = 'device',
    facing: 'user' | 'environment' = facingMode,
    deviceIdOverride?: string,
  ) => {
    stopCamera();
    setCameraError(null);
    setIsCameraLoading(true);
    setCameraSource(source);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Live camera is not supported by your browser. Please use the "Upload" tab instead.');
      setIsCameraLoading(false);
      return;
    }

    try {
      const video: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 } };

      if (isMobileDevice()) {
        video.facingMode = { ideal: facing };
      } else {
        const cams = await listVideoInputs();
        setVideoDevices(cams);
        const phones = cams.filter((c) => PHONE_CAMERA_RE.test(c.label));
        const nonPhones = cams.filter((c) => !PHONE_CAMERA_RE.test(c.label));
        const builtIns = nonPhones.filter((c) => !VIRTUAL_CAMERA_RE.test(c.label));
        const pool = source === 'phone' ? phones : builtIns.length ? builtIns : nonPhones;
        const chosen = (deviceIdOverride && pool.find((c) => c.deviceId === deviceIdOverride)) || pool[0];

        if (!chosen) {
          setCameraError(
            source === 'phone'
              ? 'No phone camera is connected to this computer. On Windows, open Phone Link > Settings > Features and turn on "Use as a connected camera", then try again. Or switch to the Upload tab.'
              : 'No built-in camera was found on this computer. Try "Open Phone Camera" or upload a photo.'
          );
          return;
        }
        video.deviceId = { exact: chosen.deviceId };
        setActiveDeviceId(chosen.deviceId);
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      } catch {
        // Retry without resolution hints, keeping the chosen device / facing mode
        const { width: _w, height: _h, ...rest } = video;
        stream = await navigator.mediaDevices.getUserMedia({ video: rest, audio: false });
      }

      mediaStreamRef.current = stream;
      setIsCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch((playErr) => {
          console.warn('[Camera] play() error:', playErr);
        });
      }
    } catch (err: unknown) {
      console.warn('[Camera] Failed to initialize live camera:', err);
      const name = err instanceof DOMException ? err.name : '';
      const msg = err instanceof Error ? err.message : String(err);
      if (name === 'NotAllowedError' || /Permission/i.test(msg)) {
        setCameraError('Camera permission was blocked. Click the camera icon in your address bar to allow access, then try again.');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setCameraError('That camera could not be found. Please try the other camera option or upload a photo.');
      } else if (name === 'NotReadableError') {
        setCameraError('The camera is being used by another app. Close it and try again.');
      } else {
        setCameraError(`Could not access the camera (${msg}). You can still upload a photo.`);
      }
      setIsCameraActive(false);
    } finally {
      setIsCameraLoading(false);
    }
  }, [facingMode, stopCamera]);

  // "Open Phone Camera": native camera app on phones, Phone Link camera on PCs
  const handleOpenPhoneCamera = () => {
    if (isMobileDevice()) {
      nativeCameraInputRef.current?.click();
    } else {
      startCamera('phone');
    }
  };

  // Sync stream to video element when isCameraActive changes
  useEffect(() => {
    if (isCameraActive && videoRef.current && mediaStreamRef.current) {
      if (videoRef.current.srcObject !== mediaStreamRef.current) {
        videoRef.current.srcObject = mediaStreamRef.current;
      }
      videoRef.current.play().catch((err) => console.warn('[Camera] Sync play error:', err));
    }
  }, [isCameraActive]);

  // Phones default to the front camera for live capture so users can see their own teeth
  useEffect(() => {
    const mobile = isMobileDevice();
    setIsMobile(mobile);
    if (mobile) setFacingMode('user');
  }, []);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Toggle front/back camera
  // Mobile: flip front/rear. Desktop: cycle through cameras of the same kind.
  const sameKindDevices = videoDevices.filter((c) =>
    cameraSource === 'phone' ? PHONE_CAMERA_RE.test(c.label) : !PHONE_CAMERA_RE.test(c.label)
  );
  const canSwitchCamera = isMobileDevice() || sameKindDevices.length > 1;

  const handleToggleFacingMode = () => {
    if (isMobileDevice()) {
      const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
      setFacingMode(nextFacing);
      startCamera(cameraSource, nextFacing);
      return;
    }
    if (sameKindDevices.length < 2) return;
    const idx = sameKindDevices.findIndex((c) => c.deviceId === activeDeviceId);
    startCamera(cameraSource, facingMode, sameKindDevices[(idx + 1) % sameKindDevices.length].deviceId);
  };

  // Capture snapshot from live video
  const handleCaptureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    const width = video.videoWidth || video.clientWidth || 1280;
    const height = video.videoHeight || video.clientHeight || 720;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flash animation effect
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);

    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob((blob) => {
      if (!blob) return;

      const file = new File([blob], `oral_photo_${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });

      setSelectedFile(file);
      setResult(null);
      setPreflightRejection(null);

      // Create preview
      const previewUrl = URL.createObjectURL(blob);
      setImagePreview(previewUrl);
      setOriginalPreview(previewUrl);
      setOriginalFile(file);
      setIsCropped(false);
      setCropOpen(true);

      // Stop camera once captured
      stopCamera();
    }, 'image/jpeg', 0.92);
  };

  // Process chosen file (via file input, native camera, or drag & drop)
  const processSelectedFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showAlert('Please select a valid image file (JPG, PNG, or WebP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showAlert('Image size exceeds 10MB limit. Please choose a smaller photo.');
      return;
    }

    setSelectedFile(file);
    setResult(null);
    setPreflightRejection(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setImagePreview(url);
      setOriginalPreview(url);
      setOriginalFile(file);
      setIsCropped(false);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);

    stopCamera();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleCropped = (file: File, url: string) => {
    setSelectedFile(file);
    setImagePreview(url);
    setIsCropped(true);
    setResult(null);
    setPreflightRejection(null);
    setCropOpen(false);
  };

  const handleUseFullPhoto = () => {
    if (originalFile && originalPreview) {
      setSelectedFile(originalFile);
      setImagePreview(originalPreview);
    }
    setIsCropped(false);
    setCropOpen(false);
  };

  const handleResetPhoto = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setOriginalPreview(null);
    setOriginalFile(null);
    setIsCropped(false);
    setCropOpen(false);
    setResult(null);
    setPreflightRejection(null);
  };

  const handleUpload = async () => {
    if (isAnalyzingRef.current || uploading) {
      console.warn('[Analysis] Analysis already in flight. Throttling duplicate call.');
      return;
    }

    if (!selectedFile) {
      showAlert('Please capture or select an intraoral photo first');
      return;
    }

    if (!consentGiven) {
      showAlert('Please grant Data Privacy Consent (RA 10173) before proceeding with the analysis.');
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
          conf: SCAN_CONFIDENCE_THRESHOLD, // Recall-calibrated threshold
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data: AnalysisResult = await response.json();

      setResult(data);
      setUploading(false);
      setInspectionStep('idle');

      // Save the scan to the patient's private history (non-blocking for the UI)
      if (currentUser?.id) {
        saveScan({
          patientId: currentUser.id,
          annotatedImageB64: data.xai_annotated_image_b64,
          detections: data.detections || [],
          model: data.model || 'yolov8m',
          confidenceThreshold: SCAN_CONFIDENCE_THRESHOLD,
        })
          .then(() => {
            setHistoryRefreshKey((k) => k + 1);
            setSaveError(null);
          })
          .catch((saveErr: unknown) => {
            console.warn('[Analysis] Could not save scan to history:', saveErr);
            setSaveError('Your result is shown below, but it could not be saved to your history.');
          });
      }
    } catch (error: any) {
      console.error('Error uploading image:', error);
      showAlert(`Failed to analyze image: ${error.message}`);
    } finally {
      setUploading(false);
      setInspectionStep('idle');
      setTimeout(() => {
        isAnalyzingRef.current = false;
      }, 1000);
    }
  };

  return (
    <div className="bg-bg-screen">
      <div className="w-full py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-full text-xs font-semibold uppercase tracking-wider mb-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              AI Intraoral Screening
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">AI Oral Analysis</h1>
          </div>
        </div>

        {/* Workspace: capture on the left, checklist + consent + action on the right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          {/* LEFT: Capture / Preview */}
          <section className="lg:col-span-7 bg-bg-surface rounded-card shadow-sm border border-border-card p-4 sm:p-5 space-y-4">
            {!imagePreview && (
              <>
                {/* Mode Tabs */}
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2 p-1 bg-bg-card rounded-lg border border-border-card">
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode('camera');
                    }}
                    className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-4 rounded-md text-xs sm:text-sm font-semibold transition cursor-pointer ${
                      inputMode === 'camera'
                        ? 'bg-brand-primary text-text-on-avatar shadow-xs'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="truncate">Camera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode('upload');
                      stopCamera();
                    }}
                    className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-4 rounded-md text-xs sm:text-sm font-semibold transition cursor-pointer ${
                      inputMode === 'upload'
                        ? 'bg-brand-primary text-text-on-avatar shadow-xs'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface'
                    }`}
                  >
                    <UploadCloud className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="truncate">Upload</span>
                  </button>
                </div>

                {/* MODE 1: Camera Viewfinder */}
                {inputMode === 'camera' && (
                  <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-border-card text-center text-white shadow-inner">
                    {/* Flash Overlay */}
                    {isFlashing && (
                      <div className="absolute inset-0 bg-white z-30 animate-out fade-out duration-200" />
                    )}
                    {isCameraLoading && (
                      <div className="absolute inset-0 bg-slate-950/80 z-25 flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                        <span className="text-xs font-semibold text-emerald-200">Starting camera...</span>
                      </div>
                    )}

                    {isCameraActive ? (
                      <div className={`relative w-full ${isMobile ? 'aspect-[3/4] max-h-[70vh]' : 'aspect-[4/3]'} bg-black overflow-hidden flex items-center justify-center`}>
                        <video
                          ref={setVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className={`w-full h-full object-cover ${isMobile && facingMode === 'user' ? '-scale-x-100' : ''}`}
                        />

                        {/* Intraoral Alignment Overlay */}
                        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                          {/* Target oval guide for mouth & teeth */}
                          <div className="w-3/4 max-w-[280px] h-36 sm:h-44 border-2 border-dashed border-emerald-400/80 rounded-[50px] shadow-[0_0_20px_rgba(16,185,129,0.3)] flex flex-col items-center justify-between p-2 animate-pulse">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-slate-950/70 px-2 py-0.5 rounded-full">
                              Upper Teeth
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-slate-950/70 px-2 py-0.5 rounded-full">
                              Lower Teeth
                            </span>
                          </div>
                          <p className="mt-3 text-[11px] font-semibold text-white/90 bg-slate-900/80 px-3 py-1 rounded-full backdrop-blur-xs">
                            Align mouth & parted teeth inside frame
                          </p>
                        </div>

                        {/* Viewfinder Top Bar */}
                        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20">
                          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/80 backdrop-blur-md rounded-full text-[11px] font-semibold text-emerald-400 border border-emerald-500/30">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            {cameraSource === 'phone' ? 'Phone Camera' : 'Live Camera'}
                          </span>
                          <div className="flex items-center gap-2">
                            {canSwitchCamera && (
                            <button
                              type="button"
                              onClick={handleToggleFacingMode}
                              title="Switch Front / Rear Camera"
                              className="p-2 bg-slate-900/80 hover:bg-slate-800 text-white rounded-full backdrop-blur-md transition cursor-pointer border border-white/10"
                            >
                              <FlipHorizontal className="w-4 h-4" />
                            </button>
                            )}
                            <button
                              type="button"
                              onClick={stopCamera}
                              title="Close Camera"
                              className="p-2 bg-slate-900/80 hover:bg-slate-800 text-white rounded-full backdrop-blur-md transition cursor-pointer border border-white/10"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Shutter Button Bar */}
                        <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center z-20">
                          <button
                            type="button"
                            onClick={handleCaptureSnapshot}
                            className="w-16 h-16 rounded-full border-4 border-white/80 bg-white/20 p-1 flex items-center justify-center transition active:scale-95 hover:bg-white/30 cursor-pointer shadow-lg backdrop-blur-xs"
                            aria-label="Capture photo"
                          >
                            <div className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-slate-900">
                              <Camera className="w-5 h-5" />
                            </div>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 sm:p-8 aspect-[4/3] flex flex-col items-center justify-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-emerald-400">
                          <Camera className="w-8 h-8" />
                        </div>
                        <div className="max-w-md space-y-1">
                          <h3 className="text-base font-bold text-white">
                            {isMobile ? 'Take a photo of your teeth' : 'Use Device Camera for Real-Time Capture'}
                          </h3>
                          <p className="text-xs text-slate-300">
                            {isMobile
                              ? 'Smile wide so your teeth and gums show. Hold the phone close, in good light.'
                              : 'Align your mouth closely using the on-screen framing guide to guarantee sharp focus and accurate dental detection.'}
                          </p>
                        </div>

                        {cameraError && (
                          <div className="p-3 bg-amber-950/80 border border-amber-600/50 rounded-lg text-left text-xs text-amber-200 max-w-sm flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <span>{cameraError}</span>
                          </div>
                        )}

                        {isMobile ? (
                          <div className="flex flex-col items-stretch gap-2.5 pt-2 w-full max-w-xs">
                            {/* Phone: front camera in the browser so the user can see themselves */}
                            <button
                              type="button"
                              onClick={() => startCamera('device', 'user')}
                              className="px-5 py-3 bg-brand-primary text-text-on-avatar text-sm font-semibold rounded-pill hover:bg-brand-primary/90 transition shadow-sm cursor-pointer flex items-center justify-center gap-2"
                            >
                              <Camera className="w-4 h-4" />
                              Selfie Camera (see yourself)
                            </button>
                            {/* Phone: native camera app, best image quality */}
                            <button
                              type="button"
                              onClick={() => nativeCameraInputRef.current?.click()}
                              className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-pill border border-slate-600 transition shadow-sm cursor-pointer flex items-center justify-center gap-2"
                            >
                              <Smartphone className="w-4 h-4 text-emerald-400" />
                              Open Camera App
                            </button>
                            <p className="text-[11px] text-slate-400">
                              Tip: the camera app gives sharper photos. Use the rear camera with a mirror, or ask someone to help.
                            </p>
                          </div>
                        ) : (
                        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => startCamera('device')}
                            className="px-5 py-2.5 bg-brand-primary text-text-on-avatar text-xs sm:text-sm font-semibold rounded-pill hover:bg-brand-primary/90 transition shadow-sm cursor-pointer flex items-center gap-2"
                          >
                            <Camera className="w-4 h-4" />
                            Start Live Camera
                          </button>

                          {/* Desktop: phone connected through Windows Phone Link / Continuity Camera */}
                          <button
                            type="button"
                            onClick={handleOpenPhoneCamera}
                            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-semibold rounded-pill border border-slate-600 transition shadow-sm cursor-pointer flex items-center gap-2"
                          >
                            <Smartphone className="w-4 h-4 text-emerald-400" />
                            Open Phone Camera
                          </button>
                        </div>
                        )}
                        <input
                              ref={nativeCameraInputRef}
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={handleFileSelect}
                              className="hidden"
                            />
                      </div>
                    )}
                  </div>
                )}

                {/* MODE 2: File Upload / Drag & Drop */}
                {inputMode === 'upload' && (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    className={`w-full border-2 border-dashed rounded-xl p-6 sm:p-8 aspect-[4/3] text-center transition cursor-pointer flex flex-col items-center justify-center space-y-3 ${
                      isDragOver
                        ? 'border-brand-primary bg-brand-primary/5'
                        : 'border-brand-primary/30 hover:border-brand-primary bg-bg-card'
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <div className="w-14 h-14 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                      <UploadCloud className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-text-primary">
                        Click to choose photo or drag & drop here
                      </p>
                      <p className="text-xs text-text-secondary mt-1">
                        Supports JPG, PNG, or WebP close-up oral images (max 10MB)
                      </p>
                    </div>
                    <span className="inline-block px-3 py-1 bg-bg-surface border border-border-card rounded-md text-[11px] font-semibold text-text-primary">
                      Browse File
                    </span>
                  </div>
                )}
              </>
            )}

            {/* ACTIVE PHOTO PREVIEW CARD (When an image is ready) */}
            {imagePreview && (
              <div className="p-4 sm:p-5 bg-bg-card rounded-xl border border-border-card space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                      {isCropped ? 'Cropped & Ready' : 'Photo Selected & Ready'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetPhoto}
                    className="text-xs font-semibold text-text-secondary hover:text-rose-600 transition flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </div>

                <div className="relative rounded-lg overflow-hidden border border-border-card bg-slate-900 flex items-center justify-center max-h-80">
                  <img
                    src={imagePreview}
                    alt="Oral Photo Preview"
                    className="w-full h-auto max-h-80 object-contain"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border-card">
                  <div className="text-xs text-text-secondary">
                    <span className="font-semibold text-text-primary">
                      {selectedFile?.name || 'oral_photo.jpg'}
                    </span>
                    {selectedFile?.size && (
                      <span className="ml-2">
                        ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCropOpen(true)}
                      className="px-3 py-1.5 bg-brand-primary text-text-on-avatar hover:bg-brand-primary/90 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Crop className="w-3 h-3" />
                      {isCropped ? 'Re-crop' : 'Crop to Teeth'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleResetPhoto();
                        setInputMode('camera');
                        setTimeout(() => startCamera(cameraSource, isMobile ? facingMode : undefined), 100);
                      }}
                      className="px-3 py-1.5 bg-bg-surface hover:bg-slate-100 dark:hover:bg-slate-800 text-text-primary border border-border-card rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3 h-3 text-text-secondary" />
                      Retake Photo
                    </button>
                  </div>
                </div>
              </div>
            )}


            {imagePreview && !isCropped && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                <Crop className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                <span>
                  For the most accurate result, crop the photo so only your teeth and gums are visible.{' '}
                  <button type="button" onClick={() => setCropOpen(true)} className="font-bold underline cursor-pointer">
                    Crop now
                  </button>
                </span>
              </div>
            )}

            {cropOpen && originalPreview && (
              <ImageCropper
                src={originalPreview}
                fileName={originalFile?.name}
                onCancel={() => setCropOpen(false)}
                onSkip={handleUseFullPhoto}
                onCropped={handleCropped}
              />
            )}

            {/* Hidden Canvas for Frame Capture */}
            <canvas ref={canvasRef} className="hidden" />
          </section>

          {/* RIGHT: Guidance, consent, and run */}
          <aside className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
            {/* Clinical Pre-Flight Guide Checklist */}
            {(
              <div className="p-4 bg-brand-primary/5 border border-brand-primary/20 rounded-card text-xs text-text-primary space-y-2">
                <p className="font-bold flex items-center gap-1.5 text-brand-primary uppercase tracking-wider text-[11px]">
                  <Info className="w-3.5 h-3.5" />
                  Intraoral Photo Clinical Criteria
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-text-secondary">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    Open mouth slightly showing teeth & gums
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    Tight macro crop (no nose, eyes, or face)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    Natural teeth only (no orthodontic braces)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    Good direct lighting, sharp focus
                  </li>
                </ul>
              </div>
            )}

            {/* Data Privacy Consent (RA 10173) */}
            <div>
              <div className="p-4 bg-bg-card rounded-card border border-border-card text-left transition hover:border-brand-primary/40 space-y-3">
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
              <div className="p-4 bg-teal-50 border-2 border-teal-300 rounded-card flex items-start gap-3 text-teal-900 shadow-sm animate-in fade-in duration-200">
                <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold uppercase tracking-wider text-teal-950 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    {inspectionStep === 'preflight'
                      ? 'Step 1/2: Clinical Quality Check (Verifying Teeth Presence)...'
                      : 'Step 2/2: YOLOv8m Oral Anomaly Detection...'}
                  </p>
                  <p className="text-teal-800 leading-relaxed">
                    {inspectionStep === 'preflight'
                      ? 'Screening photo to ensure natural human teeth are present, verifying absence of braces, and inspecting illumination...'
                      : 'Transmitting verified intraoral photo to cloud GPU container for deep lesion segmentation...'}
                  </p>
                </div>
              </div>
            )}

            {/* Pre-Flight AI Rejection / Throwback Banner */}
            {preflightRejection && !preflightRejection.passed && (
              <div className="p-4 bg-amber-50/80 border-2 border-amber-400 rounded-card shadow-sm animate-in fade-in duration-200 text-left">
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
                          handleResetPhoto();
                          setInputMode('camera');
                          setTimeout(() => startCamera(cameraSource, isMobile ? facingMode : undefined), 100);
                        }}
                        className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold uppercase tracking-wider rounded-md transition flex items-center gap-2 cursor-pointer shadow-xs"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Retake with Camera
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleResetPhoto();
                          setInputMode('upload');
                        }}
                        className="px-4 py-2 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold uppercase tracking-wider rounded-md transition flex items-center gap-2 cursor-pointer"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        Upload Different Photo
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

            {/* Action Button: Analyze Image */}
            <div className="flex flex-col items-center">
              <button
                onClick={handleUpload}
                disabled={uploading || !selectedFile || !consentGiven}
                className="w-full p-3.5 bg-brand-primary text-text-on-avatar font-semibold rounded-pill hover:bg-brand-primary/90 disabled:bg-border-card disabled:cursor-not-allowed transition shadow-sm cursor-pointer flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>
                      {inspectionStep === 'preflight'
                        ? 'Step 1/2: Verifying Quality...'
                        : 'Step 2/2: Detecting Anomalies...'}
                    </span>
                  </>
                ) : !selectedFile ? (
                  <span>Take or Select Photo First</span>
                ) : !consentGiven ? (
                  <span>Consent Required to Analyze</span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Run AI Oral Analysis</span>
                  </>
                )}
              </button>
              {!consentGiven && selectedFile && (
                <p className="text-xs font-bold text-amber-700 mt-2">
                  Please check the consent box above to proceed.
                </p>
              )}
            </div>

          </aside>
        </div>

        {/* Results Section */}
        {result && (
          <section className="bg-bg-surface rounded-card shadow-sm border border-border-card p-4 sm:p-5">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              </div>

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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-semibold text-text-primary capitalize text-xs sm:text-sm">
                              {det.class_name.replace('_', ' ')}
                            </h4>
                            <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-medium">
                              {(det.confidence * 100).toFixed(1)}% confidence
                            </span>
                          </div>
                          
                          {/* Bounding Box Information */}
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                            <div className="bg-bg-surface p-2 rounded border border-border-card">
                              <p className="text-text-secondary text-[10px] sm:text-xs">Pixel Coordinates (X1, Y1, X2, Y2)</p>
                              <p className="font-mono text-text-primary text-[11px] sm:text-xs">
                                ({det.bbox_xyxy[0].toFixed(0)}, {det.bbox_xyxy[1].toFixed(0)}, {det.bbox_xyxy[2].toFixed(0)}, {det.bbox_xyxy[3].toFixed(0)})
                              </p>
                            </div>
                            <div className="bg-bg-surface p-2 rounded border border-border-card">
                              <p className="text-text-secondary text-[10px] sm:text-xs">Box Width × Height</p>
                              <p className="font-mono text-text-primary text-[11px] sm:text-xs">
                                {(det.bbox_xyxy[2] - det.bbox_xyxy[0]).toFixed(0)} × {(det.bbox_xyxy[3] - det.bbox_xyxy[1]).toFixed(0)} px
                              </p>
                            </div>
                            <div className="bg-bg-surface p-2 rounded border border-border-card">
                              <p className="text-text-secondary text-[10px] sm:text-xs">Normalized Coords (Xc, Yc, W, H)</p>
                              <p className="font-mono text-text-primary text-[11px] sm:text-xs">
                                ({det.bbox_xywhn[0].toFixed(3)}, {det.bbox_xywhn[1].toFixed(3)}, {det.bbox_xywhn[2].toFixed(3)}, {det.bbox_xywhn[3].toFixed(3)})
                              </p>
                            </div>
                            <div className="bg-bg-surface p-2 rounded border border-border-card">
                              <p className="text-text-secondary text-[10px] sm:text-xs">Class ID</p>
                              <p className="font-mono text-text-primary text-[11px] sm:text-xs">
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

              {saveError && <p className="text-xs text-amber-700 font-semibold">{saveError}</p>}
              <p className="text-sm text-text-secondary italic mt-4">Please show these results to your dentist for a professional diagnosis.</p>
            </div>
          </section>
        )}

        <ScanHistory patientId={currentUser?.id} refreshKey={historyRefreshKey} />

        <Link href="/dashboard" className="inline-block text-text-link hover:text-brand-primary/90 font-medium">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
