import React, { useState, useRef } from 'react';
import { toast } from 'react-hot-toast';
import {
  KeyIcon,
  DocumentIcon,
  ShieldCheckIcon,
  CpuChipIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { ZeroKnowledgeEncryption } from '../../crypto/zero_knowledge';

interface KeyPair {
  privateKey: string;
  publicKey: string;
  algorithm: 'Ed25519' | 'Dilithium3' | 'Dilithium5';
}

interface SignatureData {
  signature: string;
  algorithm: 'Ed25519' | 'Dilithium3' | 'Dilithium5';
  timestamp: string;
  fileHash: string;
  fileName: string;
}

const DigitalSignatureV2: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'generate' | 'sign' | 'verify'>('generate');
  const [algorithm, setAlgorithm] = useState<'Ed25519' | 'Dilithium3' | 'Dilithium5'>('Ed25519');
  
  // Key Generation State
  const [generatedKeys, setGeneratedKeys] = useState<KeyPair | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Signing State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [signatureResult, setSignatureResult] = useState<SignatureData | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  
  // Verification State
  const [verifyFile, setVerifyFile] = useState<File | null>(null);
  const [signatureInput, setSignatureInput] = useState('');
  const [publicKeyInput, setPublicKeyInput] = useState('');
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const verifyFileInputRef = useRef<HTMLInputElement>(null);
  const privateKeyFileRef = useRef<HTMLInputElement>(null);
  const publicKeyFileRef = useRef<HTMLInputElement>(null);
  const signatureFileRef = useRef<HTMLInputElement>(null);

  // 1. Tạo khóa
  const generateKeyPair = async () => {
    setIsGenerating(true);
    try {
      const keyPair = await ZeroKnowledgeEncryption.generateKeyPair(algorithm);
      
      const keys: KeyPair = {
        privateKey: btoa(String.fromCharCode(...keyPair.privateKey)),
        publicKey: btoa(String.fromCharCode(...keyPair.publicKey)),
        algorithm
      };
      
      setGeneratedKeys(keys);
      toast.success(`Đã tạo cặp khóa ${algorithm} thành công!`);
    } catch (error) {
      toast.error(`Lỗi tạo khóa: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Download key files
  const downloadKey = (keyData: string, filename: string) => {
    const blob = new Blob([keyData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Clean PEM format
  const cleanPemFormat = (keyData: string): string => {
    return keyData
      .replace(/-----BEGIN [A-Z ]+-----/g, '')
      .replace(/-----END [A-Z ]+-----/g, '')
      .replace(/\s+/g, '');
  };

  // Parse key input (hex, base64, or raw)
  const parseKeyInput = (input: string): Uint8Array => {
    const cleaned = cleanPemFormat(input.trim());
    
    try {
      // Try base64 first
      const base64Decoded = atob(cleaned);
      return new Uint8Array(base64Decoded.split('').map(c => c.charCodeAt(0)));
    } catch {
      try {
        // Try hex
        if (cleaned.match(/^[0-9a-fA-F]+$/)) {
          const hexBytes = cleaned.match(/.{1,2}/g) || [];
          return new Uint8Array(hexBytes.map(byte => parseInt(byte, 16)));
        }
      } catch {
        // Raw bytes
        return new TextEncoder().encode(cleaned);
      }
    }
    
    throw new Error('Không thể parse key. Hỗ trợ hex, base64, hoặc raw format.');
  };

  // 2. Ký số
  const signFile = async () => {
    if (!selectedFile || !privateKeyInput.trim()) {
      toast.error('Vui lòng chọn file và nhập private key');
      return;
    }

    setIsSigning(true);
    try {
      const fileData = new Uint8Array(await selectedFile.arrayBuffer());
      const privateKey = parseKeyInput(privateKeyInput);
      
      const signature = await ZeroKnowledgeEncryption.sign(fileData, privateKey, algorithm);
      const fileHash = await crypto.subtle.digest('SHA-256', fileData);
      
      const result: SignatureData = {
        signature: btoa(String.fromCharCode(...signature)),
        algorithm,
        timestamp: new Date().toISOString(),
        fileHash: btoa(String.fromCharCode(...new Uint8Array(fileHash))),
        fileName: selectedFile.name
      };
      
      setSignatureResult(result);
      toast.success('Đã ký file thành công!');
    } catch (error) {
      toast.error(`Lỗi ký số: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSigning(false);
    }
  };

  // 3. Xác thực chữ ký
  const verifySignature = async () => {
    if (!verifyFile || !signatureInput.trim() || !publicKeyInput.trim()) {
      toast.error('Vui lòng nhập đầy đủ thông tin để xác thực');
      return;
    }

    setIsVerifying(true);
    try {
      const fileData = new Uint8Array(await verifyFile.arrayBuffer());
      const signature = parseKeyInput(signatureInput);
      const publicKey = parseKeyInput(publicKeyInput);
      
      const isValid = await ZeroKnowledgeEncryption.verify(fileData, signature, publicKey, algorithm);
      
      setVerificationResult(isValid);
      toast.success(isValid ? 'Chữ ký hợp lệ!' : 'Chữ ký không hợp lệ!');
    } catch (error) {
      setVerificationResult(false);
      toast.error(`Lỗi xác thực: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsVerifying(false);
    }
  };

  // Load file content
  const loadFileContent = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // Handle file imports
  const handlePrivateKeyFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const content = await loadFileContent(file);
        setPrivateKeyInput(content);
        toast.success('Đã load private key từ file');
      } catch (error) {
        toast.error('Lỗi đọc file private key');
      }
    }
  };

  const handlePublicKeyFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const content = await loadFileContent(file);
        setPublicKeyInput(content);
        toast.success('Đã load public key từ file');
      } catch (error) {
        toast.error('Lỗi đọc file public key');
      }
    }
  };

  const handleSignatureFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const content = await loadFileContent(file);
        setSignatureInput(content);
        toast.success('Đã load signature từ file');
      } catch (error) {
        toast.error('Lỗi đọc file signature');
      }
    }
  };

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-secondary-900">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">
            Chữ Ký Số
          </h1>
          <p className="text-secondary-600 dark:text-secondary-400">
            Tạo và xác thực chữ ký số với công nghệ Post-Quantum
          </p>
        </div>

        {/* Algorithm Selection */}
        <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-sm border border-secondary-200 dark:border-secondary-700 mb-6 p-6">
          <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-4 flex items-center">
            <CpuChipIcon className="h-5 w-5 mr-2" />
            Cấu hình thuật toán
          </h3>
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
              Thuật toán chữ ký
            </label>
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value as any)}
              className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="Ed25519">Ed25519 (Classical)</option>
              <option value="Dilithium3">Dilithium3 (Post-Quantum)</option>
              <option value="Dilithium5">Dilithium5 (High Security PQ)</option>
            </select>
            <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
              {algorithm === 'Ed25519' && 'Thuật toán cổ điển, nhanh và nhỏ gọn'}
              {algorithm === 'Dilithium3' && 'Kháng lượng tử, mức bảo mật chuẩn'}
              {algorithm === 'Dilithium5' && 'Kháng lượng tử, mức bảo mật cao nhất'}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-sm border border-secondary-200 dark:border-secondary-700 mb-6">
          <div className="flex space-x-1 p-1 bg-secondary-100 dark:bg-secondary-700 rounded-lg m-4">
            {[
              { id: 'generate', label: '1. Tạo Khóa', icon: KeyIcon },
              { id: 'sign', label: '2. Ký Số', icon: DocumentIcon },
              { id: 'verify', label: '3. Xác Thực', icon: ShieldCheckIcon }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={clsx(
                  'flex-1 py-3 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2',
                  activeTab === tab.id
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-secondary-700 dark:text-secondary-300 hover:bg-secondary-200 dark:hover:bg-secondary-600'
                )}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
        className="hidden"
      />
      <input
        ref={verifyFileInputRef}
        type="file"
        onChange={(e) => setVerifyFile(e.target.files?.[0] || null)}
        className="hidden"
      />
      <input
        ref={privateKeyFileRef}
        type="file"
        accept=".sk,.pem,.key,.txt"
        onChange={handlePrivateKeyFile}
        className="hidden"
      />
      <input
        ref={publicKeyFileRef}
        type="file"
        accept=".pk,.pem,.key,.txt"
        onChange={handlePublicKeyFile}
        className="hidden"
      />
      <input
        ref={signatureFileRef}
        type="file"
        accept=".sig,.txt"
        onChange={handleSignatureFile}
        className="hidden"
      />

        {/* Tab Content */}
        <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-sm border border-secondary-200 dark:border-secondary-700 p-6">
          {activeTab === 'generate' && (
            <div className="space-y-6">
          <div className="text-center">
                          <button
                onClick={generateKeyPair}
                disabled={isGenerating}
                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGenerating ? 'Đang tạo khóa...' : `Tạo cặp khóa ${algorithm}`}
              </button>
          </div>

          {generatedKeys && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Private Key (.sk)</h3>
                <textarea
                  value={generatedKeys.privateKey}
                  readOnly
                  className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                />
                <button
                  onClick={() => downloadKey(generatedKeys.privateKey, `private.sk`)}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Tải xuống Private Key
                </button>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Public Key (.pk)</h3>
                <textarea
                  value={generatedKeys.publicKey}
                  readOnly
                  className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                />
                <button
                  onClick={() => downloadKey(generatedKeys.publicKey, `public.pk`)}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Tải xuống Public Key
                </button>
              </div>
            </div>
          )}
            </div>
          )}

          {activeTab === 'sign' && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Chọn file cần ký
            </label>
            <div className="flex space-x-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Chọn File
              </button>
              {selectedFile && (
                <span className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm">
                  {selectedFile.name}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Private Key (hex/base64/raw hoặc import từ file .sk/.pem)
            </label>
            <div className="space-y-2">
              <textarea
                value={privateKeyInput}
                onChange={(e) => setPrivateKeyInput(e.target.value)}
                placeholder="Nhập private key hoặc import từ file..."
                className="w-full h-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
              />
              <button
                onClick={() => privateKeyFileRef.current?.click()}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Import từ file .sk/.pem
              </button>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={signFile}
              disabled={isSigning || !selectedFile || !privateKeyInput.trim()}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSigning ? 'Đang ký...' : 'Ký File'}
            </button>
          </div>

          {signatureResult && (
            <div className="space-y-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                Chữ ký đã được tạo thành công!
              </h3>
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  File: {signatureResult.fileName} | Algorithm: {signatureResult.algorithm}
                </p>
                <textarea
                  value={signatureResult.signature}
                  readOnly
                  className="w-full h-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                />
                <button
                  onClick={() => downloadKey(signatureResult.signature, `${signatureResult.fileName}.sig`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Tải xuống chữ ký (.sig)
                </button>
              </div>
            </div>
          )}
            </div>
          )}

          {activeTab === 'verify' && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Chọn file gốc để xác thực
            </label>
            <div className="flex space-x-2">
              <button
                onClick={() => verifyFileInputRef.current?.click()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Chọn File
              </button>
              {verifyFile && (
                <span className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm">
                  {verifyFile.name}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Chữ ký (.sig hoặc nhập trực tiếp)
            </label>
            <div className="space-y-2">
              <textarea
                value={signatureInput}
                onChange={(e) => setSignatureInput(e.target.value)}
                placeholder="Nhập chữ ký hoặc import từ file .sig..."
                className="w-full h-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
              />
              <button
                onClick={() => signatureFileRef.current?.click()}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Import từ file .sig
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Public Key (hex/base64 hoặc import từ file .pk/.pem)
            </label>
            <div className="space-y-2">
              <textarea
                value={publicKeyInput}
                onChange={(e) => setPublicKeyInput(e.target.value)}
                placeholder="Nhập public key hoặc import từ file..."
                className="w-full h-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
              />
              <button
                onClick={() => publicKeyFileRef.current?.click()}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Import từ file .pk/.pem
              </button>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={verifySignature}
              disabled={isVerifying || !verifyFile || !signatureInput.trim() || !publicKeyInput.trim()}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying ? 'Đang xác thực...' : 'Xác thực chữ ký'}
            </button>
          </div>

          {verificationResult !== null && (
            <div className={`p-4 rounded-lg ${
              verificationResult 
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
            }`}>
              <h3 className="text-lg font-semibold">
                {verificationResult ? '✅ Chữ ký hợp lệ' : '❌ Chữ ký không hợp lệ'}
              </h3>
              <p className="text-sm mt-1">
                {verificationResult 
                  ? 'File chưa bị thay đổi và chữ ký được tạo bởi người sở hữu private key.'
                  : 'File có thể đã bị thay đổi hoặc chữ ký không đúng.'
                }
              </p>
            </div>
          )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DigitalSignatureV2;
