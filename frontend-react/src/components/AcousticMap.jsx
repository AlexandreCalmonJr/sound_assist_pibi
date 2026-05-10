import React, { useEffect, useRef, useState } from 'react';

const AcousticMap = ({ width = 10, length = 20, onPointAdded }) => {
  const canvasRef = useRef(null);
  const [measurements, setMeasurements] = useState([]);
  const [floorPlan, setFloorPlan] = useState(null);

  useEffect(() => {
    render();
    window.addEventListener('resize', render);
    return () => window.removeEventListener('resize', render);
  }, [width, length, measurements, floorPlan]);

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = container.clientWidth * dpr;
    canvas.height = Math.min(container.clientWidth * (length / width), 500) * dpr;
    ctx.scale(dpr, dpr);

    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);

    const padding = 40;
    const scale = Math.min((w - padding * 2) / width, (h - padding * 2) / length);
    const drawW = width * scale;
    const drawL = length * scale;
    const offsetX = (w - drawW) / 2;
    const offsetY = (h - drawL) / 2;

    // Background Image
    if (floorPlan) {
      ctx.globalAlpha = 0.3;
      ctx.drawImage(floorPlan, offsetX, offsetY, drawW, drawL);
      ctx.globalAlpha = 1.0;
    }

    // Heatmap effect
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    measurements.forEach(m => {
      const px = offsetX + (m.x * scale);
      const py = offsetY + (m.y * scale);
      const radius = 60 * (scale / 10);
      const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
      
      const color = m.status === 'danger' ? 'rgba(239, 68, 68, 0.4)' : (m.status === 'warning' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(34, 211, 238, 0.2)');
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'transparent');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // Grid & Border
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(offsetX, offsetY, drawW, drawL);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < width; i++) {
      const x = offsetX + (i * scale);
      ctx.beginPath(); ctx.moveTo(x, offsetY); ctx.lineTo(x, offsetY + drawL); ctx.stroke();
    }
    for (let i = 1; i < length; i++) {
      const y = offsetY + (i * scale);
      ctx.beginPath(); ctx.moveTo(offsetX, y); ctx.lineTo(offsetX + drawW, y); ctx.stroke();
    }

    // Altar
    ctx.fillStyle = 'rgba(34, 211, 238, 0.1)';
    ctx.fillRect(offsetX, offsetY, drawW, drawL * 0.15);
    ctx.fillStyle = 'rgba(34, 211, 238, 0.5)';
    ctx.font = 'bold 10px Inter';
    ctx.fillText('ALTAR / PALCO', offsetX + 10, offsetY + 20);

    // Points
    measurements.forEach(m => {
      const px = offsetX + (m.x * scale);
      const py = offsetY + (m.y * scale);
      
      ctx.shadowBlur = 10;
      ctx.shadowColor = m.status === 'danger' ? '#ef4444' : (m.status === 'warning' ? '#f59e0b' : '#22d3ee');
      ctx.fillStyle = ctx.shadowColor;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${m.hz}Hz`, px, py + 18);
    });
  };

  const handleClick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const padding = 40;
    const scale = Math.min((w - padding * 2) / width, (h - padding * 2) / length);
    const offsetX = (w - (width * scale)) / 2;
    const offsetY = (h - (length * scale)) / 2;

    const meterX = (x - offsetX) / scale;
    const meterY = (y - offsetY) / scale;

    if (meterX < 0 || meterX > width || meterY < 0 || meterY > length) return;

    // Simulação de dado acústico (no futuro virá do socket)
    const newPoint = { 
        x: meterX, 
        y: meterY, 
        hz: Math.floor(Math.random() * 8000) + 100, 
        status: Math.random() > 0.7 ? 'warning' : 'safe' 
    };
    
    setMeasurements([...measurements, newPoint]);
    if (onPointAdded) onPointAdded(newPoint);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => setFloorPlan(img);
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative bg-black rounded-3xl border border-white/5 overflow-hidden">
        <canvas 
            ref={canvasRef} 
            onClick={handleClick}
            className="w-full cursor-crosshair block"
        />
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-6 text-[8px] uppercase font-bold text-text-muted bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/5">
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-cyan-500"></span> Ideal</span>
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Atenção</span>
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"></span> Crítico</span>
        </div>
      </div>

      <div className="flex gap-2">
        <label className="flex-1 cursor-pointer py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-bold uppercase tracking-widest border border-white/5 transition-all text-center">
            🖼️ Carregar Planta
            <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" />
        </label>
        <button 
            onClick={() => setMeasurements([])}
            className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-bold uppercase tracking-widest border border-white/5 transition-all"
        >
            🧹 Limpar Mapa
        </button>
      </div>
    </div>
  );
};

export default AcousticMap;
