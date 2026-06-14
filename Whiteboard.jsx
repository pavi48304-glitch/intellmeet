import { useRef, useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useMeeting } from '../../context/MeetingContext';
import { Trash2, Edit2, Eraser, Download } from 'lucide-react';

export const Whiteboard = () => {
  const { socket } = useSocket();
  const { meetingCode } = useMeeting();
  
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#06b6d4'); // Cyan default
  const [thickness, setThickness] = useState(4);
  const [isEraser, setIsEraser] = useState(false);
  
  const lastPos = useRef({ x: 0, y: 0 });

  const colors = [
    { name: 'cyan', value: '#06b6d4' },
    { name: 'purple', value: '#a855f7' },
    { name: 'emerald', value: '#10b981' },
    { name: 'red', value: '#ef4444' },
    { name: 'yellow', value: '#f59e0b' },
    { name: 'white', value: '#ffffff' }
  ];

  // Configure canvas on mount / resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas sizes relative to parent container
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * 2; // High-DPI support
    canvas.height = rect.height * 2;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const context = canvas.getContext('2d');
    context.scale(2, 2);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    contextRef.current = context;

    // Redraw dark-background
    context.fillStyle = '#0f172a';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Socket listener for incoming drawings
  useEffect(() => {
    if (!socket) return;

    const handleDrawLine = (line) => {
      const context = contextRef.current;
      if (!context) return;

      if (line.thickness === 9999) {
        const canvas = canvasRef.current;
        if (canvas) {
          context.fillStyle = '#0f172a';
          context.fillRect(0, 0, canvas.width, canvas.height);
        }
        return;
      }

      context.beginPath();
      context.moveTo(line.x0, line.y0);
      context.lineTo(line.x1, line.y1);
      context.strokeStyle = line.color;
      context.lineWidth = line.thickness;
      context.stroke();
    };

    socket.on('draw-line', handleDrawLine);

    return () => {
      socket.off('draw-line', handleDrawLine);
    };
  }, [socket]);

  // Local mouse coordinates helpers
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Support touch devices as well
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    const { x, y } = getCoordinates(e);
    lastPos.current = { x, y };
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const context = contextRef.current;
    if (!context) return;

    const { x, y } = getCoordinates(e);
    const drawColor = isEraser ? '#0f172a' : color;
    const drawThickness = isEraser ? 24 : thickness;

    context.beginPath();
    context.moveTo(lastPos.current.x, lastPos.current.y);
    context.lineTo(x, y);
    context.strokeStyle = drawColor;
    context.lineWidth = drawThickness;
    context.stroke();

    // Broadcast stroke parameters
    if (socket && meetingCode) {
      socket.emit('draw-line', {
        meetingCode,
        line: {
          x0: lastPos.current.x,
          y0: lastPos.current.y,
          x1: x,
          y1: y,
          color: drawColor,
          thickness: drawThickness
        }
      });
    }

    lastPos.current = { x, y };
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    context.fillStyle = '#0f172a';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Broadcast clear event
    if (socket && meetingCode) {
      // Send drawing with erase-all thickness to clear remote canvases
      socket.emit('draw-line', {
        meetingCode,
        line: {
          x0: 0,
          y0: 0,
          x1: canvas.width,
          y1: canvas.height,
          color: '#0f172a',
          thickness: 9999
        }
      });
    }
  };

  const downloadWhiteboard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `whiteboard-${meetingCode}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="h-full flex flex-col p-4 space-y-3 select-none">
      
      {/* 1. Header Toolbar Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-white/5 p-3 rounded-2xl shrink-0">
        
        {/* Colors selector */}
        <div className="flex items-center gap-2">
          {colors.map((c) => (
            <button
              key={c.name}
              onClick={() => { setColor(c.value); setIsEraser(false); }}
              className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
                color === c.value && !isEraser ? 'border-cyan-400 scale-110 shadow-md shadow-cyan-400/20' : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: c.value }}
              title={`Color ${c.name}`}
            />
          ))}
        </div>

        {/* Thickness selector */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-500 uppercase font-bold">Size:</span>
          <div className="flex items-center gap-1">
            {[2, 4, 8, 12].map((t) => (
              <button
                key={t}
                onClick={() => setThickness(t)}
                className={`w-6 h-6 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                  thickness === t ? 'bg-[#182033] border-cyan-500/30 text-cyan-400' : 'bg-black/20 border-white/5 text-gray-400 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Mode tools */}
        <div className="flex items-center gap-1.5 pl-3 border-l border-white/5">
          {/* Pencil */}
          <button
            onClick={() => setIsEraser(false)}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              !isEraser ? 'bg-[#182033] border-cyan-500/30 text-cyan-400' : 'bg-black/20 border-white/5 text-gray-400 hover:text-white'
            }`}
            title="Brush Draw Mode"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          
          {/* Eraser */}
          <button
            onClick={() => setIsEraser(true)}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isEraser ? 'bg-[#182033] border-cyan-500/30 text-cyan-400' : 'bg-black/20 border-white/5 text-gray-400 hover:text-white'
            }`}
            title="Eraser Mode"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>
          
          {/* Download Canvas */}
          <button
            onClick={downloadWhiteboard}
            className="p-2 rounded-xl bg-black/20 border border-white/5 text-gray-400 hover:text-white transition-all cursor-pointer"
            title="Export image PNG"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          
          {/* Clear */}
          <button
            onClick={clearCanvas}
            className="p-2 rounded-xl bg-red-950/20 border border-red-500/20 text-red-400 hover:bg-red-950/40 transition-all cursor-pointer"
            title="Wipe canvas board"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* 2. Visual Canvas Area */}
      <div className="flex-1 bg-[#0f172a] rounded-2xl border border-white/5 relative overflow-hidden cursor-crosshair">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="absolute inset-0 block w-full h-full"
        />
      </div>

    </div>
  );
};
