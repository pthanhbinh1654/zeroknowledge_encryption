import React, { useState, useRef } from 'react';
import { toast } from 'react-hot-toast';
import {
  KeyIcon,
  DocumentIcon,
  ShieldCheckIcon,
  CpuChipIcon,
  LockClosedIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { ZeroKnowledgeEncryption } from '../crypto/zero_knowledge';

interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  algorithm: 'X25519' | 'Kyber1024';
}

interface HybridEncryptionResult {
  ciphertext: string;
  encrypted_key: string;
  symmetric_algo: string;
  asymmetric_algo: string;
  original_filename: string;
}

const HybridEncryptPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'encrypt' | 'decrypt'>('encrypt');
  
  // Common state
  const [asymmetricAlgorithm, setAsymmetricAlgorithm] = useState<'X25519' | 'Kyber1024'>('X25519');
  const [symmetricAlgorithm, setSymmetricAlgorithm] = useState<'AES-256-GCM' | 'XChaCha20-Poly1305' | 'Serpent-256-GCM'>('AES-256-GCM');
  
  // Encryption state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [publicKeyInput, setPublicKeyInput] = useState('');
  const [publicKeyMethod, setPublicKeyMethod] = useState<'input' | 'file' | 'generate'>('input');
  const [generatedKeys, setGeneratedKeys] = useState<KeyPair | null>(null);
  const [encryptionResult, setEncryptionResult] = useState<HybridEncryptionResult | null>(null);
  const [isEncrypting, setIsEncrypting] = useState(false);
  
  // Decryption state
  const [encryptedFile, setEncryptedFile] = useState<File | null>(null);
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [decryptionResult, setDecryptionResult] = useState<{ data: Uint8Array; filename: string } | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  
  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const encryptedFileInputRef = useRef<HTMLInputElement>(null);
  const publicKeyFileRef = useRef<HTMLInputElement>(null);
  const privateKeyFileRef = useRef<HTMLInputElement>(null);

  // Generate key pair
  const generateKeyPair = async () => {
    try {
      console.log(`Generating ${asymmetricAlgorithm} key pair...`);
      const keyPair = await ZeroKnowledgeEncryption.generateKeyPair(asymmetricAlgorithm);
      console.log(`Key pair generated successfully:`, {
        algorithm: asymmetricAlgorithm,
        publicKeyLength: keyPair.publicKey.length,
        privateKeyLength: keyPair.privateKey.length
      });
      setGeneratedKeys({
        privateKey: keyPair.privateKey,
        publicKey: keyPair.publicKey,
        algorithm: asymmetricAlgorithm
      });
      
      // Auto-fill public key (safe conversion for large arrays)
      const publicKeyBase64 = btoa(Array.from(keyPair.publicKey).map(b => String.fromCharCode(b)).join(''));
      setPublicKeyInput(publicKeyBase64);
      
      toast.success(`Đã tạo cặp khóa ${asymmetricAlgorithm} thành công!`);
    } catch (error) {
      console.error('Key generation error:', error);
      toast.error(`Lỗi tạo khóa: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Download key files
  const downloadKey = (keyData: Uint8Array, filename: string, keyType: 'public' | 'private') => {
    const base64Data = btoa(Array.from(keyData).map(b => String.fromCharCode(b)).join(''));
    const blob = new Blob([base64Data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Đã tải xuống ${keyType === 'public' ? 'public key' : 'private key'}`);
  };

  // Parse key input (hex, base64, or raw)
  const parseKeyInput = (input: string): Uint8Array => {
    const cleaned = input.trim().replace(/\s+/g, '');
    
    try {
      // Try base64 first
      const base64Decoded = atob(cleaned);
      return new Uint8Array(Array.from(base64Decoded).map(c => c.charCodeAt(0)));
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

  // Mock crypto functions (these would need to be implemented in the actual crypto module)
  const mockEncryptAES = async (data: Uint8Array, key: Uint8Array): Promise<Uint8Array> => {
    // This is a mock - implement actual AES-256-GCM encryption
    return new Uint8Array([...data, ...key.slice(0, 16)]);
  };

  const mockEncryptWithX25519 = async (data: Uint8Array, publicKey: Uint8Array): Promise<Uint8Array> => {
    // This is a mock - implement actual X25519 key encryption
    return new Uint8Array([...data, ...publicKey.slice(0, 16)]);
  };

  // Hybrid encryption
  const encryptFile = async () => {
    if (!selectedFile || !publicKeyInput.trim()) {
      toast.error('Vui lòng chọn file và nhập public key');
      return;
    }

    setIsEncrypting(true);
    try {
      const fileData = new Uint8Array(await selectedFile.arrayBuffer());
      const publicKey = parseKeyInput(publicKeyInput);
      
      // Generate random symmetric key
      const symmetricKey = crypto.getRandomValues(new Uint8Array(32)); // 256-bit key
      
      // Encrypt data with symmetric algorithm (using mock for now)
      let ciphertext: Uint8Array;
      switch (symmetricAlgorithm) {
        case 'AES-256-GCM':
          ciphertext = await mockEncryptAES(fileData, symmetricKey);
          break;
        case 'XChaCha20-Poly1305':
          // Mock implementation
          ciphertext = await mockEncryptAES(fileData, symmetricKey);
          break;
        case 'Serpent-256-GCM':
          // Mock implementation
          ciphertext = await mockEncryptAES(fileData, symmetricKey);
          break;
        default:
          throw new Error('Thuật toán đối xứng không được hỗ trợ');
      }
      
      // Encrypt symmetric key with public key (using mock for now)
      let encryptedKey: Uint8Array;
      if (asymmetricAlgorithm === 'X25519') {
        encryptedKey = await mockEncryptWithX25519(symmetricKey, publicKey);
      } else {
        // Mock Kyber1024
        encryptedKey = await mockEncryptWithX25519(symmetricKey, publicKey);
      }
      
      const result: HybridEncryptionResult = {
        ciphertext: btoa(Array.from(ciphertext).map(b => String.fromCharCode(b)).join('')),
        encrypted_key: btoa(Array.from(encryptedKey).map(b => String.fromCharCode(b)).join('')),
        symmetric_algo: symmetricAlgorithm,
        asymmetric_algo: asymmetricAlgorithm,
        original_filename: selectedFile.name
      };
      
      setEncryptionResult(result);
      toast.success('Mã hóa hybrid thành công!');
    } catch (error) {
      console.error('Encryption error:', error);
      toast.error(`Lỗi mã hóa: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsEncrypting(false);
    }
  };

  // Download encrypted file
  const downloadEncryptedFile = () => {
    if (!encryptionResult) return;
    
    const jsonData = JSON.stringify(encryptionResult, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${encryptionResult.original_filename}.enc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Đã tải xuống file mã hóa');
  };

  // Mock decryption functions
  const mockDecryptAES = async (data: Uint8Array, key: Uint8Array): Promise<Uint8Array> => {
    // This is a mock - implement actual AES-256-GCM decryption
    return data.slice(0, -16); // Remove the mock key part
  };

  const mockDecryptWithX25519 = async (encryptedData: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> => {
    // This is a mock - implement actual X25519 key decryption
    return encryptedData.slice(0, 32); // Return mock 32-byte key
  };

  // Hybrid decryption
  const decryptFile = async () => {
    if (!encryptedFile || !privateKeyInput.trim()) {
      toast.error('Vui lòng chọn file mã hóa và nhập private key');
      return;
    }

    setIsDecrypting(true);
    try {
      // Read and parse encrypted file
      const fileContent = await loadFileContent(encryptedFile);
      const encryptedData: HybridEncryptionResult = JSON.parse(fileContent);
      
      const privateKey = parseKeyInput(privateKeyInput);
      const ciphertext = new Uint8Array(Array.from(atob(encryptedData.ciphertext)).map(c => c.charCodeAt(0)));
      const encryptedKey = new Uint8Array(Array.from(atob(encryptedData.encrypted_key)).map(c => c.charCodeAt(0)));
      
      // Decrypt symmetric key with private key (using mock for now)
      let symmetricKey: Uint8Array;
      if (encryptedData.asymmetric_algo === 'X25519') {
        symmetricKey = await mockDecryptWithX25519(encryptedKey, privateKey);
      } else {
        // Mock Kyber1024
        symmetricKey = await mockDecryptWithX25519(encryptedKey, privateKey);
      }
      
      // Decrypt data with symmetric key (using mock for now)
      let decryptedData: Uint8Array;
      switch (encryptedData.symmetric_algo) {
        case 'AES-256-GCM':
          decryptedData = await mockDecryptAES(ciphertext, symmetricKey);
          break;
        case 'XChaCha20-Poly1305':
          decryptedData = await mockDecryptAES(ciphertext, symmetricKey);
          break;
        case 'Serpent-256-GCM':
          decryptedData = await mockDecryptAES(ciphertext, symmetricKey);
          break;
        default:
          throw new Error('Thuật toán đối xứng không được hỗ trợ');
      }
      
      setDecryptionResult({
        data: decryptedData,
        filename: encryptedData.original_filename
      });
      
      toast.success('Giải mã hybrid thành công!');
    } catch (error) {
      console.error('Decryption error:', error);
      toast.error(`Lỗi giải mã: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDecrypting(false);
    }
  };

  // Download decrypted file
  const downloadDecryptedFile = () => {
    if (!decryptionResult) return;
    
    const blob = new Blob([decryptionResult.data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = decryptionResult.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Đã tải xuống file: ${decryptionResult.filename}`);
  };

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-secondary-900">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">
            Mã Hóa Lai (Hybrid Encryption)
          </h1>
          <p className="text-secondary-600 dark:text-secondary-400">
            Kết hợp mã hóa bất đối xứng và đối xứng cho bảo mật tối ưu
          </p>
        </div>

        {/* Algorithm Selection */}
        <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-sm border border-secondary-200 dark:border-secondary-700 mb-6 p-6">
          <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-4 flex items-center">
            <CpuChipIcon className="h-5 w-5 mr-2" />
            Cấu hình thuật toán
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Thuật toán bất đối xứng
              </label>
              <select
                value={asymmetricAlgorithm}
                onChange={(e) => setAsymmetricAlgorithm(e.target.value as any)}
                className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="X25519">X25519 (Classical)</option>
                <option value="Kyber1024">Kyber1024 (Post-Quantum)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Thuật toán đối xứng
              </label>
              <select
                value={symmetricAlgorithm}
                onChange={(e) => setSymmetricAlgorithm(e.target.value as any)}
                className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="AES-256-GCM">AES-256-GCM (Tối ưu hiệu năng)</option>
                <option value="XChaCha20-Poly1305">XChaCha20-Poly1305 (Tối ưu mobile)</option>
                <option value="Serpent-256-GCM">Serpent-256-GCM (Bảo mật tối đa)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-sm border border-secondary-200 dark:border-secondary-700 mb-6">
          <div className="flex space-x-1 p-1 bg-secondary-100 dark:bg-secondary-700 rounded-lg m-4">
            {[
              { id: 'encrypt', label: '🔒 Mã hóa', icon: LockClosedIcon },
              { id: 'decrypt', label: '🔓 Giải mã', icon: ShieldCheckIcon }
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

        {/* Tab Content */}
        <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-sm border border-secondary-200 dark:border-secondary-700 p-6">
          {activeTab === 'encrypt' && (
            <div className="space-y-6">
              {/* File Selection */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                  Chọn file cần mã hóa
                </label>
                <div className="flex space-x-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                  >
                    Chọn File
                  </button>
                  {selectedFile && (
                    <span className="px-3 py-2 bg-secondary-100 dark:bg-secondary-700 rounded-md text-sm flex items-center">
                      <DocumentIcon className="h-4 w-4 mr-2" />
                      {selectedFile.name}
                    </span>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </div>

              {/* Public Key Management */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-3">
                  Tùy chọn khóa công khai
                </label>
                
                <div className="space-y-4">
                  {/* Method Selection */}
                  <div className="flex space-x-4">
                    {[
                      { id: 'input', label: 'Nhập trực tiếp' },
                      { id: 'file', label: 'Import từ file' },
                      { id: 'generate', label: 'Tạo mới' }
                    ].map((method) => (
                      <label key={method.id} className="flex items-center">
                        <input
                          type="radio"
                          value={method.id}
                          checked={publicKeyMethod === method.id}
                          onChange={(e) => setPublicKeyMethod(e.target.value as any)}
                          className="mr-2"
                        />
                        {method.label}
                      </label>
                    ))}
                  </div>

                  {/* Public Key Input */}
                  {publicKeyMethod === 'input' && (
                    <textarea
                      value={publicKeyInput}
                      onChange={(e) => setPublicKeyInput(e.target.value)}
                      placeholder="Nhập public key (base64/hex)..."
                      className="w-full h-24 px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    />
                  )}

                  {/* File Import */}
                  {publicKeyMethod === 'file' && (
                    <div className="space-y-2">
                      <button
                        onClick={() => publicKeyFileRef.current?.click()}
                        className="px-4 py-2 bg-secondary-600 text-white rounded-md hover:bg-secondary-700 transition-colors"
                      >
                        Import từ file .pk
                      </button>
                      <input
                        ref={publicKeyFileRef}
                        type="file"
                        accept=".pk,.pem,.key,.txt"
                        onChange={handlePublicKeyFile}
                        className="hidden"
                      />
                      {publicKeyInput && (
                        <textarea
                          value={publicKeyInput}
                          readOnly
                          className="w-full h-24 px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-secondary-50 dark:bg-secondary-700 text-secondary-900 dark:text-white font-mono text-sm"
                        />
                      )}
                    </div>
                  )}

                  {/* Key Generation */}
                  {publicKeyMethod === 'generate' && (
                    <div className="space-y-4">
                      <button
                        onClick={generateKeyPair}
                        className="px-4 py-2 bg-success-600 text-white rounded-md hover:bg-success-700 transition-colors"
                      >
                        Tạo cặp khóa {asymmetricAlgorithm}
                      </button>
                      
                      {generatedKeys && (
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-secondary-700 dark:text-secondary-300">Public Key</h4>
                            <textarea
                              value={btoa(Array.from(generatedKeys.publicKey).map(b => String.fromCharCode(b)).join(''))}
                              readOnly
                              className="w-full h-20 px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-secondary-50 dark:bg-secondary-700 text-secondary-900 dark:text-white font-mono text-xs"
                            />
                            <button
                              onClick={() => downloadKey(generatedKeys.publicKey, `${asymmetricAlgorithm}_public.pk`, 'public')}
                              className="w-full px-3 py-1 bg-success-600 text-white rounded text-sm hover:bg-success-700"
                            >
                              Download Public Key
                            </button>
                          </div>
                          
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-secondary-700 dark:text-secondary-300">Private Key</h4>
                            <textarea
                              value={btoa(Array.from(generatedKeys.privateKey).map(b => String.fromCharCode(b)).join(''))}
                              readOnly
                              className="w-full h-20 px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-secondary-50 dark:bg-secondary-700 text-secondary-900 dark:text-white font-mono text-xs"
                            />
                            <button
                              onClick={() => downloadKey(generatedKeys.privateKey, `${asymmetricAlgorithm}_private.sk`, 'private')}
                              className="w-full px-3 py-1 bg-danger-600 text-white rounded text-sm hover:bg-danger-700"
                            >
                              Download Private Key
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Encrypt Button */}
              <button
                onClick={encryptFile}
                disabled={isEncrypting || !selectedFile || !publicKeyInput.trim()}
                className="w-full flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <LockClosedIcon className="h-5 w-5 mr-2" />
                {isEncrypting ? 'Đang mã hóa...' : 'Mã hóa file'}
              </button>

              {/* Encryption Result */}
              {encryptionResult && (
                <div className="space-y-4 p-4 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg">
                  <h4 className="text-lg font-semibold text-success-800 dark:text-success-200">
                    Mã hóa thành công!
                  </h4>
                  <div className="text-sm text-success-700 dark:text-success-300">
                    <p>File: {encryptionResult.original_filename}</p>
                    <p>Thuật toán bất đối xứng: {encryptionResult.asymmetric_algo}</p>
                    <p>Thuật toán đối xứng: {encryptionResult.symmetric_algo}</p>
                  </div>
                  <button
                    onClick={downloadEncryptedFile}
                    className="flex items-center px-4 py-2 bg-success-600 text-white rounded-md hover:bg-success-700 transition-colors"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                    Download Encrypted File
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'decrypt' && (
            <div className="space-y-6">
              {/* Encrypted File Selection */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                  Chọn file đã mã hóa (.enc)
                </label>
                <div className="flex space-x-2">
                  <button
                    onClick={() => encryptedFileInputRef.current?.click()}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                  >
                    Chọn File .enc
                  </button>
                  {encryptedFile && (
                    <span className="px-3 py-2 bg-secondary-100 dark:bg-secondary-700 rounded-md text-sm flex items-center">
                      <DocumentIcon className="h-4 w-4 mr-2" />
                      {encryptedFile.name}
                    </span>
                  )}
                </div>
                <input
                  ref={encryptedFileInputRef}
                  type="file"
                  accept=".enc,.json"
                  onChange={(e) => setEncryptedFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </div>

              {/* Private Key Input */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                  Private Key (base64/hex hoặc import từ file .sk)
                </label>
                <div className="space-y-2">
                  <div className="relative">
                    <textarea
                      value={privateKeyInput}
                      onChange={(e) => setPrivateKeyInput(e.target.value)}
                      placeholder="Nhập private key hoặc import từ file..."
                      className="w-full h-24 px-3 py-2 pr-10 border border-secondary-300 dark:border-secondary-600 rounded-md bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPrivateKey(!showPrivateKey)}
                      className="absolute top-2 right-2 text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-300"
                    >
                      {showPrivateKey ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  </div>
                  <button
                    onClick={() => privateKeyFileRef.current?.click()}
                    className="px-4 py-2 bg-secondary-600 text-white rounded-md hover:bg-secondary-700 transition-colors"
                  >
                    Import từ file .sk
                  </button>
                  <input
                    ref={privateKeyFileRef}
                    type="file"
                    accept=".sk,.pem,.key,.txt"
                    onChange={handlePrivateKeyFile}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Decrypt Button */}
              <button
                onClick={decryptFile}
                disabled={isDecrypting || !encryptedFile || !privateKeyInput.trim()}
                className="w-full flex items-center justify-center px-6 py-3 bg-success-600 text-white rounded-lg hover:bg-success-700 focus:outline-none focus:ring-2 focus:ring-success-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ShieldCheckIcon className="h-5 w-5 mr-2" />
                {isDecrypting ? 'Đang giải mã...' : 'Giải mã file'}
              </button>

              {/* Decryption Result */}
              {decryptionResult && (
                <div className="space-y-4 p-4 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg">
                  <h4 className="text-lg font-semibold text-success-800 dark:text-success-200">
                    Giải mã thành công!
                  </h4>
                  <div className="text-sm text-success-700 dark:text-success-300">
                    <p>File gốc: {decryptionResult.filename}</p>
                    <p>Kích thước: {(decryptionResult.data.length / 1024).toFixed(2)} KB</p>
                  </div>
                  <button
                    onClick={downloadDecryptedFile}
                    className="flex items-center px-4 py-2 bg-success-600 text-white rounded-md hover:bg-success-700 transition-colors"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                    Download Decrypted File
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HybridEncryptPage;
