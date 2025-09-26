import React from 'react';

interface PingoRingProps {
  isHolding: boolean;
  showWhenNotHolding: boolean;
}

function PingoRing({ isHolding, showWhenNotHolding }: PingoRingProps) {
  if (!showWhenNotHolding && !isHolding) {
    return null;
  }

  return (
    <div className={`w-32 h-32 rounded-full transition-colors duration-300 ${
      isHolding ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
    }`}>
      {isHolding && (
        <div className="relative w-full h-full animate-spin">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white"></div>
        </div>
      )}
    </div>
  );
}

export { PingoRing };
export default PingoRing;
