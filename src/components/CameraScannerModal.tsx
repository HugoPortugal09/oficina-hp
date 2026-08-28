import React, { useState, useRef, useEffect } from 'react';
import { Modal } from './Modal';
import { Camera, Upload, Sparkles, RefreshCw, CheckCircle, AlertTriangle, Scan, Cpu, ShieldCheck } from 'lucide-react';
import { processImageWithOllama } from '../services/ollamaService';
import type { VisionScanResult } from '../types';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (result: VisionScanResult) => void;
  initialMode?: 'matricula' | 'odometro' | 'peca' | 'geral';
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  isOpen,
  onClose,
  onScanComplete,
  initialMode = 'matricula'
}) => {
  const [mode, setMode] = useState<'matricula' | 'odometro' | 'peca' | 'geral'>(initialMode);
  const [streamActive, setStreamActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<VisionScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initialMode when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setResult(null);
      setCapturedImage(null);
      startCamera();
    } else {
      stopCamera();
    }
  }, [isOpen, initialMode]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStreamActive(true);
        }
      }
    } catch (err: any) {
      setCameraError('Câmara não disponível ou permissão recusada. Pode utilizar o envio de fotografia.');
      setStreamActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
  };

  const captureFrame = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedImage(dataUrl);
      stopCamera();
      analyzeImage(dataUrl);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        setCapturedImage(base64);
        stopCamera();
        analyzeImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async (base64: string) => {
    setIsProcessing(true);
    setResult(null);
    try {
      const scanResult = await processImageWithOllama(base64, mode);
      setResult(scanResult);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetCapture = () => {
    setCapturedImage(null);
    setResult(null);
    startCamera();
  };

  const handleApply = () => {
    if (result) {
      onScanComplete(result);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Scanner IA - Visão Computacional"
      subtitle="Digitalização inteligente de matrículas, quilómetros e peças com Ollama (llama3.2-vision)"
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Mode Selector */}
        <div className="grid grid-cols-4 gap-2 p-1.5 bg-slate-950/60 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setMode('matricula')}
            className={`py-2 px-3 text-xs font-semibold rounded-xl transition-all ${
              mode === 'matricula'
                ? 'bg-hp-600 text-white shadow-lg shadow-hp-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🚗 Matrícula
          </button>
          <button
            type="button"
            onClick={() => setMode('odometro')}
            className={`py-2 px-3 text-xs font-semibold rounded-xl transition-all ${
              mode === 'odometro'
                ? 'bg-hp-600 text-white shadow-lg shadow-hp-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ⏱️ Odómetro/Horas
          </button>
          <button
            type="button"
            onClick={() => setMode('peca')}
            className={`py-2 px-3 text-xs font-semibold rounded-xl transition-all ${
              mode === 'peca'
                ? 'bg-hp-600 text-white shadow-lg shadow-hp-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ⚙️ Peça / Código
          </button>
          <button
            type="button"
            onClick={() => setMode('geral')}
            className={`py-2 px-3 text-xs font-semibold rounded-xl transition-all ${
              mode === 'geral'
                ? 'bg-hp-600 text-white shadow-lg shadow-hp-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🔍 Análise Geral
          </button>
        </div>

        {/* Viewfinder / Captured Preview */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-[4/3] flex items-center justify-center border border-slate-800">
          {!capturedImage ? (
            <>
              {streamActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-6 text-slate-400 space-y-3">
                  <Camera className="w-12 h-12 mx-auto text-slate-600 animate-pulse" />
                  <p className="text-sm font-medium">{cameraError || 'A iniciar câmara...'}</p>
                </div>
              )}

              {/* Viewfinder Target Overlays */}
              <div className="absolute inset-8 pointer-events-none border-2 border-dashed border-hp-400/40 rounded-xl flex items-center justify-center">
                <div className="text-[11px] font-mono text-hp-300 bg-slate-950/80 px-2 py-0.5 rounded border border-hp-500/30">
                  {mode === 'matricula' && 'ENQUADRE A MATRÍCULA'}
                  {mode === 'odometro' && 'ENQUADRE O CONTAGEM / DISPLAY'}
                  {mode === 'peca' && 'ENQUADRE A PEÇA OU ETIQUETA'}
                  {mode === 'geral' && 'ENQUADRE O VEÍCULO'}
                </div>
              </div>
            </>
          ) : (
            <img
              src={capturedImage}
              alt="Captura"
              className="w-full h-full object-contain"
            />
          )}

          {/* Processing Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-white">
              <div className="relative">
                <RefreshCw className="w-10 h-10 text-hp-400 animate-spin" />
                <Sparkles className="w-5 h-5 text-amber-400 absolute -top-1 -right-1 animate-bounce" />
              </div>
              <p className="text-sm font-semibold tracking-wide">A processar imagem com IA...</p>
              <span className="text-xs text-slate-400 font-mono">Ollama llama3.2-vision / OCR</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        {!capturedImage ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={captureFrame}
              disabled={!streamActive}
              className="flex-1 glass-btn py-3 px-4 rounded-xl text-white font-semibold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera className="w-5 h-5" />
              Capturar Fotografia
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium flex items-center gap-2 border border-slate-700 transition-colors"
            >
              <Upload className="w-5 h-5" />
              Carregar Ficheiro
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={resetCapture}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium flex items-center gap-2 border border-slate-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Tirar Outra Foto
            </button>

            {result && result.sucesso && (
              <button
                type="button"
                onClick={handleApply}
                className="flex-1 glass-btn py-2.5 px-4 rounded-xl text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-hp-600/30"
              >
                <CheckCircle className="w-5 h-5 text-emerald-300" />
                Aplicar Dados Reconhecidos
              </button>
            )}
          </div>
        )}

        {/* Scan Results Card */}
        {result && (
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-bold text-slate-200">Resultado do Reconhecimento</h4>
              </div>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                {result.origem === 'ollama' ? '⚡ Ollama IA' : '🔍 OCR Heurístico'} ({result.tempoProcessamentoMs}ms)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {result.matricula && (
                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Matrícula</span>
                  <span className="text-base font-mono font-extrabold text-hp-400 tracking-wider">
                    {result.matricula}
                  </span>
                </div>
              )}

              {result.marcaModelo && (
                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Marca / Modelo</span>
                  <span className="text-sm font-semibold text-slate-200">{result.marcaModelo}</span>
                </div>
              )}

              {(result.odometroKm !== undefined && result.odometroKm > 0) && (
                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Quilómetros (Km)</span>
                  <span className="text-sm font-mono font-bold text-emerald-400">
                    {result.odometroKm.toLocaleString()} Km
                  </span>
                </div>
              )}

              {(result.odometroHoras !== undefined && result.odometroHoras > 0) && (
                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Horas de Trabalho</span>
                  <span className="text-sm font-mono font-bold text-amber-400">
                    {result.odometroHoras} h
                  </span>
                </div>
              )}
            </div>

            {result.anomaliasVisuais && result.anomaliasVisuais.length > 0 && (
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">
                  Anomalias / Observações Detetadas
                </span>
                <ul className="list-disc list-inside text-xs text-slate-300 space-y-0.5">
                  {result.anomaliasVisuais.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
