'use client';

import { useCallback } from 'react';
import { useDropzone, Accept } from 'react-dropzone';

interface UploadZoneProps {
  accept: Accept;
  files: File[];
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
  label: string;
  icon: string;
  singleFile?: boolean;
}

export default function UploadZone({
  accept,
  files,
  onFilesChange,
  maxFiles = 20,
  label,
  icon,
  singleFile = false,
}: UploadZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (singleFile) {
        onFilesChange(acceptedFiles.slice(0, 1));
      } else {
        onFilesChange([...files, ...acceptedFiles].slice(0, maxFiles));
      }
    },
    [singleFile, maxFiles, onFilesChange, files]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles: singleFile ? 1 : maxFiles,
    multiple: !singleFile,
  });

  const removeFile = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const isPdf = Object.keys(accept).includes('application/pdf');

  return (
    <div>
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
          transition-all duration-200 select-none
          ${isDragActive
            ? 'border-[#B7960C] bg-[#B7960C]/5 scale-[1.01]'
            : 'border-gray-200 hover:border-[#B7960C]/50 hover:bg-gray-50'
          }
          ${files.length > 0 && singleFile ? 'border-green-300 bg-green-50' : ''}
        `}
      >
        <input {...getInputProps()} />

        {files.length === 0 || !singleFile ? (
          <>
            <div className="text-3xl mb-2">{isDragActive ? '📂' : icon}</div>
            <p className="text-sm font-medium text-gray-600">
              {isDragActive ? 'Suelta aquí' : label}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {isPdf ? 'PDF' : 'JPG, PNG, HEIC, WebP'}
              {!singleFile && ` · Máx ${maxFiles} archivos`}
            </p>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-2xl">📄</span>
            <div className="text-left flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 truncate">{files[0].name}</p>
              <p className="text-xs text-gray-400">{(files[0].size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button
              onClick={(e) => removeFile(0, e)}
              className="w-6 h-6 rounded-full bg-gray-200 hover:bg-red-100 hover:text-red-500 
                         text-gray-500 text-xs flex items-center justify-center flex-shrink-0"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Image previews grid */}
      {!singleFile && files.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {files.slice(0, 20).map((file, idx) => {
            const url = URL.createObjectURL(file);
            return (
              <div key={idx} className="relative group rounded-xl overflow-hidden aspect-square bg-gray-100">
                {file.type.startsWith('image/') ? (
                  <img
                    src={url}
                    alt={`Foto ${idx + 1}`}
                    className="w-full h-full object-cover"
                    onLoad={() => URL.revokeObjectURL(url)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-2xl">📄</span>
                  </div>
                )}
                <button
                  onClick={(e) => removeFile(idx, e)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white
                             text-xs flex items-center justify-center opacity-0 group-hover:opacity-100
                             transition-opacity duration-150 hover:bg-red-500"
                >
                  ✕
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[9px]
                                text-center py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  #{idx + 1}
                </div>
              </div>
            );
          })}

          {/* Add more button */}
          {files.length < maxFiles && (
            <div {...getRootProps()}
                 className="aspect-square rounded-xl border-2 border-dashed border-gray-200 
                            flex items-center justify-center cursor-pointer hover:border-[#B7960C]/50
                            hover:bg-gray-50 transition-all">
              <input {...getInputProps()} />
              <span className="text-2xl text-gray-300">+</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}