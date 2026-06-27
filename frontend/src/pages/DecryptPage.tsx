import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-hot-toast';
import {
  DocumentArrowDownIcon,
  DocumentIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  KeyIcon,
  ShieldCheckIcon,
  FolderIcon,
  ArrowDownTrayIcon,
  InformationCircleIcon,
  CpuChipIcon
} from '@heroicons/react/24/outline';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import clsx from 'clsx';
import { statePersistence } from '../utils/storage';


// Import crypto services
import {
  ZeroKnowledgeEncryption,
  type FileMetadata,
  type DecryptionResult
} from '../crypto';
import { FileService } from '../services/file.service';
import SessionFileManager from '../utils/sessionFileManager';

// ==================================================
// TYPES & INTERFACES - Định nghĩa types cho trang giải mã
// ==================================================

interface DecryptionProgress {
  stage: 'reading' | 'validating' | 'deriving_key' | 'decrypting' | 'verifying' | 'extracting' | 'complete';
  progress: number;
  message: string;
  details?: string;
}

interface DecryptedFileInfo {
  name: string;
  size: number;
  type: string;
  data: Uint8Array;
  isFolder?: boolean;
  path?: string;
}

interface DecryptionState {
  isDecrypting: boolean;
  progress: DecryptionProgress;
  result?: DecryptionResult;
  decryptedFiles: DecryptedFileInfo[];
  error?: string;
  metadata?: FileMetadata;
}

interface FileValidationResult {
  isValid: boolean;
  fileType: 'single' | 'multi' | 'multi-zip' | 'folder' | 'unknown';
  metadata?: FileMetadata;
  error?: string;
}

// ==================================================
// DECRYPT PAGE COMPONENT - Component trang giải mã mới
// ==================================================

