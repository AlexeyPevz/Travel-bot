import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

interface PrioritySliderProps {
  label: string;
  icon: string;
  value: number;
  onChange: (value: number) => void;
  description?: string;
}

export default function PrioritySlider({ 
  label, 
  icon, 
  value, 
  onChange, 
  description 
}: PrioritySliderProps) {
  const getColorClass = (val: number) => {
    if (val <= 3) return 'text-gray-500';
    if (val <= 6) return 'text-yellow-500';
    if (val <= 8) return 'text-orange-500';
    return 'text-red-500';
  };

  const getImportanceText = (val: number) => {
    if (val === 0) return 'Не важно';
    if (val <= 3) return 'Почти не важно';
    if (val <= 5) return 'Умеренно важно';
    if (val <= 7) return 'Важно';
    if (val <= 9) return 'Очень важно';
    return 'Критически важно';
  };

  return (
    <div className="space-y-2 p-4 bg-white rounded-lg border border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <Label className="text-base font-medium">{label}</Label>
        </div>
        <div className="text-right">
          <span className={`text-2xl font-bold ${getColorClass(value)}`}>
            {value}
          </span>
          <p className="text-xs text-gray-500">{getImportanceText(value)}</p>
        </div>
      </div>
      
      {description && (
        <p className="text-sm text-gray-600">{description}</p>
      )}
      
      <Slider
        value={[value]}
        onValueChange={([newValue]) => onChange(newValue)}
        max={10}
        min={0}
        step={1}
        className="w-full"
      />
      
      <div className="flex justify-between text-xs text-gray-400">
        <span>0</span>
        <span>5</span>
        <span>10</span>
      </div>
    </div>
  );
}