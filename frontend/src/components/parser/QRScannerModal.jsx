import { useState, useEffect, useRef } from 'react';
import { Modal, Button } from '../ui';
import { Camera, X, Flashlight, SwitchCamera, Loader2 } from 'lucide-react';

export const QRScannerModal = ({ isOpen, onClose, onScan }) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [hasCamera, setHasCamera] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [Html5Qrcode, setHtml5Qrcode] = useState(null);
  
  const scannerRef = useRef(null);
  const videoRef = useRef(null);
  
  // Load html5-qrcode dynamically
  useEffect(() => {
    if (isOpen) {
      loadScanner();
      return () => {
        stopScanner();
      };
    }
  }, [isOpen]);
  
  const loadScanner = async () => {
    try {
      const module = await import('html5-qrcode');
      setHtml5Qrcode(() => module.Html5Qrcode);
      
      // Get available cameras
      const devices = await module.Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameras(devices);
        // Prefer back camera
        const backCamera = devices.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('utama')
        );
        setSelectedCamera(backCamera ? backCamera.id : devices[0].id);
        setHasCamera(true);
      } else {
        setHasCamera(false);
        setError('Tidak ada kamera yang ditemukan');
      }
    } catch (err) {
      console.error('Failed to load QR scanner:', err);
      setError('Gagal memuat scanner QR');
    }
  };
  
  const startScanner = async () => {
    if (!Html5Qrcode || !selectedCamera) return;
    
    setError('');
    setScanning(true);
    
    try {
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
    } catch (err) {
      console.error('Failed to start scanner:', err);
      setError('Gagal memulai kamera: ' + err.message);
      setScanning(false);
    }
  };
  
  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error('Failed to stop scanner:', err);
      }
    }
    setScanning(false);
  };
  
  const onScanSuccess = (decodedText, decodedResult) => {
    console.log('QR Scanned:', decodedText);
    
    // Stop scanner first
    stopScanner();
    
    // Send scanned data to parent
    onScan(decodedText);
    handleClose();
  };
  
  const onScanFailure = (error) => {
    // Silently ignore scan failures (normal when no QR in frame)
  };
  
  const handleClose = () => {
    stopScanner();
    setScanning(false);
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
    
    // Start with new camera
    setTimeout(() => startScanner(), 500);
  };
  
  // Start scanner when camera is selected
  useEffect(() => {
    if (Html5Qrcode && selectedCamera && isOpen) {
      startScanner();
    }
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
                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />
                
                {/* Scanning line animation */}
                <div className="absolute left-4 right-4 h-0.5 bg-blue-500 animate-pulse top-0"
                  style={{
                    animation: 'scanline 2s ease-in-out infinite',
                  }}
                />
              </div>
            </div>
          )}
          
          {/* Loading state */}
          {!scanning && !error && (
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
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
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
        <div className="flex justify-end">
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