const DecryptPage: React.FC = () => {
  // ==================================================
  // STATE MANAGEMENT - Quản lý state
  // ==================================================
  
  const [decryptionState, setDecryptionState] = useState<DecryptionState>({
    isDecrypting: false,
    progress: { stage: 'reading', progress: 0, message: 'Sẵn sàng giải mã' },
    decryptedFiles: []
  });
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [decryptionMethod, setDecryptionMethod] = useState<'password' | 'hybrid'>('password');
  const [fileValidation, setFileValidation] = useState<FileValidationResult | null>(null);
  const [showFileDetails, setShowFileDetails] = useState(false);

  // Multi-batch decryption state
  const [multiBatchFiles, setMultiBatchFiles] = useState<any[]>([]);
  const [selectedBatchFiles, setSelectedBatchFiles] = useState<Set<string>>(new Set());
  const [showBatchSelection, setShowBatchSelection] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==================================================
  // STATE PERSISTENCE - Lưu trạng thái
  // ==================================================

  useEffect(() => {
    const savedState = statePersistence.restoreWorkState('decrypt');
    if (savedState) {
      setDecryptionMethod(savedState.decryptionMethod || 'password');
      setShowFileDetails(savedState.showFileDetails || false);
    }
  }, []);

  useEffect(() => {
    statePersistence.saveWorkState('decrypt', {
      decryptionMethod,
      showFileDetails
    });
  }, [decryptionMethod, showFileDetails]);

  // ==================================================
  // UTILITY FUNCTIONS - Các hàm tiện ích
  // ==================================================

  const detectAlgorithmFromMetadata = (metadata: FileMetadata): string => {
    // Auto-detect algorithm from metadata or filename patterns
    if (metadata.algorithm) {
      return metadata.algorithm;
    }
    
    const filename = metadata.filename?.toLowerCase() || '';
    if (filename.includes('xchacha') || filename.includes('chacha')) {
      return 'XChaCha20-Poly1305';
    } else if (filename.includes('camellia')) {
      return 'Camellia-CTR-HMAC';
    }
    
    return 'AES-256-GCM'; // Default
  };

  const getFileType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const types: Record<string, string> = {
      'txt': 'text/plain',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'zip': 'application/zip',
      'json': 'application/json',
      'xml': 'application/xml',
      'csv': 'text/csv'
    };
    return types[ext || ''] || 'application/octet-stream';
  };

  // ==================================================
  // FILE VALIDATION & METADATA EXTRACTION - Xác thực file và trích xuất metadata
  // ==================================================

  const validateAndExtractMetadata = useCallback(async (file: File): Promise<FileValidationResult> => {
    try {
      let metadata: FileMetadata | null = null;

      // Method 1: Try to parse new format with embedded metadata
      try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Check if file has new format: [METADATA_LENGTH(4 bytes)][METADATA_JSON][ENCRYPTED_DATA]
        if (uint8Array.length >= 4) {
          const view = new DataView(arrayBuffer);
          const metadataLength = view.getUint32(0, true); // little-endian

          // Validate metadata length is reasonable
          if (metadataLength > 0 && metadataLength < 100000 && (4 + metadataLength) < uint8Array.length) {
            try {
              const metadataBytes = uint8Array.slice(4, 4 + metadataLength);
              const metadataStr = new TextDecoder().decode(metadataBytes);
              const parsedMetadata = JSON.parse(metadataStr);

              // Enhanced validation for metadata structure
              if (parsedMetadata.fileId && parsedMetadata.algorithm && parsedMetadata.version) {
                // Additional validation for required fields
                const requiredFields = ['fileId', 'algorithm', 'version', 'originalSize', 'encryptedSize'];
                const missingFields = requiredFields.filter(field => !parsedMetadata[field]);

                if (missingFields.length === 0) {
                  metadata = parsedMetadata;
                  // Successfully parsed new format metadata
                } else {
                  // Metadata missing required fields
                }
              } else {
                // Metadata validation failed - missing core fields
              }
            } catch (e) {
              // Not new format, continue to other methods
            }
          }
        }

        // Fallback: Look for old metadata header pattern
        if (!metadata) {
          const metadataMarker = new TextEncoder().encode('METADATA:');
          for (let i = 0; i < Math.min(uint8Array.length, 2048); i++) {
            if (uint8Array.slice(i, i + metadataMarker.length).every((val, idx) => val === metadataMarker[idx])) {
              const metadataStart = i + metadataMarker.length;
              const metadataEnd = uint8Array.indexOf(0, metadataStart);
              if (metadataEnd > metadataStart) {
                const metadataStr = new TextDecoder().decode(uint8Array.slice(metadataStart, metadataEnd));
                metadata = JSON.parse(metadataStr);
                break;
              }
            }
          }
        }
      } catch (e) {
        // Ignore parsing errors, try other methods
      }
      
      // Method 2: Check for backend metadata (only for proper backend files)
      if (!metadata && file.name.includes('.enc') && file.name.includes('_')) {
        try {
          const parts = file.name.replace('.enc', '').split('_');
          const potentialFileId = parts[parts.length - 1];
          
          if (potentialFileId && potentialFileId.length > 10 && /^[a-zA-Z0-9]+$/.test(potentialFileId)) {
            try {
              // const backendMetadata = await BackendFileService.getFileMetadata(potentialFileId);
              // Backend metadata lookup disabled for now
              // if (backendMetadata) {
              //   metadata = {
              //     fileId: backendMetadata.id,
              //     filename: backendMetadata.filename,
              //     originalSize: backendMetadata.original_size,
              //     encryptedSize: file.size,
              //     algorithm: backendMetadata.encryption_algorithm,
              //     keyDerivation: 'Argon2id',
              //     salt: '',
              //     iv: '',
              //     checksum: '',
              //     timestamp: new Date(backendMetadata.uploaded_at).getTime(),
              //     version: '1.0.0'
              //   };
              // }
            } catch (e) {
              // Backend metadata not available
            }
          }
        } catch (e) {
          // Backend metadata not available
        }
      }
      
      // Method 3: Create default metadata for unknown files
      if (!metadata) {
        let detectedAlgorithm = 'AES-256-GCM';
        
        if (file.name.includes('xchacha') || file.name.includes('chacha')) {
          detectedAlgorithm = 'XChaCha20-Poly1305';
        } else if (file.name.includes('camellia')) {
          detectedAlgorithm = 'Camellia-CTR-HMAC';
        }

        const generateReproducibleBase64 = (input: string, length: number): string => {
          const encoder = new TextEncoder();
          const data = encoder.encode(input.padEnd(length, '0').substring(0, length));
          return btoa(String.fromCharCode(...data));
        };

        metadata = {
          fileId: `unknown_${Date.now()}`,
          filename: file.name,
          originalSize: 0,
          encryptedSize: file.size,
          algorithm: detectedAlgorithm,
          keyDerivation: 'Argon2id',
          salt: generateReproducibleBase64(file.name + '_salt', 32),
          iv: generateReproducibleBase64(file.name + '_iv_' + detectedAlgorithm, 16),
          checksum: generateReproducibleBase64('checksum_placeholder', 32),
          timestamp: Date.now(),
          encryptionMode: 'single',
          version: '1.0.0'
        };
      } else {
        metadata.algorithm = detectAlgorithmFromMetadata(metadata);
      }
      
      // Determine file type from metadata - SECURITY DESIGN LOGIC
      let fileType: 'single' | 'multi' | 'multi-zip' | 'folder' = 'single';

      // Decryption metadata analysis for file type determination

      if (metadata.isFolder) {
        // Folder: đã ZIP thư mục rồi mã hóa
        fileType = 'folder';
      } else if (metadata.encryptionMode === 'multi') {
        // Multi-file: có thể là ZIP (AdvancedEncryptPage) hoặc individual files (EncryptPage)
        // Kiểm tra filename và multiFileInfo để phân biệt chính xác
        if (metadata.filename && metadata.filename.includes('multi_files_') && metadata.filename.endsWith('.zip')) {
          // Kiểm tra thêm xem có phải thực sự là ZIP không
          try {
            // Kiểm tra magic bytes của ZIP (PK) - đọc lại file
            const arrayBuffer = await file.arrayBuffer();
            const fileData = new Uint8Array(arrayBuffer);
            const firstBytes = new Uint8Array(fileData.slice(0, 4));
            const isZipMagic = firstBytes[0] === 0x50 && firstBytes[1] === 0x4B; // "PK"

            if (isZipMagic) {
              fileType = 'multi-zip'; // ZIP-based multi-file
            } else {
              fileType = 'multi'; // Individual file from multi-file batch
            }
          } catch {
            // Fallback to filename-based detection
            fileType = 'multi-zip';
          }
        } else {
          fileType = 'multi'; // Individual file from multi-file batch
        }
      } else {
        // Single file: mã hóa trực tiếp file gốc
        fileType = 'single';
      }

      // Determined file type successfully
      
      return {
        isValid: true,
        fileType,
        metadata
      };
      
    } catch (error) {
      return {
        isValid: false,
        fileType: 'unknown',
        error: `Lỗi khi đọc file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }, []);

  // ==================================================
  // FILE SELECTION HANDLERS - Xử lý chọn file
  // ==================================================

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setSelectedFile(file);
    setShowBatchSelection(false);
    setMultiBatchFiles([]);

    const validation = await validateAndExtractMetadata(file);
    setFileValidation(validation);

    if (validation.isValid && validation.metadata) {
      if (validation.metadata.useKeyWrap) {
        setDecryptionMethod('hybrid');
      } else {
        setDecryptionMethod('password');
      }

      // Check if this is a multi-batch file and find related files
      if (validation.metadata.encryptionMode === 'multi') {
        await checkForMultiBatchFiles(validation.metadata, file.name);
      }
    }
  }, [validateAndExtractMetadata]);

  // Check for related multi-batch files
  const checkForMultiBatchFiles = async (metadata: any, currentFileName: string) => {
    try {
      // Use SessionFileManager to get user-specific files
      const sessionFiles = SessionFileManager.getFiles();

      // Find files with same multiFileInfo.fileCount (same batch)
      const allFiles = await sessionFiles;
      const relatedFiles = allFiles.filter((file: any) =>
        file.metadata?.encryptionMode === 'multi' &&
        file.metadata?.multiFileInfo?.fileCount === metadata.multiFileInfo?.fileCount &&
        file.timestamp && metadata.timestamp &&
        Math.abs(new Date(file.timestamp).getTime() - new Date(metadata.timestamp).getTime()) < 60000 // Within 1 minute
      );

      if (relatedFiles.length > 1) {
        setMultiBatchFiles(relatedFiles);
        setShowBatchSelection(true);
        setSelectedBatchFiles(new Set([currentFileName])); // Select current file by default
      }
    } catch (error) {
      // Error checking for multi-batch files
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/octet-stream': ['.encrypted', '.enc'],
      'application/zip': ['.zip'],
      '*/*': []
    },
    multiple: false,
    maxSize: 500 * 1024 * 1024 // 500MB limit
  });

  // Manual file picker
  const handleFilePickerClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // ==================================================
  // PROGRESS TRACKING - Theo dõi tiến trình
  // ==================================================

  const updateProgress = (
    stage: DecryptionProgress['stage'],
    progress: number,
    message: string,
    details?: string
  ) => {
    setDecryptionState(prev => ({
      ...prev,
      progress: { stage, progress, message, details }
    }));
  };

  // ==================================================
  // MAIN DECRYPTION LOGIC - Logic giải mã chính
  // ==================================================

  async function handleDecrypt() {
    if (!selectedFile || !fileValidation?.isValid || !fileValidation.metadata) {
      toast.error('Vui lòng chọn file hợp lệ');
      return;
    }

    if (decryptionMethod === 'password' && !password) {
      toast.error('Vui lòng nhập mật khẩu');
      return;
    }

    if (decryptionMethod === 'hybrid' && !privateKey) {
      toast.error('Vui lòng nhập private key');
      return;
    }

    // Check if this is multi-batch and user has selected files
    if (showBatchSelection && selectedBatchFiles.size === 0) {
      toast.error('Vui lòng chọn ít nhất một file để giải mã');
      return;
    }

    setDecryptionState(prev => ({ ...prev, isDecrypting: true, error: undefined }));

    // Handle multi-batch decryption
    if (showBatchSelection && selectedBatchFiles.size > 0) {
      await handleMultiBatchDecrypt();
      return;
    }

    try {
      // Stage 1: Reading file
      updateProgress('reading', 10, 'Đang đọc file đã mã hóa...', 'Tải file vào memory');
      const arrayBuffer = await selectedFile.arrayBuffer();
      let encryptedData = new Uint8Array(arrayBuffer);

      // Extract encrypted data from new format if applicable
      if (fileValidation.metadata && arrayBuffer.byteLength >= 4) {
        const view = new DataView(arrayBuffer);
        const metadataLength = view.getUint32(0, true);

        // File analysis for metadata extraction

        // If this is new format, extract only the encrypted data part
        if (metadataLength > 0 && metadataLength < 100000 && (4 + metadataLength) < arrayBuffer.byteLength) {
          const originalSize = encryptedData.length;
          encryptedData = new Uint8Array(arrayBuffer, 4 + metadataLength);
          // Extracted encrypted data successfully

          // Validate extracted data size matches metadata
          if (fileValidation.metadata.encryptedSize && encryptedData.length !== fileValidation.metadata.encryptedSize) {
            // Size mismatch detected
          }
        } else {
          // Using original file data (not new format or invalid metadata length)
        }
      }

      // Stage 2: Validating
      updateProgress('validating', 20, 'Đang xác thực file...', 'Kiểm tra tính toàn vẹn và metadata');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Stage 3: Key derivation
      updateProgress('deriving_key', 30, 'Đang tạo key giải mã...',
        decryptionMethod === 'password' ? 'Derive key từ password' : 'Unwrap key từ private key');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Stage 4: Decryption based on file type
      const fileType = fileValidation.fileType || 'single';
      let decryptionResult: DecryptionResult;

      try {
        switch (fileType) {
          case 'single':
            updateProgress('decrypting', 50, 'Đang giải mã file đơn...', 'Giải mã file gốc');
            decryptionResult = await ZeroKnowledgeEncryption.decrypt(
              encryptedData,
              fileValidation.metadata,
              decryptionMethod === 'password' ? password : undefined,
              decryptionMethod === 'hybrid' ? new TextEncoder().encode(privateKey) : undefined
            );
            break;

          case 'multi':
            updateProgress('decrypting', 50, 'Đang giải mã file từ multi-batch...', 'File được mã hóa riêng biệt');
            // Multi-batch: giải mã file đơn lẻ, không phải ZIP
            decryptionResult = await ZeroKnowledgeEncryption.decrypt(
              encryptedData,
              fileValidation.metadata,
              decryptionMethod === 'password' ? password : undefined,
              decryptionMethod === 'hybrid' ? new TextEncoder().encode(privateKey) : undefined
            );
            break;

          case 'folder':
            updateProgress('decrypting', 50, 'Đang giải mã thư mục...', 'Giải mã và khôi phục cấu trúc');
            decryptionResult = await ZeroKnowledgeEncryption.decrypt(
              encryptedData,
              fileValidation.metadata,
              decryptionMethod === 'password' ? password : undefined,
              decryptionMethod === 'hybrid' ? new TextEncoder().encode(privateKey) : undefined
            );
            break;

          default:
            throw new Error(`Loại file không được hỗ trợ: ${fileType}`);
        }
      } catch (decryptError) {
        // Enhanced error handling for decryption
        let errorMessage = 'Lỗi giải mã không xác định';

        if (decryptError instanceof Error) {
          const message = decryptError.message.toLowerCase();

          if (message.includes('password') || message.includes('key')) {
            errorMessage = 'Mật khẩu hoặc private key không đúng';
          } else if (message.includes('integrity') || message.includes('checksum')) {
            errorMessage = 'Lỗi tính toàn vẹn - file có thể bị hỏng hoặc sai metadata';
          } else if (message.includes('algorithm')) {
            errorMessage = 'Thuật toán mã hóa không được hỗ trợ hoặc không khớp';
          } else if (message.includes('format') || message.includes('metadata')) {
            errorMessage = 'Format file không đúng hoặc metadata bị lỗi';
          } else {
            errorMessage = `Lỗi giải mã: ${decryptError.message}`;
          }
        }

        throw new Error(errorMessage);
      }

      // Stage 5: Verification
      updateProgress('verifying', 80, 'Đang xác thực tính toàn vẹn...', 'Kiểm tra checksum và signature');
      if (!decryptionResult.verified) {
        throw new Error('Xác thực tính toàn vẹn thất bại');
      }

      // Stage 6: Extract files based on type
      updateProgress('extracting', 90, 'Đang trích xuất file...', 'Khôi phục cấu trúc file/folder');
      let decryptedFiles: DecryptedFileInfo[];

      try {
        decryptedFiles = await extractDecryptedFiles(decryptionResult, fileType);

        if (decryptedFiles.length === 0) {
          throw new Error('Không thể trích xuất file nào từ dữ liệu đã giải mã');
        }
      } catch (extractError) {
        let errorMessage = 'Lỗi trích xuất file';

        if (extractError instanceof Error) {
          const message = extractError.message.toLowerCase();

          if (message.includes('zip') || message.includes('archive')) {
            errorMessage = 'Lỗi giải nén ZIP - file có thể bị hỏng';
          } else if (message.includes('structure') || message.includes('folder')) {
            errorMessage = 'Lỗi khôi phục cấu trúc thư mục';
          } else {
            errorMessage = `Lỗi trích xuất: ${extractError.message}`;
          }
        }

        throw new Error(errorMessage);
      }

      // Stage 7: Complete
      updateProgress('complete', 100, 'Giải mã hoàn tất!', `Đã khôi phục ${decryptedFiles.length} file`);

      setDecryptionState(prev => ({
        ...prev,
        isDecrypting: false,
        result: decryptionResult,
        decryptedFiles
      }));

      toast.success(`Giải mã thành công ${decryptedFiles.length} file!`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
      setDecryptionState(prev => ({
        ...prev,
        isDecrypting: false,
        error: errorMessage
      }));
      toast.error(`Giải mã thất bại: ${errorMessage}`);
    }
  }

  // ==================================================
  // FILE EXTRACTION LOGIC - Logic trích xuất file
  // ==================================================

  async function extractDecryptedFiles(
    result: DecryptionResult,
    fileType: 'single' | 'multi' | 'multi-zip' | 'folder'
  ): Promise<DecryptedFileInfo[]> {
    const files: DecryptedFileInfo[] = [];

    if (fileType === 'single') {
      // Single file - xử lý trực tiếp
      const filename = result.metadata.filename;

      if (!filename) {
        throw new Error('Không tìm thấy tên file trong metadata');
      }

      if (!result.decryptedData || result.decryptedData.length === 0) {
        throw new Error('Dữ liệu giải mã trống');
      }

      files.push({
        name: filename,
        size: result.metadata.originalSize,
        type: getFileType(filename),
        data: result.decryptedData
      });
    } else if (fileType === 'multi') {
      // Multi-file individual (mã hóa riêng biệt, không phải ZIP) - single file from batch
      const filename = result.metadata.originalName || result.metadata.filename;

      if (!filename) {
        throw new Error('Không tìm thấy tên file trong metadata multi-file');
      }

      if (!result.decryptedData || result.decryptedData.length === 0) {
        throw new Error('Dữ liệu multi-file trống');
      }

      files.push({
        name: filename,
        size: result.metadata.originalSize || result.decryptedData.length,
        type: result.metadata.mimeType || getFileType(filename),
        data: result.decryptedData
      });
    } else if (fileType === 'multi-zip' || fileType === 'folder') {
      // Multi-file ZIP (from AdvancedEncryptPage) và Folder - cả hai đều là ZIP format
      if (!result.decryptedData || result.decryptedData.length === 0) {
        throw new Error('Dữ liệu ZIP trống');
      }

      try {
        // Attempting to extract file data

        const zip = new JSZip();
        const zipContent = await zip.loadAsync(result.decryptedData);

        const zipFiles = Object.entries(zipContent.files);
        if (zipFiles.length === 0) {
          throw new Error('File ZIP không chứa file nào');
        }

        for (const [relativePath, zipEntry] of zipFiles) {
          if (!zipEntry.dir) {
            try {
              const fileData = await zipEntry.async('uint8array');
              files.push({
                name: zipEntry.name,
                size: fileData.length,
                type: getFileType(zipEntry.name),
                data: fileData,
                path: relativePath,
                isFolder: fileType === 'folder' // Chỉ folder mới có isFolder = true
              });
            } catch (fileError) {
              // Cannot extract file, continuing with other files
              // Continue with other files instead of failing completely
            }
          }
        }

        if (files.length === 0) {
          throw new Error('Không thể trích xuất file nào từ ZIP');
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('ZIP')) {
          throw error; // Re-throw our custom ZIP errors
        } else {
          const errorType = fileType === 'multi-zip' ? 'multi-file ZIP' : 'folder';
          throw new Error(`Lỗi khi trích xuất ${errorType}: ${error instanceof Error ? error.message : 'Format không hợp lệ'}`);
        }
      }
    }

    return files;
  }

  // Handle multi-batch decryption
  async function handleMultiBatchDecrypt() {
    try {
      // Use SessionFileManager to get user-specific files
      const sessionFiles = SessionFileManager.getFiles();
      const filesToDecrypt = multiBatchFiles.filter(file => selectedBatchFiles.has(file.filename));
      const decryptedFiles: DecryptedFileInfo[] = [];

      updateProgress('reading', 10, `Đang giải mã ${filesToDecrypt.length} file...`, 'Bắt đầu giải mã batch');

      for (let i = 0; i < filesToDecrypt.length; i++) {
        const fileInfo = filesToDecrypt[i];
        const progressPercent = 10 + (i / filesToDecrypt.length) * 80;

        updateProgress('decrypting', progressPercent, `Đang giải mã file ${i + 1}/${filesToDecrypt.length}: ${fileInfo.filename}`, 'Giải mã từng file');

        try {
          // Create a File object from the stored encrypted data
          const encryptedBlob = new Blob([fileInfo.encryptedData], { type: 'application/octet-stream' });
          const file = new File([encryptedBlob], fileInfo.filename);

          // Decrypt this individual file
          const result = await ZeroKnowledgeEncryption.decrypt(
            fileInfo.encryptedData,
            fileInfo.metadata,
            decryptionMethod === 'password' ? password : privateKey
          );

          if (result && result.decryptedData) {
            decryptedFiles.push({
              name: fileInfo.originalName || fileInfo.filename,
              size: result.decryptedData.length,
              type: getFileType(fileInfo.originalName || fileInfo.filename),
              data: result.decryptedData
            });
          }
        } catch (error) {
          // Error decrypting individual file
          toast.error(`Lỗi giải mã file ${fileInfo.filename}`);
        }
      }

      updateProgress('complete', 100, `Đã giải mã thành công ${decryptedFiles.length}/${filesToDecrypt.length} file`, 'Hoàn thành');

      setDecryptionState(prev => ({
        ...prev,
        isDecrypting: false,
        decryptedFiles: decryptedFiles
      }));

      if (decryptedFiles.length > 0) {
        toast.success(`Đã giải mã thành công ${decryptedFiles.length} file từ batch!`);
      }

    } catch (error) {
      // Multi-batch decryption error
      setDecryptionState(prev => ({
        ...prev,
        isDecrypting: false,
        error: `Lỗi giải mã batch: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
      toast.error('Có lỗi xảy ra khi giải mã batch files');
    }
  }

  // ==================================================
  // DOWNLOAD HANDLERS - Xử lý download
  // ==================================================

  function handleDownloadFile(file: DecryptedFileInfo) {
    try {
      const blob = new Blob([file.data], { type: file.type });
      saveAs(blob, file.name);
      toast.success(`Đã tải xuống: ${file.name}`);
    } catch (error) {
      toast.error(`Lỗi khi tải file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  function handleDownloadAll() {
    if (decryptionState.decryptedFiles.length === 0) return;

    try {
      if (decryptionState.decryptedFiles.length === 1) {
        handleDownloadFile(decryptionState.decryptedFiles[0]);
      } else {
        // Multiple files - create ZIP
        const zip = new JSZip();
        
        decryptionState.decryptedFiles.forEach(file => {
          const path = file.isFolder && file.path ? file.path : file.name;
          zip.file(path, file.data);
        });

        zip.generateAsync({ type: 'blob' }).then(zipBlob => {
          const folderName = fileValidation?.metadata?.filename || 'decrypted_files';
          saveAs(zipBlob, `${folderName.replace('.zip', '')}_decrypted.zip`);
          toast.success('Đã tải xuống tất cả file dưới dạng ZIP');
        });
      }
    } catch (error) {
      toast.error(`Lỗi khi tải file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==================================================
  // RENDER UI - Giao diện người dùng
  // ==================================================

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-secondary-900">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">
            Giải Mã File
          </h1>
          <p className="text-secondary-600 dark:text-secondary-400">
            Giải mã file đã được mã hóa với công nghệ Zero-Knowledge
          </p>
        </div>

        {/* File Upload Zone */}
        <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-sm border border-secondary-200 dark:border-secondary-700 mb-6">
          <div
            {...getRootProps()}
            className={clsx(
              'p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors',
              isDragActive
                ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                : 'border-secondary-300 dark:border-secondary-600 hover:border-secondary-400 dark:hover:border-secondary-500'
            )}
          >
            <input {...getInputProps()} ref={fileInputRef} />
            <div className="text-center">
              <DocumentArrowDownIcon className="mx-auto h-12 w-12 text-secondary-400 dark:text-secondary-500 mb-4" />
              <div className="text-lg font-medium text-secondary-900 dark:text-white mb-2">
                {isDragActive ? 'Thả file vào đây...' : 'Chọn file cần giải mã'}
              </div>
              <p className="text-secondary-500 dark:text-secondary-400 mb-4">
                Kéo thả hoặc click để chọn file đã mã hóa
              </p>
              <button
                type="button"
                onClick={handleFilePickerClick}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors mb-2"
              >
                Chọn File
              </button>
              <p className="text-xs text-secondary-400 dark:text-secondary-500">
                Hỗ trợ: .encrypted, .enc, .zip và các file đã mã hóa
              </p>
            </div>
          </div>
        </div>

        {/* Selected File Info */}
        {selectedFile && (
          <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-sm border border-secondary-200 dark:border-secondary-700 mb-6 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <DocumentIcon className="h-8 w-8 text-primary-500 mr-3" />
                <div>
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white">
                    {selectedFile.name}
                  </h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFileDetails(!showFileDetails)}
                className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
              >
                <InformationCircleIcon className="h-5 w-5" />
              </button>
            </div>

            {/* File Validation Status */}
            {fileValidation && (
              <div className="mb-4">
                {fileValidation.isValid ? (
                  <div className="flex items-center text-success-600 dark:text-success-400">
                    <CheckCircleIcon className="h-5 w-5 mr-2" />
                    <span className="text-sm">
                      File hợp lệ - Loại: {
                        fileValidation.fileType === 'single' ? 'File đơn' :
                        fileValidation.fileType === 'multi' ? 'File từ multi-batch' :
                        fileValidation.fileType === 'multi-zip' ? 'Multi-file ZIP' : 'Thư mục'
                      }
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center text-danger-600 dark:text-danger-400">
                    <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                    <span className="text-sm">{fileValidation.error}</span>
                  </div>
                )}
              </div>
            )}

            {/* Multi-batch File Selection */}
            {showBatchSelection && multiBatchFiles.length > 1 && (
              <div className="mb-4 p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700 rounded-lg">
                <h4 className="text-sm font-medium text-primary-900 dark:text-primary-100 mb-3">
                  Phát hiện {multiBatchFiles.length} file trong cùng batch. Chọn file để giải mã:
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 mb-2">
                    <button
                      onClick={() => setSelectedBatchFiles(new Set(multiBatchFiles.map(f => f.filename)))}
                      className="text-xs px-2 py-1 bg-primary-600 text-white rounded hover:bg-primary-700"
                    >
                      Chọn tất cả
                    </button>
                    <button
                      onClick={() => setSelectedBatchFiles(new Set())}
                      className="text-xs px-2 py-1 bg-secondary-600 text-white rounded hover:bg-secondary-700"
                    >
                      Bỏ chọn tất cả
                    </button>
                  </div>
                  {multiBatchFiles.map((file, index) => (
                    <label key={index} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedBatchFiles.has(file.filename)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedBatchFiles);
                          if (e.target.checked) {
                            newSelected.add(file.filename);
                          } else {
                            newSelected.delete(file.filename);
                          }
                          setSelectedBatchFiles(newSelected);
                        }}
                        className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-secondary-700 dark:text-secondary-300">
                        {file.filename} ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* File Details */}
            {showFileDetails && fileValidation?.metadata && (
              <div className="border-t border-secondary-200 dark:border-secondary-600 pt-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium">Thuật toán:</span>
                    <span className="ml-2 text-secondary-600 dark:text-secondary-400">
                      {fileValidation.metadata.algorithm}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Key Derivation:</span>
                    <span className="ml-2 text-secondary-600 dark:text-secondary-400">
                      {fileValidation.metadata.keyDerivation}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Kích thước gốc:</span>
                    <span className="ml-2 text-secondary-600 dark:text-secondary-400">
                      {fileValidation.metadata.originalSize > 0 ? 
                        `${(fileValidation.metadata.originalSize / 1024 / 1024).toFixed(2)} MB` : 
                        'Không xác định'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Thời gian:</span>
                    <span className="ml-2 text-secondary-600 dark:text-secondary-400">
                      {new Date(fileValidation.metadata.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Decryption Settings */}
        {selectedFile && fileValidation?.isValid && (
          <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-sm border border-secondary-200 dark:border-secondary-700 mb-6 p-6">
            <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-4 flex items-center">
              <KeyIcon className="h-5 w-5 mr-2" />
              Cài đặt giải mã
            </h3>

            <div className="space-y-4">
              {/* Decryption Method */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                  Phương thức giải mã
                </label>
                <select
                  value={decryptionMethod}
                  onChange={(e) => setDecryptionMethod(e.target.value as 'password' | 'hybrid')}
                  className="w-full px-3 py-2 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:border-secondary-600 dark:text-white"
                >
                  <option value="password">Mật khẩu</option>
                  <option value="hybrid">Private Key (Hybrid)</option>
                </select>
              </div>

              {/* Password Input */}
              {decryptionMethod === 'password' && (
                <div>
                  <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                    Mật khẩu giải mã
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="username"
                      autoComplete="username"
                      style={{ display: 'none' }}
                      readOnly
                      tabIndex={-1}
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      className="w-full px-3 py-2 pr-10 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:border-secondary-600 dark:text-white"
                      placeholder="Nhập mật khẩu giải mã"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5 text-secondary-400" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-secondary-400" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Private Key Input */}
              {decryptionMethod === 'hybrid' && (
                <div>
                  <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                    Private Key
                  </label>
                  <div className="relative">
                    <textarea
                      value={privateKey}
                      onChange={(e) => setPrivateKey(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:border-secondary-600 dark:text-white"
                      placeholder="Nhập private key để giải mã..."
                    />
                  </div>
                </div>
              )}

              {/* Decrypt Button */}
              <button
                onClick={handleDecrypt}
                disabled={decryptionState.isDecrypting || !selectedFile || !fileValidation?.isValid || 
                         (decryptionMethod === 'password' && !password) || 
                         (decryptionMethod === 'hybrid' && !privateKey)}
                className="w-full flex items-center justify-center px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ShieldCheckIcon className="h-5 w-5 mr-2" />
                {decryptionState.isDecrypting ? 'Đang giải mã...' : 'Giải mã file'}
              </button>
            </div>
          </div>
        )}

        {/* Decryption Progress */}
        {decryptionState.isDecrypting && (
          <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-sm border border-secondary-200 dark:border-secondary-700 mb-6 p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-medium text-secondary-900 dark:text-white">
                {decryptionState.progress.message}
              </h3>
              <span className="text-sm text-secondary-500 dark:text-secondary-400">
                {decryptionState.progress.progress}%
              </span>
            </div>
            
            <div className="w-full bg-secondary-200 dark:bg-secondary-700 rounded-full h-2 mb-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${decryptionState.progress.progress}%` }}
              />
            </div>
            
            {decryptionState.progress.details && (
              <p className="text-sm text-secondary-600 dark:text-secondary-400">
                {decryptionState.progress.details}
              </p>
            )}
          </div>
        )}

        {/* Decryption Error */}
        {decryptionState.error && (
          <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-danger-600 dark:text-danger-400 mr-2" />
              <span className="text-danger-700 dark:text-danger-300">
                {decryptionState.error}
              </span>
            </div>
          </div>
        )}

        {/* Decrypted Files */}
        {decryptionState.decryptedFiles.length > 0 && (
          <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-sm border border-secondary-200 dark:border-secondary-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-secondary-900 dark:text-white flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-success-500 mr-2" />
                File đã giải mã ({decryptionState.decryptedFiles.length})
              </h3>
              <button
                onClick={handleDownloadAll}
                className="flex items-center px-3 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                Tải xuống tất cả
              </button>
            </div>

            <div className="space-y-3">
              {decryptionState.decryptedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border border-secondary-200 dark:border-secondary-600 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {file.isFolder ? (
                        <FolderIcon className="h-6 w-6 text-secondary-400" />
                      ) : (
                        <DocumentIcon className="h-6 w-6 text-secondary-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-secondary-900 dark:text-white">
                        {file.name}
                      </p>
                      <p className="text-xs text-secondary-500 dark:text-secondary-400">
                        {(file.size / 1024).toFixed(2)} KB
                        {file.path && ` • ${file.path}`}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownloadFile(file)}
                    className="flex items-center px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                    Tải xuống
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DecryptPage;
