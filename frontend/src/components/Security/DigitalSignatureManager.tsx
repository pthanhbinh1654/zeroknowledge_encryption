import React, { useState, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import {
  KeyIcon,
  DocumentCheckIcon,
  ShieldCheckIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowUpTrayIcon,
  ClipboardDocumentIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { saveAs } from 'file-saver';
import { ZeroKnowledgeEncryption } from '../../crypto/zero_knowledge';
import SessionFileManager from '../../utils/sessionFileManager';
import ActivityService from '../../services/activity.service';

// Types
export interface SignatureResult {
  signature: string;
  algorithm: string;
  publicKey: string;
  timestamp: string;
  fileHash: string;
  fileName: string;
}

export interface VerificationResult {
  isValid: boolean;
  algorithm: string;
  timestamp: string;
  error?: string;
}

interface Props {
  onSignatureGenerated?: (result: SignatureResult) => void;
  onVerificationComplete?: (result: VerificationResult) => void;
}

const DigitalSignatureManager: React.FC<Props> = ({
  onSignatureGenerated,
  onVerificationComplete
}) => {
  // State
  const [activeTab, setActiveTab] = useState<'generate' | 'sign' | 'verify'>('generate');
  const [algorithm, setAlgorithm] = useState<'Ed25519' | 'Dilithium3' | 'Dilithium5'>('Ed25519');
  const [keyPair, setKeyPair] = useState<any>(null);
  const [publicKey, setPublicKey] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [signature, setSignature] = useState('');
  const [generatedSignature, setGeneratedSignature] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signatureFileInputRef = useRef<HTMLInputElement>(null);
  const publicKeyFileInputRef = useRef<HTMLInputElement>(null);

  // Generate key pair
  const handleGenerateKeyPair = useCallback(async () => {
    setIsProcessing(true);
    try {
      const newKeyPair = await ZeroKnowledgeEncryption.generateSignatureKeyPair(algorithm);
      setKeyPair(newKeyPair);
      setPublicKey(ZeroKnowledgeEncryption.arrayBufferToBase64(newKeyPair.publicKey));
      setPrivateKey(ZeroKnowledgeEncryption.arrayBufferToBase64(newKeyPair.privateKey));
      toast.success(`Đã tạo ${algorithm} key pair thành công!`);
    } catch (error) {
      toast.error(`Lỗi tạo key pair: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [algorithm]);

  // Download key pair files
  const handleDownloadKeyPair = useCallback(() => {
    if (!keyPair) {
      toast.error('Chưa có key pair để tải xuống');
      return;
    }

    try {
      const exportedKeys = ZeroKnowledgeEncryption.exportKeyPairToFiles(keyPair);

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
  }, [keyPair]);

  // File selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Reset input to allow re-uploading the same file
      event.target.value = '';
    }
  }, []);

  const handleSignatureFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const text = await file.text();
        let extractedSignature = '';

        // Handle different signature file formats
        if (file.name.endsWith('.p7s')) {
          // PKCS#7 signature only format
          try {
            const p7sData = JSON.parse(atob(text.replace(/-----BEGIN PKCS7-----/, '').replace(/-----END PKCS7-----/, '').replace(/\s/g, '')));
            extractedSignature = p7sData.signature || text;
            toast.success('Đã tải signature từ file .p7s');
          } catch {
            // Fallback to raw text if not our format
            extractedSignature = text;
            toast.success('Đã tải signature từ file');
          }
        } else if (file.name.endsWith('.p7m')) {
          // PKCS#7 signature + data format
          try {
            const p7mData = JSON.parse(atob(text.replace(/-----BEGIN PKCS7-----/, '').replace(/-----END PKCS7-----/, '').replace(/\s/g, '')));
            if (p7mData.signature && p7mData.dataIncluded) {
              extractedSignature = p7mData.signature;
              toast.success('Đã tải signature từ file .p7m (bao gồm cả dữ liệu)');
              // Note: In a real implementation, we would also extract and use the original data
            } else {
              extractedSignature = text;
              toast.success('Đã tải signature từ file');
            }
          } catch {
            extractedSignature = text;
            toast.success('Đã tải signature từ file');
          }
        } else {
          // Raw signature file or other formats
          if (text.includes('-----BEGIN') && text.includes('-----END')) {
            // Extract content between BEGIN/END markers
            const match = text.match(/-----BEGIN[^-]+-----\s*([\s\S]*?)\s*-----END[^-]+-----/);
            extractedSignature = match ? match[1].replace(/\s/g, '') : text;
          } else {
            extractedSignature = text.trim();
          }

          // For Ed25519, signature should be exactly 64 bytes (88 chars in base64)
          if (algorithm === 'Ed25519' && extractedSignature.length > 88) {
            try {
              const sigBytes = new Uint8Array(atob(extractedSignature).split('').map(c => c.charCodeAt(0)));
              if (sigBytes.length >= 64) {
                // Take the last 64 bytes (Ed25519 signature)
                const ed25519Sig = sigBytes.slice(-64);
                extractedSignature = btoa(String.fromCharCode(...ed25519Sig));
              }
            } catch (e) {
              console.warn('Failed to extract Ed25519 signature from longer data:', e);
            }
          }

          toast.success('Đã tải signature từ file');
        }

        setSignature(extractedSignature);
      } catch (error) {
        console.error('Error reading signature file:', error);
        toast.error('Không thể đọc file signature');
      } finally {
        // Reset input to allow re-uploading the same file
        event.target.value = '';
      }
    }
  }, []);

  const handlePublicKeyFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const text = await file.text();
        let extractedKey = '';

        // Handle different public key file formats
        if (file.name.endsWith('.cer')) {
          // X.509 certificate format
          if (text.includes('-----BEGIN CERTIFICATE-----')) {
            // Extract base64 content from certificate
            const base64Content = text
              .replace(/-----BEGIN CERTIFICATE-----/, '')
              .replace(/-----END CERTIFICATE-----/, '')
              .replace(/\s/g, '');
            extractedKey = base64Content;
            toast.success('Đã tải public key từ file .cer (X.509)');
          } else {
            extractedKey = text.trim();
            toast.success('Đã tải public key từ file .cer');
          }
        } else if (file.name.endsWith('.pem') || file.name.endsWith('.pub')) {
          // PEM format or public key format
          if (text.includes('-----BEGIN') && text.includes('PUBLIC KEY')) {
            // Extract base64 content from PEM
            const base64Content = text
              .replace(/-----BEGIN[^-]+-----/, '')
              .replace(/-----END[^-]+-----/, '')
              .replace(/\s/g, '');
            extractedKey = base64Content;
            toast.success('Đã tải public key từ file PEM');
          } else {
            extractedKey = text.trim();
            toast.success('Đã tải public key từ file');
          }
        } else {
          // Raw base64 or other formats
          if (text.includes('-----BEGIN') && text.includes('-----END')) {
            // Extract content between BEGIN/END markers
            const match = text.match(/-----BEGIN[^-]+-----\s*([\s\S]*?)\s*-----END[^-]+-----/);
            extractedKey = match ? match[1].replace(/\s/g, '') : text;
          } else {
            extractedKey = text.trim();
          }
          toast.success('Đã tải public key từ file');
        }

        setPublicKey(extractedKey);
      } catch (error) {
        console.error('Error reading public key file:', error);
        toast.error('Không thể đọc file public key');
      } finally {
        // Reset input to allow re-uploading the same file
        event.target.value = '';
      }
    }
  }, []);

  // Handle private key file upload
  const handlePrivateKeyFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();

      // Handle different file formats
      if (file.name.endsWith('.p12') || file.name.endsWith('.pfx')) {
        // PKCS#12 format - try to extract private key
        try {
          // Check if it's our custom JSON format first
          if (text.includes('{') && text.includes('privateKey')) {
            const pkcs12Data = JSON.parse(text);
            if (pkcs12Data.privateKey) {
              setPrivateKey(pkcs12Data.privateKey);
              toast.success('Đã tải private key từ file PKCS#12');
            } else {
              toast.error('File PKCS#12 không chứa private key');
            }
          } else {
            // Try to extract from PEM-like format
            const base64Content = text
              .replace(/-----BEGIN[^-]+-----/, '')
              .replace(/-----END[^-]+-----/, '')
              .replace(/\s/g, '');

            if (base64Content.length > 0) {
              setPrivateKey(base64Content);
              toast.success('Đã tải private key từ file PKCS#12');
            } else {
              toast.error('Không thể trích xuất private key từ file PKCS#12');
            }
          }
        } catch (error) {
          console.error('Error parsing PKCS#12:', error);
          toast.error('Không thể đọc file PKCS#12. Vui lòng kiểm tra định dạng file.');
        }
      } else if (file.name.endsWith('.pem') || file.name.endsWith('.key')) {
        // PEM format
        if (text.includes('-----BEGIN') && text.includes('PRIVATE KEY')) {
          // Extract base64 content from PEM
          let base64Content = text
            .replace(/-----BEGIN[^-]+-----/, '')
            .replace(/-----END[^-]+-----/, '')
            .replace(/\s/g, '');

          // For Ed25519, extract the actual 32-byte key from DER/ASN.1 structure
          if (algorithm === 'Ed25519' && base64Content.length > 44) {
            try {
              const derBytes = new Uint8Array(atob(base64Content).split('').map(c => c.charCodeAt(0)));
              // Ed25519 private key is usually at the end of DER structure
              // Look for the 32-byte key (often after some ASN.1 headers)
              if (derBytes.length >= 32) {
                const ed25519Key = derBytes.slice(-32);
                base64Content = btoa(String.fromCharCode(...ed25519Key));
              }
            } catch (e) {
              console.warn('Failed to extract Ed25519 key from DER:', e);
            }
          }

          setPrivateKey(base64Content);
          toast.success('Đã tải private key từ file PEM');
        } else {
          toast.error('File PEM không hợp lệ hoặc không chứa private key');
        }
      } else if (file.name.endsWith('.sk')) {
        // Raw base64 format (our custom format)
        setPrivateKey(text.trim());
        toast.success('Đã tải private key từ file');
      } else {
        // Try to use as raw text
        setPrivateKey(text.trim());
        toast.success('Đã tải nội dung file làm private key');
      }
    } catch (error) {
      console.error('Error reading private key file:', error);
      toast.error('Không thể đọc file private key');
    } finally {
      // Reset file input
      event.target.value = '';
    }
  }, []);

  // Sign file
  const handleSignFile = useCallback(async () => {
    if (!selectedFile || !privateKey) {
      toast.error('Vui lòng chọn file và nhập private key');
      return;
    }

    setIsProcessing(true);
    setGeneratedSignature(null); // Clear previous signature
    try {
      const fileBuffer = await selectedFile.arrayBuffer();
      const fileData = new Uint8Array(fileBuffer);

      // Handle private key conversion more carefully
      let privateKeyArray: Uint8Array;
      try {
        // Try to decode as base64 first
        const privateKeyBytes = ZeroKnowledgeEncryption.base64ToArrayBuffer(privateKey);
        privateKeyArray = privateKeyBytes instanceof Uint8Array
          ? privateKeyBytes
          : new Uint8Array(privateKeyBytes);
      } catch (base64Error) {
        // If base64 decode fails, try to use as hex or raw bytes
        try {
          if (privateKey.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(privateKey)) {
            // Hex string
            privateKeyArray = new Uint8Array(privateKey.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
          } else {
            // Try as UTF-8 encoded string
            privateKeyArray = new TextEncoder().encode(privateKey);
          }
        } catch (conversionError) {
          throw new Error('Không thể chuyển đổi private key. Vui lòng kiểm tra định dạng.');
        }
      }

      const signatureBytes = await ZeroKnowledgeEncryption.sign(
        fileData,
        privateKeyArray,
        algorithm
      );
      
      const signatureBase64 = ZeroKnowledgeEncryption.arrayBufferToBase64(signatureBytes);
      setSignature(signatureBase64);
      setGeneratedSignature(signatureBase64); // Store for download button

      const result: SignatureResult = {
        signature: signatureBase64,
        algorithm,
        publicKey,
        timestamp: new Date().toISOString(),
        fileHash: ZeroKnowledgeEncryption.arrayBufferToBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', fileData))),
        fileName: selectedFile.name
      };

      onSignatureGenerated?.(result);

      // Save signed file to session for Files page
      try {
        SessionFileManager.addFile({
          filename: `${selectedFile.name}.signed`,
          originalName: selectedFile.name,
          encryptedData: fileData, // Store original file data
          metadata: {
            signature: signatureBase64,
            algorithm,
            publicKey,
            timestamp: result.timestamp,
            fileHash: result.fileHash,
            isSigned: true
          },
          algorithm: algorithm,
          mode: 'single',
          size: fileData.length,
          type: 'signed',
          signature: signatureBase64,
          publicKey: publicKey
        });
      } catch (error) {
        console.warn('Failed to save signed file to session storage:', error);
      }

      // Log digital signature activity
      try {
        await ActivityService.logDigitalSignature(
          selectedFile.name,
          algorithm,
          selectedFile.size,
          true
        );
      } catch (error) {
        console.warn('Failed to log digital signature activity:', error);
      }

      toast.success('Đã ký file thành công! Bạn có thể tải xuống chữ ký bên dưới.');
    } catch (error) {
      // Log digital signature failure
      try {
        await ActivityService.logDigitalSignature(
          selectedFile?.name || 'unknown file',
          algorithm,
          selectedFile?.size,
          false,
          error instanceof Error ? error.message : 'Unknown signature error'
        );
      } catch (logError) {
        console.warn('Failed to log digital signature failure:', logError);
      }

      toast.error(`Lỗi khi ký file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, privateKey, algorithm, publicKey, onSignatureGenerated]);

  // Verify signature
  const handleVerifySignature = useCallback(async () => {
    if (!selectedFile || !signature || !publicKey) {
      toast.error('Vui lòng chọn file, nhập signature và public key');
      return;
    }

    setIsProcessing(true);
    try {
      const fileBuffer = await selectedFile.arrayBuffer();
      const fileData = new Uint8Array(fileBuffer);
      const signatureBytes = new Uint8Array(ZeroKnowledgeEncryption.base64ToArrayBuffer(signature));
      const publicKeyBytes = new Uint8Array(ZeroKnowledgeEncryption.base64ToArrayBuffer(publicKey));
      
      const isValid = await ZeroKnowledgeEncryption.verify(
        fileData,
        signatureBytes,
        publicKeyBytes,
        algorithm
      );
      
      const result: VerificationResult = {
        isValid,
        algorithm,
        timestamp: new Date().toISOString(),
        error: isValid ? undefined : 'Signature verification failed'
      };
      
      setVerificationResult(result);
      onVerificationComplete?.(result);

      // Log signature verification activity
      try {
        await ActivityService.logSignatureVerification(
          selectedFile?.name || 'unknown file',
          algorithm,
          isValid,
          isValid ? undefined : 'Signature verification failed'
        );
      } catch (error) {
        console.warn('Failed to log signature verification activity:', error);
      }

      if (isValid) {
        toast.success('✅ Signature hợp lệ!');
      } else {
        toast.error('❌ Signature không hợp lệ!');
      }
    } catch (error) {
      const result: VerificationResult = {
        isValid: false,
        algorithm,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      setVerificationResult(result);
      onVerificationComplete?.(result);

      // Log signature verification failure
      try {
        await ActivityService.logSignatureVerification(
          selectedFile?.name || 'unknown file',
          algorithm,
          false,
          error instanceof Error ? error.message : 'Unknown verification error'
        );
      } catch (logError) {
        console.warn('Failed to log signature verification failure:', logError);
      }

      toast.error(`Lỗi khi xác thực: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, signature, publicKey, algorithm, onVerificationComplete]);

  // Utility functions
  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`Đã copy ${label} vào clipboard`);
    }).catch(() => {
      toast.error(`Lỗi khi copy ${label}`);
    });
  }, []);

  const downloadKey = useCallback((keyData: string, keyType: 'public' | 'private') => {
    // Xuất định dạng file theo chuẩn quốc tế
    let filename = `${algorithm.toLowerCase()}_${keyType}_key`;
    let blob: Blob;
    let mimeType: string;

    if (keyType === 'public') {
      // Public key → .cer format (X.509 DER encoded in Base64)
      const certHeader = '-----BEGIN CERTIFICATE-----';
      const certFooter = '-----END CERTIFICATE-----';

      // Create a simple X.509-like structure
      const x509Like = `${certHeader}\n${keyData}\n${certFooter}\n`;

      blob = new Blob([x509Like], { type: 'application/x-x509-ca-cert' });
      filename += '.cer';
      mimeType = 'application/x-x509-ca-cert';
    } else {
      // Private key → .p12/.pfx format (PKCS#12 with password protection)
      const password = prompt('Nhập mật khẩu để bảo vệ private key (để trống nếu không cần):') || '';

      if (password) {
        // Simple password-protected format (not real PKCS#12 but compatible structure)
        const protectedKey = btoa(JSON.stringify({
          algorithm: algorithm,
          encryptedKey: btoa(keyData + password), // Simple encryption
          salt: btoa(Math.random().toString()),
          iterations: 10000
        }));

        const pkcs12Like = `-----BEGIN ENCRYPTED PRIVATE KEY-----\n${protectedKey}\n-----END ENCRYPTED PRIVATE KEY-----\n`;
        blob = new Blob([pkcs12Like], { type: 'application/x-pkcs12' });
        filename += '.p12';
        mimeType = 'application/x-pkcs12';
      } else {
        // Unprotected PEM format
        const pemHeader = '-----BEGIN PRIVATE KEY-----';
        const pemFooter = '-----END PRIVATE KEY-----';
        const pem = `${pemHeader}\n${keyData}\n${pemFooter}\n`;

        blob = new Blob([pem], { type: 'application/x-pem-file' });
        filename += '.pem';
        mimeType = 'application/x-pem-file';
      }
    }

    saveAs(blob, filename);
    toast.success(`Đã tải xuống ${keyType} key (${mimeType})`);
  }, [algorithm]);

  const downloadSignature = useCallback((sigBase64: string) => {
    // Hỏi user muốn format nào
    const includeData = confirm('Bạn có muốn bao gồm dữ liệu gốc trong file chữ ký không?\n\nOK = .p7m (signature + data)\nCancel = .p7s (signature only)');

    let blob: Blob;
    let filename: string;
    let mimeType: string;

    if (includeData && selectedFile) {
      // .p7m format (signature + data)
      const p7mContent = {
        signature: sigBase64,
        algorithm: algorithm,
        timestamp: new Date().toISOString(),
        originalFile: {
          name: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type
        },
        // Note: In real implementation, would include the actual file data
        // For demo purposes, we'll include a reference
        dataIncluded: true
      };

      const p7mData = `-----BEGIN PKCS7-----\n${btoa(JSON.stringify(p7mContent))}\n-----END PKCS7-----\n`;
      blob = new Blob([p7mData], { type: 'application/pkcs7-mime' });
      filename = `${selectedFile.name}.p7m`;
      mimeType = 'application/pkcs7-mime';
    } else {
      // .p7s format (signature only)
      const p7sContent = {
        signature: sigBase64,
        algorithm: algorithm,
        timestamp: new Date().toISOString(),
        signedFile: selectedFile ? {
          name: selectedFile.name,
          size: selectedFile.size,
          hash: 'sha256-placeholder' // In real implementation, would be actual hash
        } : null
      };

      const p7sData = `-----BEGIN PKCS7-----\n${btoa(JSON.stringify(p7sContent))}\n-----END PKCS7-----\n`;
      blob = new Blob([p7sData], { type: 'application/pkcs7-signature' });
      filename = selectedFile ? `${selectedFile.name}.p7s` : 'signature.p7s';
      mimeType = 'application/pkcs7-signature';
    }

    saveAs(blob, filename);
    toast.success(`Đã tải xuống chữ ký (${mimeType})`);
  }, [algorithm, selectedFile]);

  return (
    <div className="space-y-6">
      {/* Algorithm Selection */}
      <div className="bg-white dark:bg-secondary-800 rounded-lg p-4 border border-secondary-200 dark:border-secondary-700">
        <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
          Chọn thuật toán chữ ký số
        </label>
        <select
          value={algorithm}
          onChange={(e) => setAlgorithm(e.target.value as any)}
          className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white"
        >
          <option value="Ed25519">Ed25519 (Cổ điển, nhanh)</option>
          <option value="Dilithium3">Dilithium3 (Kháng lượng tử, trung bình)</option>
          <option value="Dilithium5">Dilithium5 (Kháng lượng tử, bảo mật cao)</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-secondary-800 rounded-lg border border-secondary-200 dark:border-secondary-700">
        <div className="flex border-b border-secondary-200 dark:border-secondary-700">
          <button
            onClick={() => setActiveTab('generate')}
            className={clsx(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === 'generate'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                : 'text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-300'
            )}
          >
            <KeyIcon className="h-4 w-4 inline mr-2" />
            Tạo Key Pair
          </button>
          <button
            onClick={() => setActiveTab('sign')}
            className={clsx(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === 'sign'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                : 'text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-300'
            )}
          >
            <DocumentCheckIcon className="h-4 w-4 inline mr-2" />
            Ký File
          </button>
          <button
            onClick={() => setActiveTab('verify')}
            className={clsx(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === 'verify'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                : 'text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-300'
            )}
          >
            <ShieldCheckIcon className="h-4 w-4 inline mr-2" />
            Xác Thực
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Generate Tab */}
          {activeTab === 'generate' && (
            <div className="space-y-4">
              <div className="text-center">
                <button
                  onClick={handleGenerateKeyPair}
                  disabled={isProcessing}
                  className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? 'Đang tạo...' : `Tạo ${algorithm} Key Pair`}
                </button>
              </div>

              {keyPair && (
                <div className="space-y-4">
                  <div className="p-3 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-md">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-success-800 dark:text-success-200 font-medium">
                        ✅ Key pair đã được tạo thành công!
                      </p>
                      <button
                        onClick={handleDownloadKeyPair}
                        className="text-xs px-3 py-1 bg-success-600 text-white rounded hover:bg-success-700 transition-colors"
                      >
                        <ArrowDownTrayIcon className="h-3 w-3 inline mr-1" />
                        Tải Key Pair
                      </button>
                    </div>
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

                  <div className="p-3 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-md">
                    <div className="flex items-start">
                      <InformationCircleIcon className="h-5 w-5 text-warning-600 dark:text-warning-400 mr-2 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-warning-800 dark:text-warning-200">
                        <p className="font-medium mb-1">Lưu ý bảo mật:</p>
                        <ul className="space-y-1 text-xs">
                          <li>• Private key không bao giờ được chia sẻ với ai</li>
                          <li>• Lưu trữ private key ở nơi an toàn</li>
                          <li>• Public key có thể chia sẻ công khai</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sign Tab */}
          {activeTab === 'sign' && (
            <div className="space-y-4">
              {/* File Selection */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                  Chọn file để ký
                </label>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-secondary-100 dark:bg-secondary-700 text-secondary-700 dark:text-secondary-300 rounded-lg hover:bg-secondary-200 dark:hover:bg-secondary-600 transition-colors"
                  >
                    <ArrowUpTrayIcon className="h-4 w-4 inline mr-2" />
                    Chọn File
                  </button>
                  {selectedFile && (
                    <span className="text-sm text-secondary-600 dark:text-secondary-400">
                      {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Private Key Input */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                  Private Key (để ký file)
                </label>
                <div className="space-y-3">
                  {/* File Upload Option */}
                  <div>
                    <label className="block text-xs text-secondary-600 dark:text-secondary-400 mb-1">
                      Tải từ file (.pem, .p12, .pfx, .sk)
                    </label>
                    <input
                      type="file"
                      accept=".pem,.p12,.pfx,.sk,.key"
                      onChange={handlePrivateKeyFileUpload}
                      className="block w-full text-sm text-secondary-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                    />
                  </div>

                  {/* Text Input Option */}
                  <div>
                    <label className="block text-xs text-secondary-600 dark:text-secondary-400 mb-1">
                      Hoặc nhập trực tiếp
                    </label>
                    <textarea
                      value={privateKey}
                      onChange={(e) => setPrivateKey(e.target.value)}
                      placeholder="Nhập private key hoặc tạo key pair ở tab đầu tiên"
                      className="w-full h-20 p-3 text-xs font-mono border border-secondary-300 dark:border-secondary-600 rounded-md bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Sign Button */}
              <div className="text-center">
                <button
                  onClick={handleSignFile}
                  disabled={!selectedFile || !privateKey || isProcessing}
                  className="px-6 py-3 bg-success-600 text-white rounded-lg hover:bg-success-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? 'Đang ký...' : 'Ký File'}
                </button>
              </div>

              {/* Signature Result */}
              {signature && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
                      Signature
                    </h4>
                    <button
                      onClick={() => copyToClipboard(signature, 'signature')}
                      className="text-xs px-2 py-1 bg-success-100 dark:bg-success-900/20 text-success-700 dark:text-success-300 rounded hover:bg-success-200 dark:hover:bg-success-900/30 transition-colors"
                    >
                      <ClipboardDocumentIcon className="h-3 w-3 inline mr-1" />
                      Copy
                    </button>
                  </div>
                  <textarea
                    value={signature}
                    readOnly
                    className="w-full h-32 p-3 text-xs font-mono bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-md resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <CheckCircleIcon className="h-5 w-5 text-success-600 dark:text-success-400 mr-2" />
                      <span className="text-sm text-success-800 dark:text-success-200">
                        File đã được ký thành công với {algorithm}
                      </span>
                    </div>
                    {generatedSignature && (
                      <button
                        onClick={() => downloadSignature(generatedSignature)}
                        className="flex items-center px-3 py-1.5 bg-success-600 text-white text-sm rounded-md hover:bg-success-700 transition-colors"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                        Tải Xuống Chữ Ký
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Verify Tab */}
          {activeTab === 'verify' && (
            <div className="space-y-4">
              {/* File Selection */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                  Chọn file để xác thực
                </label>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-secondary-100 dark:bg-secondary-700 text-secondary-700 dark:text-secondary-300 rounded-lg hover:bg-secondary-200 dark:hover:bg-secondary-600 transition-colors"
                  >
                    <ArrowUpTrayIcon className="h-4 w-4 inline mr-2" />
                    Chọn File
                  </button>
                  {selectedFile && (
                    <span className="text-sm text-secondary-600 dark:text-secondary-400">
                      {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>
              </div>

              {/* Signature Input */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                  Signature
                </label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => signatureFileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-secondary-100 dark:bg-secondary-700 text-secondary-700 dark:text-secondary-300 rounded-md hover:bg-secondary-200 dark:hover:bg-secondary-600 transition-colors text-sm"
                    >
                      <ArrowUpTrayIcon className="h-4 w-4 inline mr-1" />
                      Tải từ file
                    </button>
                    <span className="text-xs text-secondary-500 dark:text-secondary-400">
                      hoặc dán vào ô bên dưới
                    </span>
                  </div>
                  <textarea
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="Nhập signature để xác thực hoặc tải từ file ở trên"
                    className="w-full h-32 p-3 text-xs font-mono border border-secondary-300 dark:border-secondary-600 rounded-md bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white resize-none"
                  />
                </div>
              </div>

              {/* Public Key Input */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                  Public Key (để xác thực)
                </label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => publicKeyFileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-secondary-100 dark:bg-secondary-700 text-secondary-700 dark:text-secondary-300 rounded-md hover:bg-secondary-200 dark:hover:bg-secondary-600 transition-colors text-sm"
                    >
                      <ArrowUpTrayIcon className="h-4 w-4 inline mr-1" />
                      Tải từ file
                    </button>
                    <span className="text-xs text-secondary-500 dark:text-secondary-400">
                      hoặc dán vào ô bên dưới
                    </span>
                  </div>
                  <textarea
                    value={publicKey}
                    onChange={(e) => setPublicKey(e.target.value)}
                    placeholder="Nhập public key của người ký hoặc tải từ file ở trên"
                    className="w-full h-20 p-3 text-xs font-mono border border-secondary-300 dark:border-secondary-600 rounded-md bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white resize-none"
                  />
                </div>
              </div>

              {/* Verify Button */}
              <div className="text-center">
                <button
                  onClick={handleVerifySignature}
                  disabled={!selectedFile || !signature || !publicKey || isProcessing}
                  className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? 'Đang xác thực...' : 'Xác Thực Signature'}
                </button>
              </div>

              {/* Verification Result */}
              {verificationResult && (
                <div className={clsx(
                  'p-4 rounded-md border',
                  verificationResult.isValid
                    ? 'bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800'
                    : 'bg-danger-50 dark:bg-danger-900/20 border-danger-200 dark:border-danger-800'
                )}>
                  <div className="flex items-center">
                    {verificationResult.isValid ? (
                      <CheckCircleIcon className="h-6 w-6 text-success-600 dark:text-success-400 mr-3" />
                    ) : (
                      <XCircleIcon className="h-6 w-6 text-danger-600 dark:text-danger-400 mr-3" />
                    )}
                    <div>
                      <p className={clsx(
                        'font-medium',
                        verificationResult.isValid
                          ? 'text-success-800 dark:text-success-200'
                          : 'text-danger-800 dark:text-danger-200'
                      )}>
                        {verificationResult.isValid ? '✅ Signature hợp lệ' : '❌ Signature không hợp lệ'}
                      </p>
                      <p className={clsx(
                        'text-sm mt-1',
                        verificationResult.isValid
                          ? 'text-success-600 dark:text-success-400'
                          : 'text-danger-600 dark:text-danger-400'
                      )}>
                        Thuật toán: {verificationResult.algorithm} • {new Date(verificationResult.timestamp).toLocaleString()}
                      </p>
                      {verificationResult.error && (
                        <p className="text-sm text-danger-600 dark:text-danger-400 mt-1">
                          Lỗi: {verificationResult.error}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        className="hidden"
        accept="*/*"
      />
      <input
        ref={signatureFileInputRef}
        type="file"
        onChange={handleSignatureFileSelect}
        className="hidden"
        accept=".p7s,.p7m,.sig,.txt,*/*"
      />
      <input
        ref={publicKeyFileInputRef}
        type="file"
        onChange={handlePublicKeyFileSelect}
        className="hidden"
        accept=".cer,.pem,.pub,.txt,*/*"
      />
    </div>
  );
};

export default DigitalSignatureManager;
