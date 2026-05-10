import React, { useState, useEffect, useRef } from 'react';

const Fader = ({ label, value, onChange, min = 0, max = 1, step = 0.01, isMaster = false }) => {
  const [internalValue, setInternalValue] = useState(value);
  const isDragging = useRef(false);

  useEffect(() => {
    if (!isDragging.current) {
      setInternalValue(value);
    }
  }, [value]);

  const handleInput = (e) => {
    const newVal = parseFloat(e.target.value);
    setInternalValue(newVal);
    onChange(newVal);
  };

  const percentage = ((internalValue - min) / (max - min)) * 100;

  return (
    <div className={`flex flex-col items-center gap-4 ${isMaster ? 'w-24' : 'w-16'}`}>
      <div className="relative h-64 w-full flex justify-center group">
        {/* Track Background */}
        <div className="absolute inset-y-0 w-2 bg-black/40 rounded-full border border-white/5 shadow-inner"></div>
        
        {/* Active Track (Gradient) */}
        <div 
          className="absolute bottom-0 w-2 bg-gradient-to-t from-brand-primary/80 to-brand-primary rounded-full shadow-[0_0_10px_rgba(var(--color-brand-primary),0.3)] transition-all duration-75"
          style={{ height: `${percentage}%` }}
        ></div>

        {/* Graduation Marks */}
        <div className="absolute inset-y-0 left-full ml-2 flex flex-col justify-between py-1 opacity-20 group-hover:opacity-40 transition-opacity">
          {[0, 25, 50, 75, 100].map(m => (
            <div key={m} className="flex items-center gap-1">
              <div className="w-2 h-px bg-white"></div>
              <span className="text-[8px] font-mono leading-none">{100 - m}</span>
            </div>
          ))}
        </div>

        {/* Hidden Input for interaction */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={internalValue}
          onChange={handleInput}
          onMouseDown={() => { isDragging.current = true; }}
          onMouseUp={() => { isDragging.current = false; }}
          onTouchStart={() => { isDragging.current = true; }}
          onTouchEnd={() => { isDragging.current = false; }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 -rotate-180 [writing-mode:bt-lr]"
          style={{ appearance: 'slider-vertical' }}
        />

        {/* Custom Thumb (Knob) */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 w-10 h-14 bg-gradient-to-b from-[#333] to-[#111] rounded-lg border border-white/10 shadow-2xl flex flex-col items-center justify-center pointer-events-none z-20 group-hover:border-brand-primary/40 transition-colors"
          style={{ bottom: `calc(${percentage}% - 28px)` }}
        >
          <div className="w-8 h-1 bg-brand-primary/80 rounded-full mb-1"></div>
          <div className="w-6 h-px bg-white/10"></div>
          <div className="mt-1 text-[9px] font-mono font-bold text-text-primary/80">
            {Math.round(percentage)}%
          </div>
        </div>
      </div>
      
      <div className="flex flex-col items-center">
        <span className={`text-xs font-bold tracking-wider ${isMaster ? 'text-brand-primary' : 'text-text-secondary'}`}>
          {label}
        </span>
      </div>
    </div>
  );
};

export default Fader;
