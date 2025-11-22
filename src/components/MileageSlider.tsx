import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
// Using the panda head image from public uploads
const pandaHead = "/lovable-uploads/adc6403c-4ce7-46d3-8cbc-4bfff1125e1a.png";

interface MileageSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

const MileageSlider: React.FC<MileageSliderProps> = ({ 
  value, 
  onChange, 
  min = 0, 
  max = 150000 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  
  const formatMileage = (miles: number) => {
    return miles.toLocaleString();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    updateValue(e.clientX);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      updateValue(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    updateValue(e.touches[0].clientX);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (isDragging) {
      e.preventDefault();
      updateValue(e.touches[0].clientX);
    }
  };

  const updateValue = (clientX: number) => {
    if (!sliderRef.current) return;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newValue = Math.round(min + percentage * (max - min));
    
    // Round to nearest 1000 for smoother experience
    const roundedValue = Math.round(newValue / 1000) * 1000;
    onChange(Math.max(min, Math.min(max, roundedValue)));
  };

  const handleSliderClick = (e: React.MouseEvent) => {
    if (!isDragging) {
      updateValue(e.clientX);
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleMouseUp);
      };
    }
  }, [isDragging]);

  const percentage = ((value - min) / (max - min)) * 100;
  // Constrain panda position to stay within visible area (5% to 95%)
  const pandaPosition = Math.max(5, Math.min(95, percentage));

  return (
    <div className="w-full max-w-xs py-2">
      {/* Slider Track */}
      <div 
        ref={sliderRef}
        className="relative h-6 bg-white rounded-lg cursor-pointer border-2 border-primary/25 w-full"
        onClick={handleSliderClick}
      >
        {/* Selected Area (Brand Orange) */}
        <div 
          className="absolute top-0 left-0 h-full bg-primary rounded-lg transition-all duration-150"
          style={{ width: `${percentage}%` }}
        />
        
        {/* Panda Head Handle */}
        <div
          className={`absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 cursor-grab ${
            isDragging ? 'cursor-grabbing scale-110' : ''
          } transition-all duration-150 ease-out`}
          style={{ left: `${pandaPosition}%` }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <img 
            src={pandaHead} 
            alt="Panda slider handle" 
            className={`w-12 h-12 object-contain ${
              isDragging ? 'drop-shadow-lg' : 'hover:drop-shadow-md'
            } transition-all duration-150`}
            draggable={false}
          />
          
          {/* Static Light Grey Arrow next to panda head */}
          {!isDragging && percentage < 15 && (
            <div className="absolute top-1/2 left-full transform -translate-y-1/2 ml-1">
              <ArrowRight className="w-6 h-6 text-gray-300 drop-shadow-sm" />
            </div>
          )}
        </div>
      </div>

      {/* Instructional Text */}
      <div className="text-left text-sm text-muted-foreground mt-2">
        Slide the panda or click on the slider to set mileage
      </div>

      {/* Validation Message */}
      {value > 150000 && (
        <div className="text-center text-sm text-blue-600 font-medium mt-2">
          Sorry, we can only provide coverage for vehicles with up to 150,000 miles
        </div>
      )}
    </div>
  );
};

export default MileageSlider;