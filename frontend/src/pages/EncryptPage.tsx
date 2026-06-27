import React, { useState, useEffect, useRef } from 'react';
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
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

import ApiClient from '../lib/api';
import { statePersistence } from '../utils/storage';
import SessionFileManager from '../utils/sessionFileManager';
import LoadingSpinner from '../components/UI/LoadingSpinner';

import EncryptionAlgorithmSelector from '../components/EncryptionAlgorithmSelector';
import ActivityService from '../services/activity.service';
import clsx from 'clsx';

// Import advanced crypto features
import { 
  FolderEncryption, 
  ChunkedEncryption, 
  DigitalSignatures 
} from '../crypto/advanced_features';
import { ZeroKnowledgeEncryption } from '../crypto';

// ==================================================
// VALIDATION SCHEMA - Schema validation với Zod
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
// ENCRYPT PAGE COMPONENT - Trang mã hóa file
// ==================================================

/**
 * EncryptPage Component - Trang upload và mã hóa file với advanced features
 * 
 * Advanced Features:
 * 1. Multi-file encryption
 * 2. Folder/Directory encryption
 * 3. Large file chunking
 * 4. Hybrid encryption (key wrapping)
 * 5. Digital signatures
 * 6. Progress tracking cho từng feature
 */
const EncryptPage: React.FC = () => {
  // ==================================================
  // STATE MANAGEMENT - Quản lý state
  // ==================================================

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadStatus, setUploadStatus] = useState<Record<string, 'pending' | 'uploading' | 'completed' | 'error'>>({});
  const [encryptedResults, setEncryptedResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // File picker refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  
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
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // ==================================================
  // FORM SETUP - Thiết lập form
  // ==================================================

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
    reset,
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
  // STATE PERSISTENCE - Lưu trữ trạng thái
  // ==================================================

  // Restore state on component mount
  useEffect(() => {
    const savedState = statePersistence.restoreWorkState('encrypt');
    if (savedState) {
      setEncryptionMode(savedState.encryptionMode || 'single');
      // Ẩn tùy chọn nâng cao mặc định
      setShowAdvancedOptions(false);
      setEnableSignature(savedState.enableSignature || false);
      setUseKeyWrap(savedState.useKeyWrap || false);

      // Restore form values
      if (savedState.algorithm) setValue('algorithm', savedState.algorithm);
      if (savedState.kdf) setValue('key_derivation', savedState.kdf);
    }
  }, [setValue]);

  // Save state when component unmounts or user navigates away
  useEffect(() => {
    const saveCurrentState = () => {
      const currentState = {
        encryptionMode,
        showAdvancedOptions,
        enableSignature,
        useKeyWrap,
        algorithm: watch('algorithm'),
        kdf: watch('key_derivation'),
        selectedFilesCount: selectedFiles.length,
      };
      statePersistence.saveWorkState('encrypt', currentState);
    };

    const handleBeforeUnload = () => saveCurrentState();
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      saveCurrentState();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [encryptionMode, showAdvancedOptions, enableSignature, useKeyWrap, selectedFiles.length, watch]);

  // ==================================================
  // DRAG & DROP SETUP - Thiết lập drag & drop
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
  });

  // ==================================================
  // EFFECTS - Side effects
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
  // UTILITY FUNCTIONS - Các hàm tiện ích
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

  // File picker functions
  const handleFilePickerClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFolderPickerClick = () => {
    if (folderInputRef.current) {
      folderInputRef.current.click();
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      onDrop(files);
    }
  };

  const handleFolderInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setEncryptionMode('folder');
      onDrop(files);
    }
  };

  // Download encrypted file
  const downloadEncryptedFile = (encryptedResult: any) => {
    try {
      console.log('Download request for:', encryptedResult);

      // Enhanced validation
      if (!encryptedResult) {
        throw new Error('Không có dữ liệu để tải xuống');
      }

      if (!encryptedResult.metadata) {
        throw new Error('Thiếu metadata - file có thể bị hỏng');
      }

      // Check for encryptedData or encryptedBlob
      let encryptedData = encryptedResult.encryptedData;

      // Fallback: if encryptedBlob exists, convert to Uint8Array
      if (!encryptedData && encryptedResult.encryptedBlob) {
        console.log('Converting encryptedBlob to encryptedData');
        // This will be handled asynchronously
        encryptedResult.encryptedBlob.arrayBuffer().then(buffer => {
          const newResult = {
            ...encryptedResult,
            encryptedData: new Uint8Array(buffer)
          };
          downloadEncryptedFile(newResult);
        });
        return;
      }

      if (!encryptedData) {
        throw new Error('Không tìm thấy dữ liệu mã hóa (encryptedData hoặc encryptedBlob)');
      }

      if (encryptedData.length === 0) {
        throw new Error('Dữ liệu mã hóa trống - quá trình mã hóa có thể thất bại');
      }

      // SECURITY DESIGN: Tạo file format bao gồm metadata + encrypted data
      // Format: [METADATA_LENGTH(4 bytes)][METADATA_JSON][ENCRYPTED_DATA]

      const metadataStr = JSON.stringify(encryptedResult.metadata);
      const metadataBytes = new TextEncoder().encode(metadataStr);
      const metadataLength = metadataBytes.length;

      console.log(`Creating download file: metadata=${metadataLength} bytes, encrypted=${encryptedData.length} bytes`);

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

  // Clear all results and reset form
  const clearAllResults = () => {
    setSelectedFiles([]);
    setEncryptedResults([]);
    setUploadStatus({});
    setUploadProgress({});
    reset();

    // Clear file inputs
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';

    toast.success('Đã xóa tất cả kết quả');
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

  // ==================================================
  // ENCRYPTION LOGIC - Logic mã hóa
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

        case 'multi': {
          // SECURITY DESIGN: Mã hóa từng file riêng biệt để tăng bảo mật
          const multiResults = [];
          for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            
            // Update progress for each file
            setUploadProgress({ [file.name]: Math.round((i / selectedFiles.length) * 50) });
            
            // Encrypt each file individually with full security
            const singleResult = await ZeroKnowledgeEncryption.encryptFile(file, {
              ...options,
              // Ensure each file gets unique salt/IV for maximum security
            });
            
            // Mark as part of multi-file batch for identification
            singleResult.metadata.encryptionMode = 'multi';
            singleResult.metadata.multiFileInfo = {
              fileCount: selectedFiles.length,
              files: [{
                name: file.name,
                size: file.size,
                checksum: '',
                index: i
              }]
            };
            
            multiResults.push(singleResult);
            setUploadProgress({ [file.name]: Math.round(((i + 1) / selectedFiles.length) * 100) });
          }
          
          result = {
            results: multiResults,
            mode: 'multi',
            totalFiles: selectedFiles.length
          };
          break;
        }

        case 'folder': {
          const folderName = selectedFiles[0]?.webkitRelativePath?.split('/')[0] || 'folder';
          result = await FolderEncryption.encryptFolder(selectedFiles, folderName, options);
          // Set originalName để download với tên đúng
          result.originalName = folderName;
          break;
        }

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
  // FORM SUBMISSION - Xử lý submit form
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

      // Handle different encryption modes
      if (encryptionMode === 'multi') {
        // Multi-file: từng file đã được mã hóa riêng biệt
        selectedFiles.forEach(file => {
          setUploadStatus(prev => ({ ...prev, [file.name]: 'completed' }));
          setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
        });
        
        // Tạo display results cho từng file
        const displayResults = encryptionResult.results.map((result, index) => ({
          ...result,
          originalName: selectedFiles[index].name,
          algorithm: result.metadata.algorithm,
          mode: 'multi',
          timestamp: result.metadata.timestamp
        }));

        setEncryptedResults(displayResults);

        // Save each multi-batch file to session storage for Files page
        try {
          encryptionResult.results.forEach((result, index) => {
            SessionFileManager.addFile({
              filename: result.metadata.filename || selectedFiles[index].name,
              originalName: selectedFiles[index].name,
              encryptedData: result.encryptedData,
              metadata: result.metadata,
              algorithm: data.algorithm,
              mode: 'multi',
              size: result.encryptedData.length,
              type: 'encrypted'
            });
          });
        } catch (error) {
          console.warn('Failed to save multi-batch files to session storage:', error);
        }

        // Log activity for multi-file encryption
        try {
          await ActivityService.logEncryption(
            `${selectedFiles.length} files`,
            data.algorithm,
            'multi',
            selectedFiles.reduce((total, file) => total + file.size, 0),
            true
          );
        } catch (error) {
          console.warn('Failed to log multi-file encryption activity:', error);
        }

        toast.success(`Đã mã hóa thành công ${selectedFiles.length} file riêng biệt! Mỗi file có bảo mật độc lập.`);
        setIsLoading(false);
        return; // Không upload lên server cho multi-file mode
      }

      // Single file hoặc folder: upload to server (use unified backend endpoint)
      try {
        const formData = new FormData();

        // Create blob from encrypted data
        const encryptedBlob = new Blob([encryptionResult.encryptedData], {
          type: 'application/octet-stream'
        });

        // Filename: use original if available, hoặc folder name cho folder mode
        let uploadFilename;
        if (encryptionMode === 'folder') {
          const folderName = selectedFiles[0]?.webkitRelativePath?.split('/')[0] || 'folder';
          uploadFilename = `${folderName}_encrypted_${Date.now()}.zip`;
        } else {
          uploadFilename = selectedFiles[0]?.name || `encrypted_${Date.now()}.enc`;
        }
        formData.append('file', encryptedBlob, uploadFilename);

        // Build encryption metadata according to backend schema
        const encMeta = {
          encryption_algorithm: data.algorithm,
          key_derivation_function: data.key_derivation,
          use_key_wrap: useKeyWrap || false,
          key_wrap_algorithm: useKeyWrap ? (keyWrapAlgorithm as any) : undefined,
          public_key: publicKey || undefined,
          wrapped_key: encryptionResult?.metadata?.wrapped_key || encryptionResult?.metadata?.wrappedKey,
          salt: encryptionResult?.metadata?.salt,
          iv: encryptionResult?.metadata?.iv,
          checksum: encryptionResult?.metadata?.checksum,
          signature_algorithm: enableSignature ? (signatureAlgorithm as any) : undefined,
          signature: encryptionResult?.metadata?.signature,
          public_key_signature: encryptionResult?.metadata?.public_key_signature,
          description: undefined,
          tags: [] as string[],
        };
        formData.append('encryption_data', JSON.stringify(encMeta));

        // Upload via ApiClient (baseURL already includes /api)
        const result = await ApiClient.uploadFile<any>('/encrypted/upload', formData, (p) => {
          // Map 0-100 to remaining 50% if needed (optional)
          // setUploadProgress(prev => ({ ...prev, [uploadFilename]: p }));
        });

        // Update status for all files
        selectedFiles.forEach(file => {
          setUploadStatus(prev => ({ ...prev, [file.name]: 'completed' }));
        });

        // Save encrypted result for download and session storage
        const encryptedFileInfo = {
          id: (result as any).file_id || Date.now().toString(),
          originalName: selectedFiles[0]?.name || 'encrypted_file',
          encryptedData: encryptionResult.encryptedData,
          metadata: encryptionResult.metadata,
          timestamp: new Date().toISOString(),
          algorithm: data.algorithm,
          mode: encryptionMode
        };

        setEncryptedResults(prev => [...prev, encryptedFileInfo]);

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

        // Log activity for single file/folder encryption
        try {
          const fileName = encryptionMode === 'folder'
            ? `${selectedFiles[0]?.webkitRelativePath?.split('/')[0] || 'folder'} (folder)`
            : selectedFiles[0]?.name || 'file';

          await ActivityService.logEncryption(
            fileName,
            data.algorithm,
            encryptionMode === 'folder' ? 'folder' : 'single',
            selectedFiles.reduce((total, file) => total + file.size, 0),
            true
          );
        } catch (error) {
          console.warn('Failed to log encryption activity:', error);
        }

        toast.success(`Đã mã hóa và upload thành công ${selectedFiles.length} file`);

        // Don't clear form immediately - let user download first
        // setSelectedFiles([]);
        // reset();

      } catch (uploadError) {
        console.error('Upload error:', uploadError);
        selectedFiles.forEach(file => {
          setUploadStatus(prev => ({ ...prev, [file.name]: 'error' }));
        });
        toast.error('Lỗi upload file đã mã hóa');
      }

    } catch (error) {
      console.error('Encryption error:', error);

      // Log encryption failure
      try {
        const fileName = selectedFiles[0]?.name || 'unknown file';
        await ActivityService.logEncryption(
          fileName,
          data.algorithm,
          encryptionMode === 'folder' ? 'folder' : encryptionMode === 'multi' ? 'multi' : 'single',
          selectedFiles.reduce((total, file) => total + file.size, 0),
          false,
          error instanceof Error ? error.message : 'Unknown encryption error'
        );
      } catch (logError) {
        console.warn('Failed to log encryption failure:', logError);
      }

      selectedFiles.forEach(file => {
        setUploadStatus(prev => ({ ...prev, [file.name]: 'error' }));
      });
      toast.error('Có lỗi xảy ra trong quá trình mã hóa');
    } finally {
      setIsLoading(false);
    }
  };

  // ==================================================
  // RENDER FUNCTIONS - Các hàm render
  // ==================================================

  const renderFileList = () => {
    if (selectedFiles.length === 0) return null;

      return (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">
              Files đã chọn ({selectedFiles.length})
            </h3>
            <button
              onClick={clearAllFiles}
              className="text-danger-600 hover:text-danger-800 dark:text-danger-400 dark:hover:text-danger-300"
            >
              Xóa tất cả
            </button>
          </div>

          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-secondary-50 dark:bg-secondary-800 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <DocumentIcon className="h-5 w-5 text-primary-500" />
                  <div>
                    <p className="text-sm font-medium text-secondary-900 dark:text-white">
                      {file.name}
                    </p>
                    <p className="text-xs text-secondary-500 dark:text-secondary-400">
                      {ZeroKnowledgeEncryption.formatFileSize(file.size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {uploadStatus[file.name] === 'uploading' && (
                    <div className="flex items-center space-x-2">
                      <LoadingSpinner size="small" />
                      <span className="text-xs text-secondary-500 dark:text-secondary-400">
                        {uploadProgress[file.name]}%
                      </span>
                    </div>
                  )}

                  {uploadStatus[file.name] === 'completed' && (
                    <CheckCircleIcon className="h-5 w-5 text-success-500" />
                  )}

                  {uploadStatus[file.name] === 'error' && (
                    <ExclamationTriangleIcon className="h-5 w-5 text-danger-500" />
                  )}

                  <button
                    onClick={() => removeFile(index)}
                    className="text-danger-600 hover:text-danger-800 dark:text-danger-400 dark:hover:text-danger-300"
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

  // Advanced options removed for simplicity

  // ==================================================
  // MAIN RENDER - Render chính
  // ==================================================

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-xl sm:text-2xl font-bold text-secondary-900 dark:text-white mb-2">
          Mã hóa File Zero-Knowledge
        </h1>
        <p className="text-sm sm:text-base text-secondary-600 dark:text-secondary-400">
          Mã hóa file với các thuật toán kháng lượng tử và nguyên tắc Zero-Knowledge
        </p>
      </div>

      <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-lg p-4 sm:p-6">
        {/* File Upload Area */}
        <div
          {...getRootProps()}
          className={clsx(
            'border-2 border-dashed rounded-lg p-4 sm:p-6 text-center cursor-pointer transition-colors focus-ring',
            isDragActive
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-secondary-300 hover:border-secondary-400 dark:border-secondary-600 dark:hover:border-secondary-500'
          )}
          role="button"
          aria-label="Khu vực upload file - kéo thả hoặc click để chọn file"
          tabIndex={0}
        >
          <input {...getInputProps()} aria-label="Chọn file để mã hóa" />
          <DocumentArrowUpIcon className="mx-auto h-8 w-8 sm:h-10 sm:w-10 text-secondary-400 mb-3" aria-hidden="true" />
          <p className="text-base sm:text-lg font-medium text-secondary-900 dark:text-white mb-2">
            {isDragActive ? 'Thả file vào đây' : 'Kéo thả file hoặc click để chọn'}
          </p>
          <p className="text-xs sm:text-sm text-secondary-500 dark:text-secondary-400">
            Hỗ trợ file đơn, nhiều file, hoặc thư mục hoàn chỉnh
          </p>
        </div>

        {/* File Picker Buttons */}
        <div className="mt-4 flex flex-wrap gap-3 justify-center">
          <button
            type="button"
            onClick={handleFilePickerClick}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <DocumentIcon className="h-5 w-5 mr-2" />
            Chọn File
          </button>

          <button
            type="button"
            onClick={handleFolderPickerClick}
            className="flex items-center px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors"
          >
            <FolderIcon className="h-5 w-5 mr-2" />
            Chọn Thư Mục
          </button>

          {selectedFiles.length > 0 && (
            <button
              type="button"
              onClick={clearAllResults}
              className="flex items-center px-4 py-2 bg-danger-600 text-white rounded-lg hover:bg-danger-700 transition-colors"
            >
              <XMarkIcon className="h-5 w-5 mr-2" />
              Xóa Tất Cả
            </button>
          )}
        </div>

        {/* Hidden File Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
          accept="*/*"
        />

        <input
          ref={folderInputRef}
          type="file"
          multiple
          {...({ webkitdirectory: "" } as any)}
          onChange={handleFolderInputChange}
          className="hidden"
        />



          {/* File List */}
          {renderFileList()}

        {/* Encryption Form */}
        {selectedFiles.length > 0 && (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 sm:mt-6 space-y-3 sm:space-y-4">
            {/* Basic Options */}
            <div className="space-y-3 sm:space-y-4">
            {/* Algorithm Selection */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Thuật toán mã hóa
              </label>
              <EncryptionAlgorithmSelector
                selectedAlgorithm={watch('algorithm')}
                onAlgorithmChange={(value: string) => setValue('algorithm', value)}
              />
            </div>

            {/* Key Derivation */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Key Derivation Function
              </label>
              <select
                {...register('key_derivation')}
                className="w-full px-3 py-2 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:border-secondary-600 dark:text-white"
              >
                <option value="Argon2id">Argon2id (Recommended)</option>
                <option value="PBKDF2">PBKDF2</option>
                <option value="Scrypt">Scrypt</option>
              </select>
            </div>
            </div>

            {/* Password Fields */}
            <div className="space-y-3 sm:space-y-4">
            {/* Hidden username field for accessibility */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              style={{ display: 'none' }}
              readOnly
              tabIndex={-1}
            />
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  autoComplete="new-password"
                  className="w-full px-3 py-2 pr-10 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:border-secondary-600 dark:text-white"
                  placeholder="Nhập mật khẩu"
                  aria-describedby="password-strength"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center focus-ring rounded"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-secondary-400" aria-hidden="true" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-secondary-400" aria-hidden="true" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">
                  {errors.password.message}
                </p>
              )}

              {/* Password Strength */}
              {watchPassword && (
                <div className="mt-2" id="password-strength">
                  <div className="flex space-x-1" role="progressbar" aria-label="Độ mạnh mật khẩu" aria-valuenow={getPasswordStrength(watchPassword).score} aria-valuemin={0} aria-valuemax={5}>
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={clsx(
                          'h-2 flex-1 rounded',
                          getPasswordStrength(watchPassword).score >= level
                            ? 'bg-success-500'
                            : 'bg-secondary-200 dark:bg-secondary-700'
                        )}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1" aria-live="polite">
                    Độ mạnh: {getPasswordStrength(watchPassword).strength}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Xác nhận mật khẩu
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  {...register('confirm_password')}
                  autoComplete="new-password"
                  className="w-full px-3 py-2 pr-10 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:border-secondary-600 dark:text-white"
                  placeholder="Nhập lại mật khẩu"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-secondary-400" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-secondary-400" />
                  )}
                </button>
              </div>
              {errors.confirm_password && (
                <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">
                  {errors.confirm_password.message}
                </p>
              )}
            </div>
            </div>

            {/* Advanced options removed */}

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-describedby={selectedFiles.length > 0 ? "file-count" : undefined}
              >
                {isSubmitting || isLoading ? (
                  <>
                    <LoadingSpinner size="small" className="mr-2" aria-hidden="true" />
                    <span>Đang mã hóa...</span>
                    <span className="sr-only">Vui lòng chờ, đang xử lý {selectedFiles.length} file</span>
                  </>
                ) : (
                  <>
                    <LockClosedIcon className="h-5 w-5 mr-2" aria-hidden="true" />
                    <span>Mã hóa và Upload</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Download Section */}
      {encryptedResults.length > 0 && (
        <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-lg p-4 sm:p-6">
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
                className="flex items-center justify-between p-3 bg-secondary-50 dark:bg-secondary-700 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <CheckCircleIcon className="h-6 w-6 text-success-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-secondary-900 dark:text-white">
                      {encryptedFile.originalName || 
                       encryptedFile.metadata?.filename || 
                       'Unknown File'}
                    </p>
                    <p className="text-xs text-secondary-500 dark:text-secondary-400">
                      {encryptedFile.metadata?.algorithm || encryptedFile.algorithm} • 
                      {encryptedFile.metadata?.encryptionMode || encryptedFile.mode || 'single'} • 
                      {encryptedFile.metadata?.timestamp ? 
                        new Date(encryptedFile.metadata.timestamp).toLocaleString() : 
                        (encryptedFile.timestamp ? new Date(encryptedFile.timestamp).toLocaleString() : 'Unknown Date')
                      }
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

          <div className="mt-4 flex justify-end">
            <button
              onClick={clearAllResults}
              className="px-4 py-2 text-secondary-600 dark:text-secondary-400 hover:text-secondary-800 dark:hover:text-secondary-200 transition-colors"
            >
              Xóa Tất Cả Kết Quả
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EncryptPage; 
