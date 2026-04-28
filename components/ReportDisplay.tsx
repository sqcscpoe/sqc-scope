'use client';

import { useState } from 'react';

interface ReportDisplayProps {
  report: string;
  projectName: string;
  emailSent: boolean;
  recipientEmail: string;
  driveFolder?: string;
  onReset: () => void;
}

export default function ReportDisplay({
  report,
  projectName,
  emailSent,
  recipientEmail,
  driveFolder,
  onReset,
}: ReportDisplayProps) {
  const [copied, setCopied] = useState(false);

  const isReady = report.includes('LISTO PARA M1');
  const hasBlocking = report.includes('FALLA BLOQUEANTE') || report.includes('\u274C');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = report;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getVerdict = () => {
    if (report.includes('LISTO PARA M1')) return 'LISTO PARA M1';
    if (report.includes('NO LISTO')) return 'NO LISTO — CORRECCIONES REQUERIDAS';
    return 'EVALUACIÓN COMPLETADA';
  };

  return (
    <div className="space-y-4">
      {/* Verdict Banner */}
      <div className={`rounded-2xl p-5 border-2 ${
        isReady
          ? 'bg-green-50 border-green-300'
          : 'bg-amber-50 border-amber-300'
      }`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{isReady ? '\u2705' : '\u26A0\uFE0F'}</span>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Veredicto General</p>
            <p className={`text-lg font-bold mt-0.5 ${isReady ? 'text-green-700' : 'text-amber-700'}`}>
              {getVerdict()}
            </p>
            <p className="text-sm text-gray-600 mt-0.5">{projectName}</p>
          </div>
        </div>
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap gap-2 no-print">
        {emailSent ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700 font-medium">
            <span>\u{1F4E7}</span> Reporte enviado a {recipientEmail}
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-full text-xs text-gray-500">
            <span>\u{1F4E7}</span> Email no enviado (revisar configuración)
          </div>
        )}
        {driveFolder && (
          <a
            href={driveFolder}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-xs text-green-700 font-medium hover:bg-green-100 transition-colors"
          >
            <span>\u{1F4C1}</span> Ver en Google Drive
          </a>
        )}
      </div>

      {/* Report content */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 no-print">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#B7960C]" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Reporte QC — SQC Scope</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 font-medium
                ${copied
                  ? 'bg-green-100 border-green-300 text-green-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-[#B7960C]/40 hover:text-[#B7960C]'
                }`}
            >
              {copied ? '✓ Copiado' : 'Copiar'}
            </button>
            <button
              onClick={handlePrint}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-[#B7960C]/40 hover:text-[#B7960C] transition-all font-medium"
            >
              \u{1F5A8} PDF
            </button>
          </div>
        </div>

        {/* Monospace report */}
        <div className="report-content overflow-x-auto">
          <pre className="text-xs leading-relaxed text-gray-800 p-4 font-mono whitespace-pre-wrap break-words">
            {report}
          </pre>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 no-print pb-6">
        <button
          onClick={onReset}
          className="btn-gold flex-1 flex items-center justify-center gap-2"
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 .49-3.5" />
          </svg>
          Nuevo análisis
        </button>
        <button
          onClick={handleCopy}
          className="btn-secondary flex items-center justify-center gap-2"
        >
          {copied ? '✓' : '\u{1F4CB}'} Copiar
        </button>
      </div>
    </div>
  );
}
