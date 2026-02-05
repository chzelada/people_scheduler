import React, { useRef, useState } from 'react';
import { Camera, Trash2, Upload } from 'lucide-react';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { ImageCropModal } from './ImageCropModal';

interface PhotoUploadProps {
  photoUrl?: string | null;
  firstName: string;
  lastName: string;
  onUpload: (photoData: string) => Promise<void>;
  onDelete: () => Promise<void>;
  disabled?: boolean;
}

export function PhotoUpload({
  photoUrl,
  firstName,
  lastName,
  onUpload,
  onDelete,
  disabled = false,
}: PhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona un archivo de imagen');
      return;
    }

    // Validate file size (max 10MB for processing)
    if (file.size > 10 * 1024 * 1024) {
      setError('La imagen es muy grande. Máximo 10MB.');
      return;
    }

    setError(null);
    setSelectedFile(file);
    setIsCropModalOpen(true);

    // Reset input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropSave = async (croppedImageData: string) => {
    setIsLoading(true);
    setIsCropModalOpen(false);
    setSelectedFile(null);

    try {
      await onUpload(croppedImageData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir la imagen');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCropCancel = () => {
    setIsCropModalOpen(false);
    setSelectedFile(null);
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Eliminar la foto de perfil?')) return;

    setError(null);
    setIsLoading(true);

    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar la foto');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center space-x-4">
        <div className="relative">
          <Avatar
            photoUrl={photoUrl}
            firstName={firstName}
            lastName={lastName}
            size="xl"
          />
          {isLoading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        <div className="flex flex-col space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled || isLoading}
          />

          <div className="flex space-x-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isLoading}
            >
              {photoUrl ? (
                <>
                  <Camera className="w-4 h-4 mr-1" />
                  Cambiar
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-1" />
                  Subir Foto
                </>
              )}
            </Button>

            {photoUrl && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleDelete}
                disabled={disabled || isLoading}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-gray-500">JPG, PNG o WebP.</p>
        </div>
      </div>

      {/* Image Crop Modal */}
      {selectedFile && (
        <ImageCropModal
          isOpen={isCropModalOpen}
          onClose={handleCropCancel}
          imageFile={selectedFile}
          onSave={handleCropSave}
        />
      )}
    </>
  );
}
