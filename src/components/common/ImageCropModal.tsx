import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Move, ZoomIn, ZoomOut } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ImageCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageFile: File;
  onSave: (croppedImageData: string) => void;
}

const CANVAS_SIZE = 200; // Output size
const PREVIEW_SIZE = 280; // Preview circle size

export function ImageCropModal({ isOpen, onClose, imageFile, onSave }: ImageCropModalProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load image when file changes
  useEffect(() => {
    if (!imageFile) return;

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    img.onload = () => {
      setImage(img);
      // Calculate initial scale to fit image in preview
      const minDimension = Math.min(img.width, img.height);
      const initialScale = PREVIEW_SIZE / minDimension;
      setScale(Math.max(initialScale, 0.5));
      setPosition({ x: 0, y: 0 });
    };

    reader.readAsDataURL(imageFile);
  }, [imageFile]);

  // Calculate bounds to keep image covering the circle
  const getBounds = useCallback(() => {
    if (!image) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };

    const scaledWidth = image.width * scale;
    const scaledHeight = image.height * scale;

    const maxOffsetX = Math.max(0, (scaledWidth - PREVIEW_SIZE) / 2);
    const maxOffsetY = Math.max(0, (scaledHeight - PREVIEW_SIZE) / 2);

    return {
      minX: -maxOffsetX,
      maxX: maxOffsetX,
      minY: -maxOffsetY,
      maxY: maxOffsetY,
    };
  }, [image, scale]);

  // Clamp position within bounds
  const clampPosition = useCallback((pos: { x: number; y: number }) => {
    const bounds = getBounds();
    return {
      x: Math.max(bounds.minX, Math.min(bounds.maxX, pos.x)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, pos.y)),
    };
  }, [getBounds]);

  // Handle mouse/touch events for dragging
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    setDragStart({
      x: clientX - position.x,
      y: clientY - position.y,
    });
  };

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const newPosition = {
      x: clientX - dragStart.x,
      y: clientY - dragStart.y,
    };

    setPosition(clampPosition(newPosition));
  }, [isDragging, dragStart, clampPosition]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add/remove global event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Handle scale change and re-clamp position
  const handleScaleChange = (newScale: number) => {
    setScale(newScale);
    // Re-clamp position after scale change (will be done on next render)
    setTimeout(() => {
      setPosition(prev => clampPosition(prev));
    }, 0);
  };

  // Calculate minimum scale to cover the preview circle
  const getMinScale = () => {
    if (!image) return 0.5;
    const minDimension = Math.min(image.width, image.height);
    return PREVIEW_SIZE / minDimension;
  };

  // Save cropped image
  const handleSave = async () => {
    if (!image || !canvasRef.current) return;

    setIsSaving(true);

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;

      // Calculate source coordinates
      const scaledWidth = image.width * scale;
      const scaledHeight = image.height * scale;

      // Center of the preview area in scaled image coordinates
      const centerX = (scaledWidth / 2) - position.x;
      const centerY = (scaledHeight / 2) - position.y;

      // Convert to original image coordinates
      const srcCenterX = centerX / scale;
      const srcCenterY = centerY / scale;
      const srcSize = PREVIEW_SIZE / scale;

      const srcX = srcCenterX - srcSize / 2;
      const srcY = srcCenterY - srcSize / 2;

      // Draw cropped region to canvas
      ctx.drawImage(
        image,
        srcX, srcY, srcSize, srcSize,
        0, 0, CANVAS_SIZE, CANVAS_SIZE
      );

      // Convert to JPEG data URL
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      onSave(dataUrl);
    } finally {
      setIsSaving(false);
    }
  };

  const minScale = getMinScale();
  const maxScale = Math.max(minScale * 3, 2);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajustar Foto" size="md">
      <div className="space-y-4">
        {/* Preview area */}
        <div className="flex justify-center">
          <div
            ref={containerRef}
            className="relative overflow-hidden bg-gray-900 rounded-lg"
            style={{ width: PREVIEW_SIZE + 40, height: PREVIEW_SIZE + 40 }}
          >
            {/* Darkened overlay with circular cutout */}
            <div className="absolute inset-0 pointer-events-none z-10">
              <svg width="100%" height="100%" className="absolute inset-0">
                <defs>
                  <mask id="circleMask">
                    <rect width="100%" height="100%" fill="white" />
                    <circle
                      cx="50%"
                      cy="50%"
                      r={PREVIEW_SIZE / 2}
                      fill="black"
                    />
                  </mask>
                </defs>
                <rect
                  width="100%"
                  height="100%"
                  fill="rgba(0,0,0,0.6)"
                  mask="url(#circleMask)"
                />
                <circle
                  cx="50%"
                  cy="50%"
                  r={PREVIEW_SIZE / 2}
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                />
              </svg>
            </div>

            {/* Draggable image */}
            {image && (
              <div
                className={`absolute cursor-move select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{
                  left: '50%',
                  top: '50%',
                  transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`,
                }}
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
              >
                <img
                  src={image.src}
                  alt="Preview"
                  draggable={false}
                  style={{
                    width: image.width * scale,
                    height: image.height * scale,
                    maxWidth: 'none',
                  }}
                />
              </div>
            )}

            {/* Drag hint */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 pointer-events-none">
              <Move className="w-3 h-3" />
              Arrastra para mover
            </div>
          </div>
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3 px-4">
          <ZoomOut className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            type="range"
            min={minScale}
            max={maxScale}
            step={0.01}
            value={scale}
            onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
          <ZoomIn className="w-5 h-5 text-gray-400 flex-shrink-0" />
        </div>

        {/* Hidden canvas for cropping */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} isLoading={isSaving}>
            Guardar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
