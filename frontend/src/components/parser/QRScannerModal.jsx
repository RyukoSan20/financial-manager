import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Button } from '../ui';
import { Camera, X, Flashlight, SwitchCamera, Loader2, AlertTriangle } from 'lucide-react';

export const QRScannerModal = ({ isOpen, onClose, onScan }) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [hasCamera, setHasCamera] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [Html5Qrcode, setHtml5Qrcode] = useState(null);
  const [loading, setLoading] = useState(false);

  const scannerRef = useRef(null);
  // Guards against calling stop() on a scanner that is not running.
  // html5-qrcode throws "Cannot stop, scanner is not running or paused."
  // when stop() is called twice, and that unhandled rejection blanked the
  // whole page.
  const isScanningRef = useRef(false);
  const stoppingRef = useRef(false);
  const videoRef = useRef(null);

  // Load html5-qrcode dynamically
  useEffect(() => {
    if (isOpen) {
      loadScanner();
    }
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadScanner = async () => {
    try {
      setLoading(true);
      const module = await import('html5-qrcode');
      setHtml5Qrcode(() => module.Html5Qrcode);

      // Get available cameras
      const devices = await module.Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameras(devices);
        // Prefer back camera
        const backCamera = devices.find(d =>
          (d.label || '').toLowerCase().includes('back') ||
          (d.label || '').toLowerCase().includes('rear') ||
          (d.label || '').toLowerCase().includes('utama')
        );
        setSelectedCamera(backCamera ? backCamera.id : devices[0].id);
        setHasCamera(true);
        setError('');
      } else {
        setHasCamera(false);
        setError('Tidak ada kamera yang ditemukan');
      }
    } catch (err) {
      console.error('Failed to load QR scanner:', err);
      setHasCamera(false);
      setError('Gagal memuat scanner QR: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  // Stop the scanner defensively. Never lets an error escape: a rejected
  // stop() used to bubble up and blank the page.
  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;

    if (!scanner) {
      isScanningRef.current = false;
      setScanning(false);
      return;
    }
    if (stoppingRef.current) {
      return;
    }
    stoppingRef.current = true;

    try {
      // Only stop when actually running, otherwise html5-qrcode throws
      // "Cannot stop, scanner is not running or paused."
      if (isScanningRef.current) {
        await scanner.stop();
      }
    } catch (err) {
      // Already stopped / no stream - harmless.
      console.warn('Scanner stop warning:', err?.message || err);
    } finally {
      isScanningRef.current = false;
      stoppingRef.current = false;
      setScanning(false);
      // Release the camera so the browser indicator turns off.
      try {
        scanner.clear?.();
      } catch (_) {
        /* ignore */
      }
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (!Html5Qrcode || !selectedCamera) return;

    setError('');
    setLoading(true);

    try {
      // Clear any previous instance before creating a new one.
      if (scannerRef.current) {
        try { await scannerRef.current.clear?.(); } catch (_) { /* ignore */ }
        scannerRef.current = null;
      }

      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false,
      };

      await scanner.start(
        selectedCamera,
        config,
        onScanSuccess,
        onScanFailure
      );
      isScanningRef.current = true;
      setScanning(true);
    } catch (err) {
      console.error('Failed to start scanner:', err);
      isScanningRef.current = false;
      setScanning(false);
      const msg = String(err?.message || err);
      if (msg.includes('Permission') || msg.includes('permission')) {
        setError('Izin kamera ditolak. Izinkan akses kamera di pengaturan browser lalu coba lagi.');
      } else if (msg.includes('NotFoundError') || msg.includes('no camera')) {
        setHasCamera(false);
        setError('Kamera tidak ditemukan pada perangkat ini.');
      } else {
        setError('Gagal memulai kamera: ' + msg);
      }
    } finally {
      setLoading(false);
    }
  }, [Html5Qrcode, selectedCamera]);

  const onScanSuccess = useCallback((decodedText) => {
    console.log('QR Scanned:', decodedText);

    // Stop first so the camera light turns off, then report. The stop is
    // fire-and-forget but fully guarded internally.
    stopScanner();
    onScan(decodedText);
    onClose();
  }, [onScan, onClose, stopScanner]);

  const onScanFailure = () => {
    // Silently ignore scan failures (normal when no QR in frame)
  };

  const handleClose = () => {
    stopScanner();
    setError('');
    onClose();
  };

  const toggleTorch = async () => {
    if (!scannerRef.current) return;

    try {
      const track = scannerRef.current.getRunningTrackCameraCapabilities();
      if (track.torchFeature().isSupported()) {
        await track.torchFeature().apply(!torchOn);
        setTorchOn(!torchOn);
      } else {
        setError('Flash tidak tersedia di kamera ini');
      }
    } catch (err) {
      console.error('Torch error:', err);
    }
  };

  const switchCamera = async () => {
    if (cameras.length < 2) return;

    await stopScanner();

    const currentIndex = cameras.findIndex(c => c.id === selectedCamera);
    const nextIndex = (currentIndex + 1) % cameras.length;
    setSelectedCamera(cameras[nextIndex].id);
  };

  // Start scanner when camera is selected. The effect depends on
  // selectedCamera only; startScanner is invoked explicitly after the
  // camera switch so the previous instance is fully stopped first.
  useEffect(() => {
    if (!isOpen) return;
    if (Html5Qrcode && selectedCamera && !isScanningRef.current) {
      startScanner();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Html5Qrcode, selectedCamera, isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Scan QR Code"
      size="md"
    >
      <div className="space-y-4">
        {/* Camera selector */}
        {cameras.length > 1 && (
          <div className="flex gap-2">
            <select
              value={selectedCamera || ''}
              onChange={(e) => setSelectedCamera(e.target.value)}
              className="flex-1 p-2 border rounded-lg"
            >
              {cameras.map(cam => (
                <option key={cam.id} value={cam.id}>
                  {cam.label || `Camera ${cameras.indexOf(cam) + 1}`}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              size="sm"
              onClick={switchCamera}
              disabled={!scanning}
            >
              <SwitchCamera className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* QR Scanner container */}
        <div className="relative bg-black rounded-xl overflow-hidden">
          {/* Scanner view */}
          <div
            id="qr-reader"
            className="w-full"
            style={{ minHeight: '300px' }}
          />

          {/* Scanning overlay */}
          {scanning && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Corner markers */}
              <div className="relative w-64 h-64">
                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-primary-500 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-primary-500 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-primary-500 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-primary-500 rounded-br-lg" />

                {/* Scanning line animation */}
                <div className="absolute left-4 right-4 h-0.5 bg-primary-500 animate-pulse top-0"
                  style={{
                    animation: 'scanline 2s ease-in-out infinite',
                  }}
                />
              </div>
            </div>
          )}

          {/* Loading state */}
          {!scanning && !error && loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white">
              <Loader2 className="w-10 h-10 animate-spin mb-2" />
              <p>Memuat kamera...</p>
            </div>
          )}

          {/* Torch button */}
          {scanning && (
            <button
              onClick={toggleTorch}
              className={`absolute top-4 right-4 p-2 rounded-full ${
                torchOn ? 'bg-yellow-500' : 'bg-black/50'
              } text-white`}
            >
              <Flashlight className={`w-5 h-5 ${torchOn ? 'text-yellow-300' : ''}`} />
            </button>
          )}
        </div>

        {/* Status message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!error && !hasCamera && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm">
              Kamera tidak tersedia. Pastikan browser memiliki akses ke kamera atau gunakan Parse SMS sebagai alternatif.
            </p>
          </div>
        )}

        {/* Instructions */}
        {scanning && (
          <div className="text-center text-sm text-gray-500">
            <p>Arahkan QR Code ke kotak pemindaian</p>
          </div>
        )}

        {/* Close button */}
        <div className="flex justify-end gap-2">
          {scanning && (
            <Button variant="outline" onClick={() => stopScanner()}>
              <X className="w-4 h-4 mr-2" />
              Hentikan Kamera
            </Button>
          )}
          <Button variant="secondary" onClick={handleClose}>
            Batal
          </Button>
        </div>
      </div>

      {/* Scan line animation */}
      <style>{`
        @keyframes scanline {
          0% { top: 0; }
          50% { top: calc(100% - 4px); }
          100% { top: 0; }
        }

        #qr-reader video {
          width: 100% !important;
          border-radius: 12px;
        }

        #qr-reader img[alt="Info icon"] {
          display: none !important;
        }

        #qr-reader > div:last-child {
          display: none !important;
        }
      `}</style>
    </Modal>
  );
};

export default QRScannerModal;
