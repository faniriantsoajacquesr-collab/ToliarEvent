import React, { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId?: string; // Requis pour le mode "display"
  ticketStatus?: string; // Optionnel : pour afficher l'état actuel (vendu, réservé...)
  mode?: 'display' | 'scan'; // Permet de choisir le comportement
  onScanSuccess?: (scannedId: string) => void; // Callback quand un QR code est détecté
}

export const QrCodeModalScan: React.FC<QrCodeModalProps> = ({
  isOpen,
  onClose,
  ticketId,
  ticketStatus,
  mode = 'display',
  onScanSuccess,
}) => {
  
  // Effet pour initialiser le scanner d'appareil photo si le mode est "scan"
  useEffect(() => {
    if (!isOpen || mode !== 'scan') return;

    // Configuration du scanner de caméra
    const scanner = new Html5QrcodeScanner(
      'qr-reader-container',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scanner.render(
      (decodedText) => {
        // En cas de succès, on renvoie l'ID scanné au composant parent
        if (onScanSuccess) {
          onScanSuccess(decodedText);
        }
        scanner.clear(); // Arrête la caméra après détection
        onClose(); // Ferme la modale
      },
      () => {
        // Erreur de lecture continue (silencieux pour éviter de spammer la console)
      }
    );

    // Nettoyage de la caméra à la fermeture de la modale
    return () => {
      scanner.clear().catch((error) => console.error("Erreur nettoyage scanner:", error));
    };
  }, [isOpen, mode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
      {/* Conteneur de la Modale */}
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-gray-100 transform transition-all">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="text-lg font-bold text-gray-900">
            {mode === 'display' ? 'Ticket QR Code' : 'Scanner un Billet'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-200"
          >
            ✕
          </button>
        </div>

        {/* Contenu */}
        <div className="p-6 flex flex-col items-center justify-center min-h-[300px]">
          {mode === 'display' && ticketId ? (
            /* --- MODE AFFICHAGE DU QR CODE --- */
            <div className="text-center space-y-4">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 inline-block shadow-inner">
                <QRCodeSVG 
                  value={ticketId} 
                  size={200}
                  bgColor="#FFFFFF"
                  fgColor="#1F2937"
                  level="H"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-400 font-mono select-all">ID: {ticketId}</p>
                {ticketStatus && (
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                    ticketStatus === 'vendu' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {ticketStatus}
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* --- MODE SCANNER VIA CAMÉRA --- */
            <div className="w-full text-center">
              <p className="text-sm text-gray-500 mb-4">
                Placez le QR Code du billet devant votre caméra pour le valider instantanément.
              </p>
              <div 
                id="qr-reader-container" 
                className="overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 flex justify-end border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors text-sm"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};