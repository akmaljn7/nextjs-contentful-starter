import React, { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Check, X } from "lucide-react";

/**
 * Check-in camera modal — asks for camera permission, previews the video,
 * captures a single JPEG frame on demand, and returns the data URL to the parent.
 *
 * Props:
 *   open: boolean
 *   onCancel(): void
 *   onCapture(dataUrl): void
 *   subtitle?: string
 */
export function CameraCapture({ open, onCancel, onCapture, subtitle }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError("");
    setPreview("");
    setReady(false);

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera API not supported in this browser");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          v.onloadedmetadata = () => { v.play().catch(() => {}); setReady(true); };
        }
      } catch (e) {
        setError(e.message || "Camera permission denied");
      }
    })();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [open]);

  const snap = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !ready) return;
    const w = v.videoWidth || 640;
    const h = v.videoHeight || 480;
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    // Mirror the horizontal axis so the saved photo matches what the user saw in the preview
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, w, h);
    const url = c.toDataURL("image/jpeg", 0.7);
    setPreview(url);
  };

  const retake = () => setPreview("");

  const confirm = () => {
    if (!preview) return;
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    onCapture(preview);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="camera-modal" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-md surface" style={{ background: "#121212" }}>
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="label-uppercase">CHECK-IN CAPTURE</div>
            <div className="text-sm text-gray-400 mt-0.5">{subtitle || "Snap your face to confirm you're on-site."}</div>
          </div>
          <button onClick={onCancel} className="text-gray-500 hover:text-white transition-colors" data-testid="camera-close"><X size={16} /></button>
        </div>
        <div className="p-4">
          <div className="relative bg-black" style={{ aspectRatio: "4 / 3" }}>
            {!preview && (
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                style={{ transform: "scaleX(-1)" }}
                playsInline
                muted
                data-testid="camera-video"
              />
            )}
            {preview && (
              <img src={preview} alt="preview" className="w-full h-full object-cover" data-testid="camera-preview" />
            )}
            <canvas ref={canvasRef} className="hidden" />
            {!ready && !preview && !error && (
              <div className="absolute inset-0 grid place-items-center text-gray-400 mono text-xs uppercase tracking-widest">STARTING CAMERA…</div>
            )}
            {error && (
              <div className="absolute inset-0 grid place-items-center p-4 text-center text-red-400 mono text-xs" data-testid="camera-error">
                <div>
                  <div className="uppercase tracking-widest mb-2">CAMERA UNAVAILABLE</div>
                  <div className="text-red-300">{error}</div>
                </div>
              </div>
            )}
            {/* Ops-console overlay */}
            <div className="pointer-events-none absolute inset-0 border border-green-500/30" />
            <div className="pointer-events-none absolute top-2 left-2 label-uppercase text-green-400" style={{ letterSpacing: "0.24em" }}>REC · LIVE</div>
          </div>

          <div className="mt-4 flex gap-2">
            {!preview && (
              <button
                onClick={snap}
                disabled={!ready}
                data-testid="camera-snap"
                className="flex-1 bg-white text-black hover:bg-gray-200 disabled:opacity-50 font-medium py-2.5 text-sm inline-flex items-center justify-center gap-2 transition-colors"
              >
                <Camera size={14} /> Snap face
              </button>
            )}
            {preview && (
              <>
                <button onClick={retake} data-testid="camera-retake" className="flex-1 border border-white/10 hover:border-white/30 px-3 py-2.5 text-sm inline-flex items-center justify-center gap-2 transition-colors">
                  <RefreshCw size={14} /> Retake
                </button>
                <button onClick={confirm} data-testid="camera-confirm" className="flex-1 bg-green-500 text-black hover:bg-green-400 font-medium py-2.5 text-sm inline-flex items-center justify-center gap-2 transition-colors">
                  <Check size={14} /> Confirm & start
                </button>
              </>
            )}
          </div>
          <div className="mt-3 text-[10px] mono uppercase tracking-widest text-gray-600">PHOTO IS UPLOADED WITH YOUR GPS FIX · ADMINS SEE IT ON THE LIVE MAP</div>
        </div>
      </div>
    </div>
  );
}
