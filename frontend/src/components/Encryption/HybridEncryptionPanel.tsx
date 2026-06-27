import React, { useState, useRef } from 'react';
import {
  CloudArrowUpIcon,
  LockClosedIcon,
  KeyIcon,
  DocumentIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { saveAs } from 'file-saver';
import { ZeroKnowledgeEncryption } from '../../crypto/zero_knowledge';

// ==================================================
// TYPES & INTERFACES
// ==================================================

interface HybridEncryptionPanelProps {
  onEncryptionComplete?: (result: any) => void;
  onDecryptionComplete?: (result: any) => void;
}

interface EncryptionState {
  isEncrypting: boolean;
  isDecrypting: boolean;
  progress: number;
  currentFile: string;
  error: string | null;
}

// ==================================================
// HYBRID ENCRYPTION PANEL COMPONENT
// ==================================================

const HybridEncryptionPanel: React.FC<HybridEncryptionPanelProps> = ({
  onEncryptionComplete,
  onDecryptionComplete
}) => {
  // State management
  const [mode, setMode] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [keyType, setKeyType] = useState<'X25519' | 'Kyber1024'>('X25519');
  const [publicKey, setPublicKey] = useState<string>('');
  const [privateKey, setPrivateKey] = useState<string>('');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [keyPair, setKeyPair] = useState<any>(null);
  const [encryptionState, setEncryptionState] = useState<EncryptionState>({
    isEncrypting: false,
    isDecrypting: false,
    progress: 0,
    currentFile: '',
    error: null
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==================================================
  // EVENT HANDLERS
  // ==================================================

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    setSelectedFiles(files);
    setEncryptionState(prev => ({ ...prev, error: null }));
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    setSelectedFiles(files);
    setEncryptionState(prev => ({ ...prev, error: null }));
  };

  const handleEncrypt = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      setEncryptionState(prev => ({ ...prev, error: 'Vui lòng chọn file để mã hóa' }));
      return;
    }

    if (!publicKey.trim()) {
      setEncryptionState(prev => ({ ...prev, error: 'Vui lòng nhập public key' }));
      return;
    }

    setEncryptionState(prev => ({ 
      ...prev, 
      isEncrypting: true, 
      progress: 0, 
      error: null 
    }));

    try {
      // Simulate encryption process
      for (let i = 0; i <= 100; i += 10) {
        setEncryptionState(prev => ({ 
          ...prev, 
          progress: i,
          currentFile: selectedFiles[0].name
        }));
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Simulate successful encryption
      const result = {
        filename: selectedFiles[0].name,
        algorithm: keyType,
        size: selectedFiles[0].size,
        timestamp: Date.now()
      };

      onEncryptionComplete?.(result);
      
      setEncryptionState(prev => ({ 
        ...prev, 
        isEncrypting: false, 
        progress: 100 
      }));

      // Reset form
      setSelectedFiles(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      setEncryptionState(prev => ({ 
        ...prev, 
        isEncrypting: false, 
        error: 'Lỗi trong quá trình mã hóa' 
      }));
    }
  };

  const handleDecrypt = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      setEncryptionState(prev => ({ ...prev, error: 'Vui lòng chọn file để giải mã' }));
      return;
    }

    if (!privateKey.trim()) {
      setEncryptionState(prev => ({ ...prev, error: 'Vui lòng nhập private key' }));
      return;
    }

    setEncryptionState(prev => ({ 
      ...prev, 
      isDecrypting: true, 
      progress: 0, 
      error: null 
    }));

    try {
      // Simulate decryption process
      for (let i = 0; i <= 100; i += 10) {
        setEncryptionState(prev => ({ 
          ...prev, 
          progress: i,
          currentFile: selectedFiles[0].name
        }));
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Simulate successful decryption
      const result = {
        filename: selectedFiles[0].name,
        algorithm: keyType,
        size: selectedFiles[0].size,
        timestamp: Date.now()
      };

      onDecryptionComplete?.(result);
      
      setEncryptionState(prev => ({ 
        ...prev, 
        isDecrypting: false, 
        progress: 100 
      }));

      // Reset form
      setSelectedFiles(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      setEncryptionState(prev => ({ 
        ...prev, 
        isDecrypting: false, 
        error: 'Lỗi trong quá trình giải mã' 
      }));
    }
  };

  const generateKeyPair = async () => {
    try {
      setEncryptionState(prev => ({ ...prev, isEncrypting: true, error: null }));

      const newKeyPair = await ZeroKnowledgeEncryption.generateKeyPair(keyType);
      setKeyPair(newKeyPair);
      setPublicKey(ZeroKnowledgeEncryption.arrayBufferToBase64(newKeyPair.publicKey));
      setPrivateKey(ZeroKnowledgeEncryption.arrayBufferToBase64(newKeyPair.privateKey));

      toast.success(`Đã tạo ${keyType} key pair thành công!`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setEncryptionState(prev => ({ ...prev, error: `Lỗi tạo key pair: ${errorMessage}` }));
      toast.error(`Lỗi tạo key pair: ${errorMessage}`);
    } finally {
      setEncryptionState(prev => ({ ...prev, isEncrypting: false }));
    }
  };

  // Utility functions
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`Đã copy ${label} vào clipboard`);
    }).catch(() => {
      toast.error(`Lỗi khi copy ${label}`);
    });
  };

  const downloadKey = (keyData: string, keyType: 'public' | 'private') => {
    let filename = `${keyType}_key_${Date.now()}`;
    let blob: Blob;
    if (keyType === 'public') {
      blob = new Blob([keyData], { type: 'text/plain' });
      filename += '.pub';
    } else {
      blob = new Blob([keyData], { type: 'text/plain' });
      filename += '.sk';
    }
    saveAs(blob, filename);
    toast.success(`Đã tải xuống ${keyType} key`);
  };

  return (
    <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-lg p-6">
      {/* Mode Selection */}
      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setMode('encrypt')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
            mode === 'encrypt'
              ? 'bg-primary-600 text-white'
              : 'bg-secondary-100 dark:bg-secondary-700 text-secondary-700 dark:text-secondary-300'
          }`}
        >
          <LockClosedIcon className="h-5 w-5 inline mr-2" />
          Mã Hóa
        </button>
        <button
          onClick={() => setMode('decrypt')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
            mode === 'decrypt'
              ? 'bg-primary-600 text-white'
              : 'bg-secondary-100 dark:bg-secondary-700 text-secondary-700 dark:text-secondary-300'
          }`}
        >
          <ShieldCheckIcon className="h-5 w-5 inline mr-2" />
          Giải Mã
        </button>
      </div>

      {/* Key Type Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
          Loại Key Encryption
        </label>
        <div className="flex space-x-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="X25519"
              checked={keyType === 'X25519'}
              onChange={(e) => setKeyType(e.target.value as 'X25519' | 'Kyber1024')}
              className="mr-2"
            />
            <span className="text-sm">X25519 (Classical)</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="Kyber1024"
              checked={keyType === 'Kyber1024'}
              onChange={(e) => setKeyType(e.target.value as 'X25519' | 'Kyber1024')}
              className="mr-2"
            />
            <span className="text-sm">Kyber1024 (Post-Quantum)</span>
          </label>
        </div>
      </div>

      {/* Key Management */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-medium text-secondary-900 dark:text-white">
            Quản Lý Key
          </h3>
          <button
            onClick={generateKeyPair}
            className="px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors text-sm"
          >
            <KeyIcon className="h-4 w-4 inline mr-1" />
            Tạo Key Pair
          </button>
        </div>

        {/* Key Display */}
        {keyPair && (
          <div className="space-y-4">
            <div className="p-3 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-md">
              <p className="text-sm text-success-800 dark:text-success-200 font-medium">
                ✅ {keyType} key pair đã được tạo thành công!
              </p>
            </div>

            {/* Public Key */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
                  Public Key
                </label>
                <div className="flex space-x-2">
                  <button
                    onClick={() => copyToClipboard(publicKey, 'public key')}
                    className="text-xs px-2 py-1 bg-secondary-100 dark:bg-secondary-700 text-secondary-700 dark:text-secondary-300 rounded hover:bg-secondary-200 dark:hover:bg-secondary-600 transition-colors"
                  >
                    <ClipboardDocumentIcon className="h-3 w-3 inline mr-1" />
                    Copy
                  </button>
                  <button
                    onClick={() => downloadKey(publicKey, 'public')}
                    className="text-xs px-2 py-1 bg-secondary-100 dark:bg-secondary-700 text-secondary-700 dark:text-secondary-300 rounded hover:bg-secondary-200 dark:hover:bg-secondary-600 transition-colors"
                  >
                    <ArrowDownTrayIcon className="h-3 w-3 inline mr-1" />
                    Download
                  </button>
                </div>
              </div>
              <textarea
                value={publicKey}
                readOnly
                className="w-full h-20 p-3 text-xs font-mono bg-secondary-50 dark:bg-secondary-700 border border-secondary-300 dark:border-secondary-600 rounded-md resize-none"
              />
            </div>

            {/* Private Key */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
                  Private Key
                </label>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                    className="text-xs px-2 py-1 bg-secondary-100 dark:bg-secondary-700 text-secondary-700 dark:text-secondary-300 rounded hover:bg-secondary-200 dark:hover:bg-secondary-600 transition-colors"
                  >
                    {showPrivateKey ? (
                      <><EyeSlashIcon className="h-3 w-3 inline mr-1" />Ẩn</>
                    ) : (
                      <><EyeIcon className="h-3 w-3 inline mr-1" />Hiện</>
                    )}
                  </button>
                  <button
                    onClick={() => copyToClipboard(privateKey, 'private key')}
                    className="text-xs px-2 py-1 bg-danger-100 dark:bg-danger-900/20 text-danger-700 dark:text-danger-300 rounded hover:bg-danger-200 dark:hover:bg-danger-900/30 transition-colors"
                  >
                    <ClipboardDocumentIcon className="h-3 w-3 inline mr-1" />
                    Copy
                  </button>
                  <button
                    onClick={() => downloadKey(privateKey, 'private')}
                    className="text-xs px-2 py-1 bg-danger-100 dark:bg-danger-900/20 text-danger-700 dark:text-danger-300 rounded hover:bg-danger-200 dark:hover:bg-danger-900/30 transition-colors"
                  >
                    <ArrowDownTrayIcon className="h-3 w-3 inline mr-1" />
                    Download
                  </button>
                </div>
              </div>
              <textarea
                value={showPrivateKey ? privateKey : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                readOnly
                className="w-full h-20 p-3 text-xs font-mono bg-secondary-50 dark:bg-secondary-700 border border-secondary-300 dark:border-secondary-600 rounded-md resize-none"
              />
            </div>
          </div>
        )}

        {/* Key Input for Encrypt/Decrypt */}
        {mode === 'encrypt' && !keyPair && (
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
              Public Key (để mã hóa)
            </label>
            <textarea
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="Nhập hoặc tạo public key..."
              className="w-full p-3 border border-secondary-300 dark:border-secondary-600 rounded-lg bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white"
              rows={3}
            />
          </div>
        )}

        {mode === 'decrypt' && (
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
              Private Key (để giải mã)
            </label>
            <textarea
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="Nhập private key để giải mã..."
              className="w-full p-3 border border-secondary-300 dark:border-secondary-600 rounded-lg bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white"
              rows={3}
            />
          </div>
        )}
      </div>

      {/* File Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="border-2 border-dashed border-secondary-300 dark:border-secondary-600 rounded-lg p-8 text-center mb-6 hover:border-primary-400 transition-colors"
      >
        <CloudArrowUpIcon className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
        <p className="text-secondary-600 dark:text-secondary-400 mb-2">
          Kéo thả file vào đây hoặc
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer transition-colors"
        >
          Chọn File
        </label>
      </div>

      {/* Selected Files */}
      {selectedFiles && selectedFiles.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
            File đã chọn:
          </h4>
          <div className="space-y-2">
            {Array.from(selectedFiles).map((file, index) => (
              <div key={index} className="flex items-center space-x-2 p-2 bg-secondary-50 dark:bg-secondary-700 rounded">
                <DocumentIcon className="h-5 w-5 text-secondary-500" />
                <span className="text-sm text-secondary-700 dark:text-secondary-300">{file.name}</span>
                <span className="text-xs text-secondary-500">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
      {encryptionState.error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-red-700 dark:text-red-400 text-sm">{encryptionState.error}</span>
          </div>
        </div>
      )}

      {/* Progress Display */}
      {(encryptionState.isEncrypting || encryptionState.isDecrypting) && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
              {encryptionState.isEncrypting ? 'Đang mã hóa...' : 'Đang giải mã...'}
            </span>
            <span className="text-sm text-secondary-500">{encryptionState.progress}%</span>
          </div>
          <div className="w-full bg-secondary-200 dark:bg-secondary-700 rounded-full h-2">
            <motion.div
              className="bg-primary-600 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${encryptionState.progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          {encryptionState.currentFile && (
            <p className="text-xs text-secondary-500 mt-1">
              Đang xử lý: {encryptionState.currentFile}
            </p>
          )}
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={mode === 'encrypt' ? handleEncrypt : handleDecrypt}
        disabled={encryptionState.isEncrypting || encryptionState.isDecrypting}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
          encryptionState.isEncrypting || encryptionState.isDecrypting
            ? 'bg-secondary-300 dark:bg-secondary-600 text-secondary-500 cursor-not-allowed'
            : mode === 'encrypt'
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {encryptionState.isEncrypting || encryptionState.isDecrypting
          ? (mode === 'encrypt' ? 'Đang mã hóa...' : 'Đang giải mã...')
          : (mode === 'encrypt' ? 'Bắt Đầu Mã Hóa' : 'Bắt Đầu Giải Mã')
        }
      </button>
    </div>
  );
};

export default HybridEncryptionPanel;
