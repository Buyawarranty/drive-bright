import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { removeBackground, loadImage } from '@/utils/backgroundRemoval';
import pandaCarWarranty from "@/assets/panda-car-warranty-transparent.png";

const BackgroundRemovalProcessor: React.FC = () => {
  const [processing, setProcessing] = useState(false);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processImage = async () => {
    setProcessing(true);
    setError(null);
    
    try {
      // Fetch the original image
      const response = await fetch(pandaCarWarranty);
      const blob = await response.blob();
      
      // Load as HTMLImageElement
      const img = await loadImage(blob);
      
      // Remove background
      const processedBlob = await removeBackground(img);
      
      // Create URL for the processed image
      const url = URL.createObjectURL(processedBlob);
      setProcessedImageUrl(url);
      
      // Automatically download the processed image
      const link = document.createElement('a');
      link.href = url;
      link.download = 'panda-car-warranty-no-bg.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (err) {
      console.error('Error processing image:', err);
      setError(err instanceof Error ? err.message : 'Failed to process image');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 bg-white p-4 rounded-lg shadow-lg border">
      <h3 className="text-sm font-semibold mb-2">Background Removal Tool</h3>
      <Button 
        onClick={processImage} 
        disabled={processing}
        size="sm"
        className="mb-2"
      >
        {processing ? 'Processing...' : 'Remove Background'}
      </Button>
      
      {error && (
        <p className="text-red-500 text-xs mb-2">{error}</p>
      )}
      
      {processedImageUrl && (
        <div className="mt-2">
          <p className="text-green-500 text-xs mb-2">Background removed! Image downloaded.</p>
          <img 
            src={processedImageUrl} 
            alt="Processed" 
            className="w-20 h-20 object-contain border rounded"
          />
        </div>
      )}
    </div>
  );
};

export default BackgroundRemovalProcessor;