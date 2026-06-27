import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  DocumentArrowUpIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  FolderIcon,
  DocumentIcon,
  ArrowDownTrayIcon,
  CogIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { FileService } from '../services/file.service';
import SessionFileManager from '../utils/sessionFileManager';
import LoadingSpinner from '../components/UI/LoadingSpinner';

import EncryptionAlgorithmSelector from '../components/EncryptionAlgorithmSelector';
import ActivityService from '../services/activity.service';
import clsx from 'clsx';

// Import advanced crypto features
import { 
  MultiFileEncryption, 
  FolderEncryption, 
  ChunkedEncryption, 
  DigitalSignatures 
} from '../crypto/advanced_features';
import { ZeroKnowledgeEncryption } from '../crypto';

// ==================================================
// VALIDATION SCHEMA
// ==================================================

const encryptionSchema = z.object({
  algorithm: z.string().min(1, 'Vui lòng chọn thuật toán mã hóa'),
  password: z
    .string()
    .min(1, 'Mật khẩu không được để trống')
    .min(8, 'Mật khẩu phải có ít nhất 8 ký tự'),
  confirm_password: z
    .string()
    .min(1, 'Vui lòng xác nhận mật khẩu'),
  key_derivation: z.string().min(1, 'Vui lòng chọn key derivation function'),
  encryption_mode: z.string().min(1, 'Vui lòng chọn chế độ mã hóa'),
  chunk_size: z.number().optional(),
  enable_signature: z.boolean().optional(),
  signature_algorithm: z.string().optional(),
  use_key_wrap: z.boolean().optional(),
  key_wrap_algorithm: z.string().optional(),
}).refine(data => data.password === data.confirm_password, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirm_password'],
});

type EncryptionFormData = z.infer<typeof encryptionSchema>;

// ==================================================
// ADVANCED ENCRYPT PAGE COMPONENT
// ==================================================

