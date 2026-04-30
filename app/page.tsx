'use client';

import { useState, useCallback } from 'react';
import UploadZone from '@/components/UploadZone';
import ReportDisplay from '@/components/ReportDisplay';

type SystemType = 'Enphase' | 'Tesla Powerwall 3' | 'Franklin Battery' | '';

interface FormData {
  projectName: string;
  address: string;
  system: SystemType;
  email: string;
  notes: string;
}

interface AnalysisResult {
  report: string;
  driveFolder?: string;
  emailSent: boolean;
}

type AppState = 'form' | 'analyzing' | 'result' | 'error';

const ANALYZING_STEPS = [
  'Subiendo fotos al servidor...',
  'Organizando imágenes en Google Drive...',
  'Enviando fotos a SQC Scope AI...',
  'Analizando instalación solar...',
  'Evaluando cumplimiento de criterios M1...',
  'Generando reporte de QC...',
  'Enviando reporte por email...',
];

export default function HomePage() {
  const [formData, setFormData] = useState<FormData>({
    projectName: '',
    address: '',
    system: '',
    email: '',
    notes: '',
  });

  const [photos, setPhotos] = useState<File[]>([]);
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [appState, setAppState] = useState<AppState>('form');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentStep, setCurrentStep] = useState(0);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isFormValid = () => {
    return (
      formData.projectName.trim() &&
      formData.address.trim() &&
      formData.system &&
      formData.email.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
      photos.length > 0
    );
  };

  const simulateSteps = useCallback(() => {
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < ANALYZING_STEPS.length) {
        setCurrentStep(step);
      } else {
        clearInterval(interval);
      }
    }, 4000);
    return interval;
  }, []);

  /** Compress an image file using canvas to stay within size limits */
  const compressImage = async (file: File, targetBytes = 700_000): Promise<File> => {
    // Skip non-images or small files
    if (!file.type.startsWith('image/') || file.size <= targetBytes) return file;

    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');

        // Scale down if very large
        let { width, height } = img;
        const MAX_DIM = 1920;
        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        // Try progressively lower quality until small enough
        let quality = 0.85;
        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) { resolve(file); return; }
              if (blob.size <= targetBytes || quality <= 0.3) {
                resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
              } else {
                quality -= 0.1;
                tryCompress();
              }
            },
            'image/jpeg',
            quality
          );
        };
        tryCompress();
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  };

  const handleAnalyze = async () => {
    if (!isFormValid()) return;

    setAppState('analyzing');
    setCurrentStep(0);
    const stepInterval = simulateSteps();

    try {
      const data = new FormData();
      data.append('projectName', formData.projectName);
      data.append('address', formData.address);
      data.append('system', formData.system);
      data.append('email', formData.email);
      data.append('notes', formData.notes);

      // Compress images dynamically so total payload stays under 4MB
      // PDFs (Site Capture) are passed as-is
      const photosToUpload = photos.slice(0, 100);
      const imageCount = photosToUpload.filter(p => p.type.startsWith('image/')).length;
      const targetBytesPerImage = imageCount > 0
        ? Math.max(80_000, Math.min(700_000, Math.floor(3_500_000 / imageCount)))
        : 700_000;
      const compressed = await Promise.all(
        photosToUpload.map(p => p.type === 'application/pdf' ? p : compressImage(p, targetBytesPerImage))
      );
      for (const photo of compressed) {
        data.append('photos', photo);
      }

      // Append plan if exists
      if (planFile) {
        data.append('plan', planFile);
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: data,
      });

      clearInterval(stepInterval);

      if (!response.ok) {
        // Handle non-JSON error responses (e.g. 413 from Vercel)
        let errMsg = 'Error al procesar el análisis';
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => ({}));
          errMsg = errorData.error || errMsg;
        } else if (response.status === 413) {
          errMsg = 'Las fotos son demasiado grandes. Intenta con menos fotos o imágenes más pequeñas.';
        } else {
          errMsg = `Error del servidor (${response.status}). Intenta de nuevo.`;
        }
        throw new Error(errMsg);
      }

      const resultData = await response.json();
      setResult({
        report: resultData.report,
        driveFolder: resultData.driveFolder,
        emailSent: resultData.emailSent,
      });
      setAppState('result');
    } catch (err) {
      clearInterval(stepInterval);
      setErrorMessage(err instanceof Error ? err.message : 'Error desconocido');
      setAppState('error');
    }
  };

  const handleReset = () => {
    setFormData({ projectName: '', address: '', system: '', email: '', notes: '' });
    setPhotos([]);
    setPlanFile(null);
    setResult(null);
    setErrorMessage('');
    setAppState('form');
    setCurrentStep(0);
  };

  return (
    <div className="min-h-screen bg-[#f5f4f0]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10 no-print">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          {/* Logo */}
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: 'linear-gradient(135deg, #B7960C 0%, #D4AF37 100%)' }}>
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">SQC Scope</h1>
            <p className="text-xs text-[#B7960C] font-medium leading-tight">Solar Quality Control</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-16">
        {/* ──────────────── FORM STATE ──────────────── */}
        {appState === 'form' && (
          <div className="space-y-4">
            {/* Intro banner */}
            <div className="rounded-2xl p-4 border border-[#B7960C]/20"
                 style={{ background: 'linear-gradient(135deg, #fdf9e7 0%, #fff 100%)' }}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚡</span>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Evaluación QC automatizada</p>
                  <p className="text-xs text-gray-500 mt-0.5">Sube las fotos de la instalación y recibe en segundos un reporte detallado de cumplimiento para el hito M1.</p>
                </div>
              </div>
            </div>

            {/* Card 1: Project Info */}
            <div className="card">
              <p className="section-label">Información del Proyecto</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del cliente / proyecto <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ej: Juan Pérez — Casa Las Piedras"
                    value={formData.projectName}
                    onChange={e => handleInputChange('projectName', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dirección de la instalación <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ej: Calle Sol #42, Ponce, PR 00730"
                    value={formData.address}
                    onChange={e => handleInputChange('address', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sistema instalado <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Enphase', 'Tesla Powerwall 3', 'Franklin Battery'] as SystemType[]).map(sys => (
                      <button
                        key={sys}
                        type="button"
                        onClick={() => handleInputChange('system', sys)}
                        className={`py-3 px-2 rounded-xl border-2 text-xs font-medium transition-all duration-200 text-center
                          ${formData.system === sys
                            ? 'border-[#B7960C] bg-[#B7960C]/10 text-[#B7960C]'
      2                     : 'border-gray-200 text-gray-600 hover:border-[#B7960C]/40'
                          }`}
                      >
                        {sys === 'Enphase' && '⚡ '}
                        {sys === 'Tesla Powerwall 3' && '🔋 '}
                        {sys === 'Franklin Battery' && '🔌 '}
                        {sys}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email para recibir el reporte <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    className="input-field"
                    placeholder="instalador@empresa.com"
                    value={formData.email}
                    onChange={e => handleInputChange('email', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Photos */}
            <div className="card">
              <p className="section-label">Fotos de la Instalación</p>
              <p className="text-xs text-gray-500 mb-3">
                Sube fotos individuales (JPG, PNG, HEIC, WebP) o un reporte PDF de Site Capture. Hasta 100 archivos.
              </p>
              <UploadZone
                accept={{
                  'image/*': ['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp'],
                  'application/pdf': ['.pdf'],
                }}
                files={photos}
                onFilesChange={setPhotos}
                maxFiles={100}
                label="Arrastra fotos o PDF de Site Capture aquí"
                icon="📷"
              />
              {photos.length > 0 && (
                <p className="text-xs text-[#B7960C] mt-2 font-medium">
                  ✓ {photos.length} archivo{photos.length !== 1 ? 's' : ''} seleccionado{photos.length !== 1 ? 's' : ''}
                  {photos.length > 100 && <span className="text-amber-600"> — Solo se procesarán los primeros 100</span>}
                </p>
              )}
            </div>

            {/* Card 3: Plan PDF */}
            <div className="card">
              <p className="section-label">Plano del Proyecto (Opcional)</p>
              <p className="text-xs text-gray-500 mb-3">
                Sube el plano de diseño en PDF. Ayuda a evaluar criterios dependientes del diseño.
              </p>
              <UploadZone
                accept={{ 'application/pdf': ['.pdf'] }}
                files={planFile ? [planFile] : []}
                onFilesChange={(files) => setPlanFile(files[0] || null)}
                maxFiles={1}
                label="Arrastra el plano aquí o toca para seleccionar"
                icon="📄"
                singleFile
              />
              {planFile && (
                <p className="text-xs text-[#B7960C] mt-2 font-medium">
                  ✓ {planFile.name}
                </p>
              )}
            </div>

            {/* Card 4: Notes */}
            <div className="card">
              <p className="section-label">Notas Adicionales (Opcional)</p>
              <textarea
                className="input-field resize-none"
                rows={3}
                placeholder="Ej: Sistema de 10kW con batería. El panel principal es de 200A. Hubo cambio de ubicación del gateway..."
                value={formData.notes}
                onChange={e => handleInputChange('notes', e.target.value)}
              />
            </div>

            {/* Validation hint */}
            {!isFormValid() && (formData.projectName || formData.email || photos.length > 0) && (
              <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                {!formData.projectName && '• Falta el nombre del proyecto\n'}
                {!formData.address && '• Falta la dirección\n'}
                {!formData.system && '• Selecciona el sistema instalado\n'}
                {!formData.email && '• Falta el email\n'}
                {formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) && '• Email inválido\n'}
                {photos.length === 0 && '• Sube al menos una foto'}
              </div>
            )}

            {/* Analyze Button */}
            <button
              onClick={handleAnalyze}
              disabled={!isFormValid()}
              className="btn-gold w-full text-base flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Analizar instalación con SQC Scope
            </button>

            <p className="text-center text-xs text-gray-400 pb-4">
              El análisis puede tomar entre 30 y 60 segundos
            </p>
          </div>
        )}

        {/* ──────────────── ANALYZING STATE ──────────────── */}
        {appState === 'analyzing' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
            <div className="card w-full max-w-sm text-center">
              {/* Animated logo */}
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 analyzing-pulse"
                   style={{ background: 'linear-gradient(135deg, #B7960C 0%, #D4AF37 100%)' }}>
                <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>

              <h2 className="text-xl font-bold text-gray-900 mb-2">Analizando instalación</h2>
              <p className="text-sm text-gray-500 mb-6">{formData.projectName}</p>

              {/* Step progress */}
              <div className="space-y-2 text-left mb-6">
                {ANA