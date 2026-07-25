import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface CameraCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
  t: (id: string, en: string) => string;
}

export function CameraCapture({ open, onOpenChange, onCapture, t }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
      setCapturedImage(null);
    }
    
    return () => {
      stopCamera();
    };
  }, [open, facingMode]);

  const startCamera = async () => {
    try {
      // Stop existing stream first
      stopCamera();
      
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsStreaming(true);
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast.error(t(
        "Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.",
        "Cannot access camera. Please ensure camera permission is granted."
      ));
      onOpenChange(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    const context = canvas.getContext("2d");
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to data URL
      const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setCapturedImage(imageDataUrl);
      
      // Stop camera stream after capture
      stopCamera();
    }
  };

  const retake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const confirmCapture = () => {
    if (!capturedImage) return;

    // Convert data URL to File
    fetch(capturedImage)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
        onOpenChange(false);
        setCapturedImage(null);
      })
      .catch(error => {
        console.error("Error converting image:", error);
        toast.error(t("Gagal memproses foto", "Failed to process photo"));
      });
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center justify-between">
            <span>{t("Ambil Foto", "Take Photo")}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="relative bg-black aspect-[4/3] flex items-center justify-center overflow-hidden">
          {!capturedImage ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
            </>
          ) : (
            <img
              src={capturedImage}
              alt="Captured"
              className="w-full h-full object-contain"
            />
          )}
        </div>

        <div className="p-4 flex justify-center gap-4">
          {!capturedImage ? (
            <>
              <Button
                variant="outline"
                onClick={switchCamera}
                disabled={!isStreaming}
                className="rounded-full"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {t("Putar Kamera", "Switch Camera")}
              </Button>
              <Button
                onClick={capturePhoto}
                disabled={!isStreaming}
                size="lg"
                className="rounded-full bg-primary hover:bg-primary/90"
              >
                <Camera className="h-5 w-5 mr-2" />
                {t("Ambil Foto", "Capture")}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={retake}
                className="rounded-full"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {t("Ambil Ulang", "Retake")}
              </Button>
              <Button
                onClick={confirmCapture}
                size="lg"
                className="rounded-full bg-primary hover:bg-primary/90"
              >
                {t("Gunakan Foto", "Use Photo")}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
