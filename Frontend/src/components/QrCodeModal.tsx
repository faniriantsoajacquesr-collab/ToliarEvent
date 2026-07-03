interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string | null;
}

export default function QrCodeModal({ isOpen, onClose, ticketId }: QrCodeModalProps) {
  if (!isOpen || !ticketId) return null;

  // Construct the URL that the QR code will point to
  const qrCodeValue = `${window.location.origin}/ticket/${ticketId}`; // Use full ticketId

  // Use a public QR image generator to avoid adding a frontend QR dependency
  const qrImageSrc = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrCodeValue)}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl text-center">
        <h3 className="font-bold text-lg mb-4">QR Code du billet {ticketId}</h3>
        <div className="flex justify-center mb-6">
          <img src={qrImageSrc} alt="QR Code" width={256} height={256} />
        </div>
        <p className="text-sm text-gray-600 mb-6">Scannez ce code pour vérifier la validité du billet.</p>
        <button onClick={onClose} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark">Fermer</button>
      </div>
    </div>
  );
}