const AdvancedEncryptPage: React.FC = () => {
  // ==================================================
  // STATE MANAGEMENT
  // ==================================================

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadStatus, setUploadStatus] = useState<Record<string, 'pending' | 'uploading' | 'completed' | 'error'>>({});
  // const [availableAlgorithms, setAvailableAlgorithms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Advanced features state
  const [encryptionMode, setEncryptionMode] = useState<'single' | 'multi' | 'folder'>('single');
  const [isLargeFile, setIsLargeFile] = useState(false);
  const [chunkSize, setChunkSize] = useState(5); // 5MB default
  const [enableSignature, setEnableSignature] = useState(false);
  const [signatureAlgorithm, setSignatureAlgorithm] = useState<'Ed25519' | 'Dilithium3' | 'Dilithium5'>('Ed25519');
  const [useKeyWrap, setUseKeyWrap] = useState(false);
  const [keyWrapAlgorithm, setKeyWrapAlgorithm] = useState<'X25519' | 'Kyber1024'>('X25519');
  const [signatureKeyPair, setSignatureKeyPair] = useState<any>(null);
  const [publicKey, setPublicKey] = useState<string>('');
  const [encryptedResults, setEncryptedResults] = useState<any[]>([]);
  const [hybridKeyPair, setHybridKeyPair] = useState<any>(null);

  // ==================================================
  // FORM SETUP
  // ==================================================

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = useForm<EncryptionFormData>({
    resolver: zodResolver(encryptionSchema),
    defaultValues: {
      algorithm: 'AES-256-GCM',
      password: '',
      confirm_password: '',
      key_derivation: 'Argon2id',
      encryption_mode: 'single',
      chunk_size: 5,
      enable_signature: false,
      signature_algorithm: 'Ed25519',
      use_key_wrap: false,
      key_wrap_algorithm: 'X25519',
    },
  });

  const watchPassword = watch('password');

  // ==================================================
  // DRAG & DROP SETUP
  // ==================================================

  const onDrop = (acceptedFiles: File[]) => {
    // Kiểm tra và phân loại files
    const files = acceptedFiles.map(file => ({
      ...file,
      isFolder: file.webkitRelativePath && file.webkitRelativePath.includes('/'),
      relativePath: file.webkitRelativePath || file.name
    }));

    // Xác định encryption mode
    if (files.length === 1 && !files[0].isFolder) {
      setEncryptionMode('single');
    } else if (files.length > 1 && !files.some(f => f.isFolder)) {
      setEncryptionMode('multi');
    } else if (files.some(f => f.isFolder)) {
      setEncryptionMode('folder');
    }

    // Kiểm tra file lớn
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    setIsLargeFile(totalSize > 50 * 1024 * 1024); // 50MB

    setSelectedFiles(acceptedFiles);
    
    // Reset progress
    const newProgress: Record<string, number> = {};
    const newStatus: Record<string, 'pending' | 'uploading' | 'completed' | 'error'> = {};
    
    acceptedFiles.forEach(file => {
      newProgress[file.name] = 0;
      newStatus[file.name] = 'pending';
    });
    
    setUploadProgress(newProgress);
    setUploadStatus(newStatus);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    noClick: false,
    noKeyboard: false,
  });

  // ==================================================
  // EFFECTS
  // ==================================================

  useEffect(() => {
    const fetchAlgorithms = async () => {
      try {
        // const algorithms = await DashboardService.getAvailableAlgorithms();
        // setAvailableAlgorithms(algorithms);
      } catch (error) {
        console.error('Error fetching algorithms:', error);
        toast.error('Không thể tải danh sách thuật toán');
      }
    };

    fetchAlgorithms();
  }, []);

  // Generate signature key pair when needed
  useEffect(() => {
    if (enableSignature && !signatureKeyPair) {
      generateSignatureKeyPair();
    }
  }, [enableSignature]);

  // ==================================================
  // UTILITY FUNCTIONS
  // ==================================================

  const generateSignatureKeyPair = async () => {
    try {
      const keyPair = await DigitalSignatures.generateSignatureKeyPair(signatureAlgorithm);
      setSignatureKeyPair(keyPair);
      setPublicKey(ZeroKnowledgeEncryption.arrayBufferToBase64(keyPair.publicKey));
      toast.success('Đã tạo key pair cho chữ ký số');
    } catch (error) {
      console.error('Error generating signature key pair:', error);
      toast.error('Không thể tạo key pair cho chữ ký số');
    }
  };

  const getPasswordStrength = (password: string) => {
    if (!password) return { score: 0, strength: 'weak', feedback: [] };
    
    let score = 0;
    const feedback: string[] = [];

    if (password.length >= 8) score += 1;
    else feedback.push('Mật khẩu phải có ít nhất 8 ký tự');

    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Cần có chữ thường');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Cần có chữ hoa');

    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('Cần có số');

    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    else feedback.push('Cần có ký tự đặc biệt');

    let strength: 'weak' | 'medium' | 'good' | 'strong';
    if (score <= 2) strength = 'weak';
    else if (score <= 3) strength = 'medium';
    else if (score <= 4) strength = 'good';
    else strength = 'strong';

    return { score, strength, feedback };
  };

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    setUploadProgress({});
    setUploadStatus({});
  };

  // Download encrypted file
  const downloadEncryptedFile = (encryptedResult: any) => {
    try {
      // Validate input
      if (!encryptedResult || !encryptedResult.metadata || !encryptedResult.encryptedData) {
        throw new Error('Dữ liệu mã hóa không hợp lệ');
      }

      // SECURITY DESIGN: Tạo file format bao gồm metadata + encrypted data
      // Format: [METADATA_LENGTH(4 bytes)][METADATA_JSON][ENCRYPTED_DATA]

      const metadataStr = JSON.stringify(encryptedResult.metadata);
      const metadataBytes = new TextEncoder().encode(metadataStr);
      const metadataLength = metadataBytes.length;

      // Validate encrypted data
      const encryptedData = encryptedResult.encryptedData;
      if (!encryptedData || encryptedData.length === 0) {
        throw new Error('Dữ liệu mã hóa trống');
      }

      // Tạo buffer chứa toàn bộ file
      const totalLength = 4 + metadataLength + encryptedData.length;
      const fileBuffer = new ArrayBuffer(totalLength);
      const view = new DataView(fileBuffer);
      const uint8View = new Uint8Array(fileBuffer);

      // Ghi metadata length (4 bytes)
      view.setUint32(0, metadataLength, true); // little-endian

      // Ghi metadata
      uint8View.set(metadataBytes, 4);

      // Ghi encrypted data
      uint8View.set(encryptedData, 4 + metadataLength);

      // Tạo blob từ buffer hoàn chỉnh
      const encryptedBlob = new Blob([fileBuffer], {
        type: 'application/octet-stream'
      });

      // Lấy tên file từ metadata hoặc originalName đã set
      const originalName = encryptedResult.originalName ||
                          encryptedResult.metadata?.filename ||
                          'encrypted_file';

      const url = URL.createObjectURL(encryptedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${originalName}.encrypted`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Đã tải xuống: ${originalName}.encrypted`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error(`Lỗi tải xuống file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Generate hybrid encryption key pair
  const generateHybridKeyPair = async () => {
    try {
      const keyPair = await ZeroKnowledgeEncryption.generateKeyPair('X25519');
      setHybridKeyPair(keyPair);
      toast.success('Đã tạo key pair cho mã hóa lai thành công!');
    } catch (error) {
      toast.error(`Lỗi tạo key pair: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Download hybrid key pair
  const downloadHybridKeyPair = () => {
    if (!hybridKeyPair) {
      toast.error('Chưa có key pair để tải xuống');
      return;
    }

    try {
      const exportedKeys = ZeroKnowledgeEncryption.exportKeyPairToFiles(hybridKeyPair);

      // Download public key
      const publicUrl = URL.createObjectURL(exportedKeys.publicKeyFile);
      const publicLink = document.createElement('a');
      publicLink.href = publicUrl;
      publicLink.download = exportedKeys.publicKeyFilename;
      document.body.appendChild(publicLink);
      publicLink.click();
      document.body.removeChild(publicLink);
      URL.revokeObjectURL(publicUrl);

      // Download private key
      const privateUrl = URL.createObjectURL(exportedKeys.privateKeyFile);
      const privateLink = document.createElement('a');
      privateLink.href = privateUrl;
      privateLink.download = exportedKeys.privateKeyFilename;
      document.body.appendChild(privateLink);
      privateLink.click();
      document.body.removeChild(privateLink);
      URL.revokeObjectURL(privateUrl);

      toast.success('Đã tải xuống key pair thành công!');
    } catch (error) {
      toast.error(`Lỗi tải xuống key pair: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // ==================================================
  // ENCRYPTION LOGIC
  // ==================================================

  const encryptFiles = async (data: EncryptionFormData) => {
    const options = {
      algorithm: data.algorithm as any,
      password: data.password,
      keyDerivation: data.key_derivation as any,
      chunkSize: data.chunk_size ? data.chunk_size * 1024 * 1024 : 5 * 1024 * 1024,
      enableSigning: data.enable_signature,
      signingAlgorithm: data.signature_algorithm as any,
      privateKey: signatureKeyPair?.privateKey,
      useKeyWrap: data.use_key_wrap,
      keyWrapAlgorithm: data.key_wrap_algorithm as any,
      publicKey: publicKey ? ZeroKnowledgeEncryption.base64ToArrayBuffer(publicKey) : undefined,
    };

    try {
      let result: any;

      switch (encryptionMode) {
        case 'single':
          if (isLargeFile) {
            result = await ChunkedEncryption.encryptLargeFile(selectedFiles[0], options);
          } else {
            result = await ZeroKnowledgeEncryption.encryptFile(selectedFiles[0], options);
          }
          break;

        case 'multi':
          result = await MultiFileEncryption.encryptMultipleFiles(selectedFiles, options);
          break;

        case 'folder':
          const folderName = selectedFiles[0]?.webkitRelativePath?.split('/')[0] || 'folder';
          result = await FolderEncryption.encryptFolder(selectedFiles, folderName, options);
          break;

        default:
          throw new Error('Chế độ mã hóa không hợp lệ');
      }

      return result;
    } catch (error) {
      console.error('Encryption error:', error);
      throw error;
    }
  };

  // ==================================================
  // FORM SUBMISSION
  // ==================================================

  const onSubmit = async (data: EncryptionFormData) => {
    if (selectedFiles.length === 0) {
      toast.error('Vui lòng chọn file để mã hóa');
      return;
    }

    setIsLoading(true);

    try {
      // Cập nhật progress
      selectedFiles.forEach(file => {
        setUploadStatus(prev => ({ ...prev, [file.name]: 'uploading' }));
      });

      // Mã hóa files
      const encryptionResult = await encryptFiles(data);

      // Save encrypted result for download
      const encryptedFileInfo = {
        id: Date.now().toString(),
        originalName: selectedFiles[0]?.name || 'encrypted_file',
        encryptedData: encryptionResult.encryptedData,
        metadata: encryptionResult.metadata,
        timestamp: new Date().toISOString(),
        algorithm: data.algorithm,
        mode: encryptionMode
      };

      console.log('Adding encrypted file to results:', encryptedFileInfo);
      setEncryptedResults(prev => {
        const newResults = [...prev, encryptedFileInfo];
        console.log('Updated encryptedResults:', newResults);
        console.log('Download section should now be visible');
        return newResults;
      });

      // Log hybrid encryption activity
      try {
        await ActivityService.logEncryption(
          selectedFiles[0]?.name || 'unknown file',
          `Hybrid (${keyWrapAlgorithm === 'X25519' ? 'X25519+AES' : 'Kyber1024+XChaCha20'})`,
          'hybrid',
          selectedFiles[0]?.size || 0,
          true
        );
      } catch (error) {
        console.warn('Failed to log hybrid encryption activity:', error);
      }

      // Show success message for download availability
      toast.success('✅ File đã mã hóa thành công! Scroll xuống để tải file đã mã hóa.', {
        duration: 5000,
        position: 'top-center'
      });

      // Auto scroll to download section after a short delay
      setTimeout(() => {
        const downloadSection = document.querySelector('[data-download-section]');
        if (downloadSection) {
          console.log('Scrolling to download section');
          downloadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

          // Add a highlight effect to make it more visible
          downloadSection.classList.add('ring-2', 'ring-primary-500', 'ring-opacity-50');
          setTimeout(() => {
            downloadSection.classList.remove('ring-2', 'ring-primary-500', 'ring-opacity-50');
          }, 3000);
        } else {
          console.warn('Download section not found in DOM');
        }
      }, 1500);

      // Save to session storage for Files page
      try {
        SessionFileManager.addFile({
          filename: encryptionResult.metadata.filename || encryptedFileInfo.originalName,
          originalName: encryptedFileInfo.originalName,
          encryptedData: encryptionResult.encryptedData,
          metadata: encryptionResult.metadata,
          algorithm: data.algorithm,
          mode: encryptionMode,
          size: encryptionResult.encryptedData.length,
          type: 'encrypted'
        });
      } catch (error) {
        console.warn('Failed to save to session storage:', error);
      }

      // Upload lên server
      const uploadPromises = selectedFiles.map(async (file) => {
        try {
          const formData = new FormData();
          formData.append('file', new Blob([encryptionResult.encryptedData]));
          formData.append('metadata', JSON.stringify(encryptionResult.metadata));

          await FileService.uploadAndEncryptFile(file, {
            algorithm: data.algorithm,
            password: data.password,
            key_derivation: data.key_derivation,
            use_key_wrap: data.use_key_wrap,
            key_wrap_algorithm: data.key_wrap_algorithm,
            signature_algorithm: data.signature_algorithm
          }, (progress: number) => {
            setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
          });

          setUploadStatus(prev => ({ ...prev, [file.name]: 'completed' }));
          toast.success(`Mã hóa thành công: ${file.name}`);

          return { file, status: 'success' };
        } catch (error) {
          setUploadStatus(prev => ({ ...prev, [file.name]: 'error' }));
          toast.error(`Lỗi upload: ${file.name}`);
          return { file, status: 'error', error };
        }
      });

      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter(r => r.status === 'success');

      if (successfulUploads.length > 0) {
        toast.success(`Đã mã hóa và upload thành công ${successfulUploads.length} file`);
      }

    } catch (error) {
      console.error('Encryption/upload error:', error);

      // Log encryption failure
      try {
        const fileName = selectedFiles[0]?.name || 'unknown file';
        await ActivityService.logEncryption(
          fileName,
          `Hybrid (${keyWrapAlgorithm === 'X25519' ? 'X25519+AES' : 'Kyber1024+XChaCha20'})`,
          'hybrid',
          selectedFiles.reduce((total, file) => total + file.size, 0),
          false,
          error instanceof Error ? error.message : 'Unknown hybrid encryption error'
        );
      } catch (logError) {
        console.warn('Failed to log hybrid encryption failure:', logError);
      }

      toast.error('Có lỗi xảy ra trong quá trình mã hóa');
    } finally {
      setIsLoading(false);
    }
  };

  // ==================================================
  // RENDER FUNCTIONS
  // ==================================================

  const renderFileList = () => {
    if (selectedFiles.length === 0) return null;

    return (
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Files đã chọn ({selectedFiles.length})
          </h3>
          <button
            onClick={clearAllFiles}
            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            Xóa tất cả
          </button>
        </div>

        <div className="space-y-3">
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <DocumentIcon className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {ZeroKnowledgeEncryption.formatFileSize(file.size)}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {uploadStatus[file.name] === 'uploading' && (
                  <div className="flex items-center space-x-2">
                    <LoadingSpinner size="small" />
                    <span className="text-xs text-gray-500">
                      {uploadProgress[file.name]}%
                    </span>
                  </div>
                )}

                {uploadStatus[file.name] === 'completed' && (
                  <CheckCircleIcon className="h-5 w-5 text-green-500" />
                )}

                {uploadStatus[file.name] === 'error' && (
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                )}

                <button
                  onClick={() => removeFile(index)}
                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderAdvancedOptions = () => (
    <div className="mt-6 space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
        <CogIcon className="h-5 w-5 mr-2" />
        Tùy chọn nâng cao
      </h3>

      {/* Encryption Mode */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Chế độ mã hóa
        </label>
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setEncryptionMode('single')}
            className={clsx(
              'p-3 border rounded-lg text-sm font-medium transition-colors',
              encryptionMode === 'single'
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                : 'border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300'
            )}
          >
            <DocumentIcon className="h-4 w-4 mx-auto mb-1" />
            File đơn
          </button>
          <button
            type="button"
            onClick={() => setEncryptionMode('multi')}
            className={clsx(
              'p-3 border rounded-lg text-sm font-medium transition-colors',
              encryptionMode === 'multi'
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                : 'border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300'
            )}
          >
            <DocumentIcon className="h-4 w-4 mx-auto mb-1" />
            Nhiều file
          </button>
          <button
            type="button"
            onClick={() => setEncryptionMode('folder')}
            className={clsx(
              'p-3 border rounded-lg text-sm font-medium transition-colors',
              encryptionMode === 'folder'
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                : 'border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300'
            )}
          >
            <FolderIcon className="h-4 w-4 mx-auto mb-1" />
            Thư mục
          </button>
        </div>
      </div>

      {/* Large File Chunking */}
      {isLargeFile && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Kích thước chunk (MB)
          </label>
          <input
            type="range"
            min="1"
            max="50"
            value={chunkSize}
            onChange={(e) => setChunkSize(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1MB</span>
            <span>{chunkSize}MB</span>
            <span>50MB</span>
          </div>
        </div>
      )}

      {/* Digital Signatures */}
      <div className="flex items-center space-x-3">
        <input
          type="checkbox"
          id="enable_signature"
          checked={enableSignature}
          onChange={(e) => setEnableSignature(e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="enable_signature" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Ký số file
        </label>
      </div>

      {enableSignature && (
        <div className="ml-6 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Thuật toán ký số
            </label>
            <select
              value={signatureAlgorithm}
              onChange={(e) => setSignatureAlgorithm(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="Ed25519">Ed25519 (Classic)</option>
              <option value="Dilithium3">Dilithium3 (PQC)</option>
              <option value="Dilithium5">Dilithium5 (PQC)</option>
            </select>
          </div>

          {signatureKeyPair && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm text-green-700 dark:text-green-300">
                ✅ Key pair đã được tạo
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                Public Key: {publicKey.substring(0, 32)}...
              </p>
            </div>
          )}
        </div>
      )}

      {/* Hybrid Encryption */}
      <div className="flex items-center space-x-3">
        <input
          type="checkbox"
          id="use_key_wrap"
          checked={useKeyWrap}
          onChange={(e) => setUseKeyWrap(e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="use_key_wrap" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Mã hóa lai (Key Wrapping)
        </label>
      </div>

      {useKeyWrap && (
        <div className="ml-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Thuật toán key wrapping
            </label>
            <select
              value={keyWrapAlgorithm}
              onChange={(e) => setKeyWrapAlgorithm(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="X25519">X25519 (Classic)</option>
              <option value="Kyber1024">Kyber1024 (PQC)</option>
            </select>
          </div>

          {/* Key Pair Generation */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Key Pair cho mã hóa lai
              </label>
              <button
                type="button"
                onClick={generateHybridKeyPair}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Tạo Key Pair
              </button>
            </div>

            {hybridKeyPair && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                    ✅ Key pair đã được tạo thành công! ({keyWrapAlgorithm})
                  </p>
                  <button
                    type="button"
                    onClick={downloadHybridKeyPair}
                    className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    <ArrowDownTrayIcon className="h-3 w-3 inline mr-1" />
                    Tải Key Pair
                  </button>
                </div>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Key ID: {hybridKeyPair.keyId?.substring(0, 8)}...
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // ==================================================
  // MAIN RENDER
  // ==================================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Mã hóa File Nâng cao
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Hỗ trợ multi-file, folder, chunking, hybrid encryption và digital signatures
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          {/* File Upload Area */}
          <div
            {...getRootProps()}
            className={clsx(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              isDragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500'
            )}
          >
            <input {...getInputProps()} />
            <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {isDragActive ? 'Thả file vào đây' : 'Kéo thả file hoặc click để chọn'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Hỗ trợ file đơn, nhiều file, hoặc thư mục hoàn chỉnh
            </p>
          </div>



          {/* File List */}
          {renderFileList()}

          {/* Encryption Form */}
          {selectedFiles.length > 0 && (
            <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
              {/* Basic Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Algorithm Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Thuật toán mã hóa
                  </label>
                                  <EncryptionAlgorithmSelector
                    selectedAlgorithm={watch('algorithm')}
                    onAlgorithmChange={(value: string) => setValue('algorithm', value)}
                />
                </div>

                {/* Key Derivation */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Key Derivation Function
                  </label>
                  <select
                    {...register('key_derivation')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="Argon2id">Argon2id (Recommended)</option>
                    <option value="PBKDF2">PBKDF2</option>
                    <option value="Scrypt">Scrypt</option>
                  </select>
                </div>
              </div>

              {/* Password Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      {...register('password')}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Nhập mật khẩu"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.password.message}
                    </p>
                  )}
                  
                  {/* Password Strength */}
                  {watchPassword && (
                    <div className="mt-2">
                      <div className="flex space-x-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={clsx(
                              'h-2 flex-1 rounded',
                              getPasswordStrength(watchPassword).score >= level
                                ? 'bg-green-500'
                                : 'bg-gray-200 dark:bg-gray-700'
                            )}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Độ mạnh: {getPasswordStrength(watchPassword).strength}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Xác nhận mật khẩu
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      {...register('confirm_password')}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Nhập lại mật khẩu"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showConfirmPassword ? (
                        <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {errors.confirm_password && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.confirm_password.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Advanced Options */}
              {renderAdvancedOptions()}

              {/* Submit Button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting || isLoading}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting || isLoading ? (
                    <>
                      <LoadingSpinner size="small" className="mr-2" />
                      Đang mã hóa...
                    </>
                  ) : (
                    <>
                      <LockClosedIcon className="h-5 w-5 mr-2" />
                      Mã hóa và Upload
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Success Banner */}
        {encryptedResults.length > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mt-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                  Mã hóa thành công!
                </h3>
                <div className="mt-1 text-sm text-green-700 dark:text-green-300">
                  <p>File của bạn đã được mã hóa an toàn. Bạn có thể tải xuống file đã mã hóa bên dưới.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Download Section */}
        {encryptedResults.length > 0 && (
          <div data-download-section className="bg-white dark:bg-secondary-800 rounded-lg shadow-lg p-4 sm:p-6 mt-4 border-2 border-primary-200 dark:border-primary-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">
                File Đã Mã Hóa
              </h3>
              <span className="text-sm text-secondary-500 dark:text-secondary-400">
                {encryptedResults.length} file
              </span>
            </div>

            <div className="space-y-3">
              {encryptedResults.map((encryptedFile, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border border-secondary-200 dark:border-secondary-600 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <DocumentIcon className="h-8 w-8 text-primary-600 dark:text-primary-400" />
                    <div>
                      <p className="text-sm font-medium text-secondary-900 dark:text-white">
                        {encryptedFile.originalName}
                      </p>
                      <p className="text-xs text-secondary-500 dark:text-secondary-400">
                        {encryptedFile.algorithm} • {encryptedFile.mode} • {new Date(encryptedFile.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => downloadEncryptedFile(encryptedFile)}
                    className="flex items-center px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                    Tải Xuống
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Algorithm Information Section */}
      <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-lg p-6 mt-6">
        <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">
          Giới thiệu về Mã hóa Lai (Hybrid Encryption)
        </h3>

        <div className="grid md:grid-cols-2 gap-6">
          {/* X25519 + AES */}
          <div className="border border-secondary-200 dark:border-secondary-700 rounded-lg p-4">
            <h4 className="text-md font-medium text-primary-600 dark:text-primary-400 mb-2">
              X25519 + AES-256-GCM
            </h4>
            <div className="text-sm text-secondary-600 dark:text-secondary-400 space-y-2">
              <p><strong>X25519:</strong> Thuật toán trao đổi khóa dựa trên đường cong elliptic Curve25519, được thiết kế bởi Daniel J. Bernstein.</p>
              <p><strong>Ưu điểm:</strong></p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>Hiệu suất cao, tốc độ nhanh</li>
                <li>Bảo mật mạnh với khóa 256-bit</li>
                <li>Kháng các cuộc tấn công timing</li>
                <li>Được sử dụng rộng rãi (TLS 1.3, Signal, WhatsApp)</li>
              </ul>
              <p><strong>AES-256-GCM:</strong> Mã hóa đối xứng với xác thực tích hợp, đảm bảo cả tính bảo mật và toàn vẹn dữ liệu.</p>
            </div>
          </div>

          {/* Kyber1024 + XChaCha20 */}
          <div className="border border-secondary-200 dark:border-secondary-700 rounded-lg p-4">
            <h4 className="text-md font-medium text-purple-600 dark:text-purple-400 mb-2">
              Kyber1024 + XChaCha20-Poly1305
            </h4>
            <div className="text-sm text-secondary-600 dark:text-secondary-400 space-y-2">
              <p><strong>Kyber1024:</strong> Thuật toán mã hóa hậu lượng tử (Post-Quantum Cryptography) được NIST chuẩn hóa.</p>
              <p><strong>Ưu điểm:</strong></p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>Kháng lại máy tính lượng tử</li>
                <li>Bảo mật dài hạn cho tương lai</li>
                <li>Hiệu suất tốt cho PQC</li>
                <li>Chuẩn NIST ML-KEM</li>
              </ul>
              <p><strong>XChaCha20-Poly1305:</strong> Mã hóa stream với nonce mở rộng 192-bit, phù hợp cho dữ liệu lớn và bảo mật cao.</p>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-800 rounded-md">
          <p className="text-sm text-info-800 dark:text-info-200">
            <strong>💡 Lưu ý:</strong> Mã hóa lai kết hợp ưu điểm của mã hóa bất đối xứng (quản lý khóa an toàn) và mã hóa đối xứng (hiệu suất cao).
            Khóa đối xứng ngẫu nhiên được tạo để mã hóa dữ liệu, sau đó khóa này được mã hóa bằng public key của người nhận.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdvancedEncryptPage;
