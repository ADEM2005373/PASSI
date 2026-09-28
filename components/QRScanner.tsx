'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  isActive: boolean; // Add isActive prop to control visibility
}

export default function QRScanner({ onScanSuccess, isActive }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [hasCamera, setHasCamera] = useState(true);

  const onScanSuccessRef = useRef(onScanSuccess);
  
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    let isMounted = true;

    if (isActive) {
      html5QrCode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5QrCode;
      
      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (isMounted) onScanSuccessRef.current(decodedText);
        },
        () => {
          // ignore parse errors
        }
      ).catch((err) => {
        if (isMounted) {
          console.error("Error starting scanner", err);
          setHasCamera(false);
        }
      });
    }

    return () => {
      isMounted = false;
      if (html5QrCode) {
        if (html5QrCode.isScanning) {
          html5QrCode.stop().then(() => {
            html5QrCode?.clear();
          }).catch(console.error);
        } else {
          html5QrCode.clear();
        }
        // Force clear any leftover DOM elements added by html5-qrcode
        setTimeout(() => {
          const reader = document.getElementById("qr-reader");
          if (reader) reader.innerHTML = '';
        }, 100);
      }
    };
  }, [isActive]);

  if (!hasCamera) {
    return (
      <div className="text-red-500 p-4 flex flex-col items-center justify-center space-y-4">
        <p className="font-bold text-center">Accès à la caméra refusé ou introuvable.</p>
        <p className="text-sm text-center">Veuillez autoriser l'accès à la caméra dans les paramètres de votre navigateur, puis réessayez.</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-passi-bleu text-white px-6 py-3 rounded-xl font-bold"
        >
          Réessayer
        </button>
      </div>
    );
  }

  // Keep it mounted but visually hidden when inactive
  return (
    <div 
      id="qr-reader" 
      style={{ 
        width: '100%', 
        maxWidth: '500px', 
        margin: '0 auto', 
        display: isActive ? 'block' : 'none' 
      }} 
    />
  );
}
