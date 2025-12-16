import React, { useState, useRef } from 'react';
import { Upload, Scissors, Trash2, Download, Settings, Loader2, Video, Zap } from 'lucide-react';

const App = () => {
  const [videoSrc, setVideoSrc] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedVideoUrl, setProcessedVideoUrl] = useState(null);
  const [selection, setSelection] = useState(null); 
  const [outputFormat, setOutputFormat] = useState('mp4'); 
  const [qualityPreset, setQualityPreset] = useState('normal'); // เพิ่ม state สำหรับ Preset
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // --- Configuration ---
  // กำหนดค่า Bitrate ตาม Preset (เลียนแบบ FFmpeg logic: ช้า=ชัด, เร็ว=ไม่เน้นชัด)
  const PRESETS = {
    'veryslow': { bitrate: 8000000, label: 'Very Slow (ชัดสูงสุด)' },
    'slow':     { bitrate: 5000000, label: 'Slow (ชัดมาก)' },
    'normal':   { bitrate: 2500000, label: 'Normal (มาตรฐาน)' },
    'fast':     { bitrate: 1500000, label: 'Fast (ไฟล์เล็ก)' },
    'veryfast': { bitrate: 800000,  label: 'Very Fast (ประหยัด)' },
    'ultrafast':{ bitrate: 400000,  label: 'Ultrafast (เล็กสุด)' }
  };
  
  // --- File Handling ---
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setProcessedVideoUrl(null);
      setSelection(null);
      setProgress(0);
    } else {
      alert('กรุณาเลือกไฟล์วิดีโอเท่านั้น');
    }
  };

  const getSupportedMimeType = (format) => {
    const types = {
      'mp4': ['video/mp4;codecs=h264', 'video/mp4', 'video/webm;codecs=h264'],
      'webm': ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'],
      'mkv': ['video/x-matroska', 'video/webm;codecs=vp9', 'video/webm'], 
      'avi': ['video/x-msvideo', 'video/webm']
    };
    const preferences = types[format] || types['mp4'];
    for (const type of preferences) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'video/webm';
  };

  // --- Touch & Mouse Interaction ---
  const getCoords = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      width: rect.width,
      height: rect.height
    };
  };

  const handleStart = (e) => {
    if (isProcessing) return;
    const { x, y } = getCoords(e);
    setStartPos({ x, y });
    setIsDragging(true);
    setSelection({ x, y, w: 0, h: 0, containerW: 0, containerH: 0 }); 
  };

  const handleMove = (e) => {
    if (!isDragging || !containerRef.current) return;
    const { x, y, width, height } = getCoords(e);
    const w = x - startPos.x;
    const h = y - startPos.y;
    setSelection({
      x: w > 0 ? startPos.x : x,
      y: h > 0 ? startPos.y : y,
      w: Math.abs(w),
      h: Math.abs(h),
      containerW: width,
      containerH: height
    });
  };

  const handleEnd = () => setIsDragging(false);
  const resetSelection = () => setSelection(null);

  // --- Core Processing Logic ---
  const processVideo = async () => {
    if (!videoRef.current || !selection) return;

    setIsProcessing(true);
    setProgress(0);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const scaleX = video.videoWidth / selection.containerW;
    const scaleY = video.videoHeight / selection.containerH;

    const blurRect = {
      x: selection.x * scaleX,
      y: selection.y * scaleY,
      w: selection.w * scaleX,
      h: selection.h * scaleY
    };

    const stream = canvas.captureStream(30); 
    const mimeType = getSupportedMimeType(outputFormat);
    
    // เลือก Bitrate ตาม Preset ที่ user เลือก
    const targetBitrate = PRESETS[qualityPreset].bitrate;

    const mediaRecorder = new MediaRecorder(stream, { 
      mimeType: mimeType,
      videoBitsPerSecond: targetBitrate 
    });
    
    const chunks = [];
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setProcessedVideoUrl(url);
      setIsProcessing(false);
      video.currentTime = 0; 
      video.pause();
    };

    mediaRecorder.start();
    video.currentTime = 0;
    await video.play();

    const drawFrame = () => {
      if (video.paused || video.ended) {
        if (video.ended) mediaRecorder.stop();
        return;
      }

      ctx.filter = 'none';
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.beginPath();
      ctx.rect(blurRect.x, blurRect.y, blurRect.w, blurRect.h);
      ctx.clip();
      ctx.filter = 'blur(15px)'; 
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      if (video.duration) setProgress(Math.round((video.currentTime / video.duration) * 100));
      requestAnimationFrame(drawFrame);
    };

    drawFrame();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans flex flex-col items-center p-4">
      {/* Header */}
      <header className="w-full max-w-md flex flex-col gap-1 mb-6 border-b border-gray-800 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent flex items-center gap-2">
            <Video className="w-6 h-6 text-blue-400" />
            AI Video Clean
          </h1>
          <span className="text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-400">Pro</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="w-full max-w-md flex flex-col gap-4">
        
        {/* Upload */}
        {!videoSrc && (
          <div className="border-2 border-dashed border-gray-700 rounded-xl h-64 flex flex-col items-center justify-center bg-gray-800/50 hover:bg-gray-800 transition cursor-pointer relative group">
            <input type="file" accept="video/*" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer" />
            <div className="bg-gray-700 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform">
              <Upload className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-sm font-medium">แตะเพื่อเลือกวิดีโอ</p>
            <p className="text-xs text-gray-500 mt-1">MP4, WebM, AVI</p>
          </div>
        )}

        {/* Editor */}
        {videoSrc && !processedVideoUrl && (
          <div className="flex flex-col gap-4">
            <div className="relative bg-black rounded-lg overflow-hidden shadow-2xl border border-gray-800">
              <div 
                ref={containerRef}
                className="relative w-full touch-none select-none"
                onMouseDown={handleStart}
                onMouseMove={handleMove}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
                onTouchStart={handleStart}
                onTouchMove={handleMove}
                onTouchEnd={handleEnd}
              >
                <video ref={videoRef} src={videoSrc} className="w-full block" playsInline muted />
                
                {selection && (
                  <div 
                    className="absolute border-2 border-red-500 bg-red-500/20 shadow-[0_0_15px_rgba(255,0,0,0.5)] backdrop-blur-[1px]"
                    style={{ left: selection.x, top: selection.y, width: selection.w, height: selection.h }}
                  >
                    <div className="absolute -top-6 left-0 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase">Remove</div>
                  </div>
                )}
                
                {!selection && !isProcessing && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/40">
                    <div className="bg-black/60 px-4 py-2 rounded-full backdrop-blur-md border border-white/10 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                      <p className="text-sm font-medium text-white">ลากนิ้วคลุมจุดที่ต้องการลบ</p>
                    </div>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="bg-gray-800 p-4 rounded-xl flex flex-col gap-4 shadow-lg">
              {isProcessing ? (
                <div className="flex flex-col items-center py-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                    <span className="text-sm font-medium">กำลังทำงาน... {progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              ) : (
                <>
                  {/* Settings Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    {/* Format Selector */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-400 flex items-center gap-1">
                        <Settings className="w-3 h-3" /> Format
                      </label>
                      <select 
                        value={outputFormat}
                        onChange={(e) => setOutputFormat(e.target.value)}
                        className="bg-gray-900 border border-gray-700 text-white text-xs rounded-lg block p-2 outline-none w-full"
                      >
                        <option value="mp4">MP4</option>
                        <option value="webm">WebM</option>
                        <option value="mkv">MKV</option>
                        <option value="avi">AVI</option>
                      </select>
                    </div>

                    {/* Speed/Quality Preset Selector */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-400 flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Quality
                      </label>
                      <select 
                        value={qualityPreset}
                        onChange={(e) => setQualityPreset(e.target.value)}
                        className="bg-gray-900 border border-gray-700 text-white text-xs rounded-lg block p-2 outline-none w-full"
                      >
                        {Object.entries(PRESETS).map(([key, data]) => (
                          <option key={key} value={key}>
                            {data.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 border-t border-gray-700 pt-3">
                    <button 
                      onClick={processVideo}
                      disabled={!selection}
                      className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${selection ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-500'}`}
                    >
                      <Scissors className="w-4 h-4" /> เริ่มประมวลผล
                    </button>
                    {selection && (
                      <button onClick={resetSelection} className="p-3 bg-gray-700 rounded-lg text-gray-300">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Result */}
        {processedVideoUrl && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-gray-800 rounded-xl overflow-hidden border border-green-500/30">
              <div className="bg-green-500/10 p-3 text-green-400 text-sm font-medium text-center border-b border-green-500/20">
                เสร็จสิ้น ({outputFormat.toUpperCase()} - {qualityPreset})
              </div>
              <video src={processedVideoUrl} controls className="w-full bg-black" playsInline />
            </div>
            <a 
              href={processedVideoUrl} 
              download={`cleaned_${Date.now()}.${outputFormat}`}
              className="w-full py-4 bg-green-600 rounded-xl font-bold text-white flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" /> บันทึกวิดีโอ
            </a>
            <button onClick={() => { setProcessedVideoUrl(null); setVideoSrc(null); }} className="text-gray-400 text-sm py-2 hover:text-white underline decoration-gray-600 underline-offset-4">
              ทำรายการใหม่
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
