import { useState, useRef } from 'react';

const UploadZone = ({ onUpload, multiple = true }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(file =>
      file.type === 'image/png'
    );

    if (files.length === 0) {
      alert('Please upload PNG files only');
      return;
    }

    setUploading(true);
    try {
      await onUpload(files);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files).filter(file =>
      file.type === 'image/png'
    );

    if (files.length === 0) {
      alert('Please select PNG files only');
      return;
    }

    setUploading(true);
    try {
      await onUpload(files);
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`
        relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
        transition-all duration-200
        ${isDragging
          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 scale-105'
          : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-gray-50 dark:hover:bg-gray-800/50'
        }
        ${uploading ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png"
        multiple={multiple}
        onChange={handleFileSelect}
        className="hidden"
      />

      {uploading ? (
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Uploading characters...</p>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <svg
              className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Upload Character Cards
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Drag & drop PNG character cards here, or click to browse
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Supports Character Card v2 format (.png)
          </p>
        </>
      )}
    </div>
  );
};

export default UploadZone;
