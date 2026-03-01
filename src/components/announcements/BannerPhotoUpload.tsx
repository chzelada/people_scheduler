import { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { BannerCropModal } from './BannerCropModal';

interface BannerPhotoUploadProps {
  value?: string | null;
  onChange: (dataUri: string | null) => void;
}

export function BannerPhotoUpload({ value, onChange }: BannerPhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setCropFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropSave = (dataUri: string) => {
    onChange(dataUri);
    setCropFile(null);
  };

  return (
    <>
      {value ? (
        <div className="relative">
          <img
            src={value}
            alt="Banner"
            className="w-full h-40 object-cover rounded-lg"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 p-1 bg-white/90 rounded-full hover:bg-white shadow transition-colors"
            title="Quitar imagen"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-primary-400 bg-primary-50'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50'
          }`}
        >
          <ImagePlus className="w-8 h-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">Arrastra o haz clic para subir imagen de portada</p>
          <p className="text-xs text-gray-400 mt-1">Opcional - Podrás ajustar la posición</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleChange}
          />
        </div>
      )}

      {cropFile && (
        <BannerCropModal
          isOpen={true}
          onClose={() => setCropFile(null)}
          imageFile={cropFile}
          onSave={handleCropSave}
        />
      )}
    </>
  );
}
