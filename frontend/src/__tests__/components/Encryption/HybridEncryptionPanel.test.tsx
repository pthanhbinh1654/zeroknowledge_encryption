import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import HybridEncryptionPanel from '../../../components/Encryption/HybridEncryptionPanel';
import { toast } from 'react-hot-toast';

// Mock dependencies
jest.mock('react-hot-toast');
jest.mock('../../../services/hybrid-encryption.service');

const mockToast = toast as jest.Mocked<typeof toast>;

describe('HybridEncryptionPanel Component', () => {
  const mockFiles = [
    new File(['content1'], 'file1.txt', { type: 'text/plain' }),
    new File(['content2'], 'file2.pdf', { type: 'application/pdf' })
  ];

  const defaultProps = {
    files: mockFiles,
    onEncryptionComplete: jest.fn(),
    onKeyGenerated: jest.fn(),
    className: 'test-class'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders hybrid encryption panel', () => {
    render(<HybridEncryptionPanel {...defaultProps} />);
    
    expect(screen.getByText('Hybrid Encryption')).toBeInTheDocument();
    expect(screen.getByText('Mã hóa lai với Key Encapsulation Mechanism')).toBeInTheDocument();
  });

  it('shows file list', () => {
    render(<HybridEncryptionPanel {...defaultProps} />);
    
    expect(screen.getByText('file1.txt')).toBeInTheDocument();
    expect(screen.getByText('file2.pdf')).toBeInTheDocument();
    expect(screen.getByText('File đã chọn (2)')).toBeInTheDocument();
  });

  it('shows algorithm selection', () => {
    render(<HybridEncryptionPanel {...defaultProps} />);
    
    expect(screen.getByText('X25519 + AES-256-GCM')).toBeInTheDocument();
    expect(screen.getByText('Kyber1024 + ChaCha20-Poly1305')).toBeInTheDocument();
  });

  it('handles algorithm selection', () => {
    render(<HybridEncryptionPanel {...defaultProps} />);
    
    const kyberOption = screen.getByLabelText('Kyber1024 + ChaCha20-Poly1305');
    fireEvent.click(kyberOption);
    
    expect(kyberOption).toBeChecked();
  });

  it('shows recipient public key input', () => {
    render(<HybridEncryptionPanel {...defaultProps} />);
    
    expect(screen.getByLabelText('Public Key người nhận')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nhập public key của người nhận...')).toBeInTheDocument();
  });

  it('validates public key input', async () => {
    render(<HybridEncryptionPanel {...defaultProps} />);
    
    const encryptButton = screen.getByRole('button', { name: 'Mã hóa Hybrid' });
    fireEvent.click(encryptButton);
    
    await waitFor(() => {
      expect(screen.getByText('Vui lòng nhập public key người nhận')).toBeInTheDocument();
    });
  });

  it('handles hybrid encryption', async () => {
    const { hybridEncryptionService } = require('../../../services/hybrid-encryption.service');
    hybridEncryptionService.encryptFiles.mockResolvedValue({
      encryptedFiles: [
        { filename: 'file1.txt', encryptedData: 'encrypted1', keyInfo: 'key1' },
        { filename: 'file2.pdf', encryptedData: 'encrypted2', keyInfo: 'key2' }
      ],
      algorithm: 'X25519 + AES-256-GCM',
      timestamp: new Date().toISOString()
    });

    const onEncryptionComplete = jest.fn();
    render(<HybridEncryptionPanel {...defaultProps} onEncryptionComplete={onEncryptionComplete} />);
    
    const publicKeyInput = screen.getByLabelText('Public Key người nhận');
    const encryptButton = screen.getByRole('button', { name: 'Mã hóa Hybrid' });
    
    fireEvent.change(publicKeyInput, { target: { value: 'mock-public-key-base64' } });
    fireEvent.click(encryptButton);
    
    await waitFor(() => {
      expect(hybridEncryptionService.encryptFiles).toHaveBeenCalledWith(
        mockFiles,
        'mock-public-key-base64',
        'X25519 + AES-256-GCM'
      );
      expect(onEncryptionComplete).toHaveBeenCalled();
    });
  });

  it('shows encryption progress', async () => {
    const { hybridEncryptionService } = require('../../../services/hybrid-encryption.service');
    hybridEncryptionService.encryptFiles.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        encryptedFiles: [],
        algorithm: 'X25519 + AES-256-GCM',
        timestamp: new Date().toISOString()
      }), 100))
    );

    render(<HybridEncryptionPanel {...defaultProps} />);
    
    const publicKeyInput = screen.getByLabelText('Public Key người nhận');
    const encryptButton = screen.getByRole('button', { name: 'Mã hóa Hybrid' });
    
    fireEvent.change(publicKeyInput, { target: { value: 'mock-public-key' } });
    fireEvent.click(encryptButton);
    
    expect(screen.getByText('Đang mã hóa...')).toBeInTheDocument();
    expect(encryptButton).toBeDisabled();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('handles encryption error', async () => {
    const { hybridEncryptionService } = require('../../../services/hybrid-encryption.service');
    hybridEncryptionService.encryptFiles.mockRejectedValue(new Error('Encryption failed'));

    render(<HybridEncryptionPanel {...defaultProps} />);
    
    const publicKeyInput = screen.getByLabelText('Public Key người nhận');
    const encryptButton = screen.getByRole('button', { name: 'Mã hóa Hybrid' });
    
    fireEvent.change(publicKeyInput, { target: { value: 'invalid-key' } });
    fireEvent.click(encryptButton);
    
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Lỗi khi mã hóa: Encryption failed');
    });
  });

  it('shows key generation section', () => {
    render(<HybridEncryptionPanel {...defaultProps} />);
    
    expect(screen.getByText('Tạo Key Pair')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo Key Pair Mới' })).toBeInTheDocument();
  });

  it('handles key pair generation', async () => {
    const { hybridEncryptionService } = require('../../../services/hybrid-encryption.service');
    hybridEncryptionService.generateKeyPair.mockResolvedValue({
      publicKey: 'generated-public-key',
      privateKey: 'generated-private-key',
      algorithm: 'X25519'
    });

    const onKeyGenerated = jest.fn();
    render(<HybridEncryptionPanel {...defaultProps} onKeyGenerated={onKeyGenerated} />);
    
    const generateButton = screen.getByRole('button', { name: 'Tạo Key Pair Mới' });
    fireEvent.click(generateButton);
    
    await waitFor(() => {
      expect(hybridEncryptionService.generateKeyPair).toHaveBeenCalledWith('X25519 + AES-256-GCM');
      expect(onKeyGenerated).toHaveBeenCalledWith({
        publicKey: 'generated-public-key',
        privateKey: 'generated-private-key',
        algorithm: 'X25519'
      });
    });
  });

  it('shows generated keys', async () => {
    const { hybridEncryptionService } = require('../../../services/hybrid-encryption.service');
    hybridEncryptionService.generateKeyPair.mockResolvedValue({
      publicKey: 'test-public-key-123',
      privateKey: 'test-private-key-456',
      algorithm: 'X25519'
    });

    render(<HybridEncryptionPanel {...defaultProps} />);
    
    const generateButton = screen.getByRole('button', { name: 'Tạo Key Pair Mới' });
    fireEvent.click(generateButton);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('test-public-key-123')).toBeInTheDocument();
      expect(screen.getByDisplayValue('test-private-key-456')).toBeInTheDocument();
    });
  });

  it('handles key export', async () => {
    const { hybridEncryptionService } = require('../../../services/hybrid-encryption.service');
    hybridEncryptionService.generateKeyPair.mockResolvedValue({
      publicKey: 'export-public-key',
      privateKey: 'export-private-key',
      algorithm: 'X25519'
    });

    // Mock file download
    global.URL.createObjectURL = jest.fn().mockReturnValue('mock-url');
    global.URL.revokeObjectURL = jest.fn();

    render(<HybridEncryptionPanel {...defaultProps} />);
    
    const generateButton = screen.getByRole('button', { name: 'Tạo Key Pair Mới' });
    fireEvent.click(generateButton);
    
    await waitFor(() => {
      const exportButton = screen.getByRole('button', { name: 'Export Keys' });
      fireEvent.click(exportButton);
      
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  it('shows algorithm information', () => {
    render(<HybridEncryptionPanel {...defaultProps} />);
    
    expect(screen.getByText(/X25519.*Elliptic Curve/)).toBeInTheDocument();
    expect(screen.getByText(/Kyber1024.*Post-quantum/)).toBeInTheDocument();
  });

  it('shows empty state when no files', () => {
    render(<HybridEncryptionPanel {...defaultProps} files={[]} />);
    
    expect(screen.getByText('Chưa có file nào được chọn')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng chọn file để mã hóa hybrid')).toBeInTheDocument();
  });

  it('disables encryption when no files', () => {
    render(<HybridEncryptionPanel {...defaultProps} files={[]} />);
    
    const encryptButton = screen.getByRole('button', { name: 'Mã hóa Hybrid' });
    expect(encryptButton).toBeDisabled();
  });

  it('shows file size information', () => {
    const largeFile = new File(['x'.repeat(1024 * 1024)], 'large.txt', { type: 'text/plain' });
    render(<HybridEncryptionPanel {...defaultProps} files={[largeFile]} />);
    
    expect(screen.getByText('1 MB')).toBeInTheDocument();
  });

  it('handles public key from file upload', () => {
    render(<HybridEncryptionPanel {...defaultProps} />);
    
    const fileInput = screen.getByLabelText('Upload Public Key từ file');
    const keyFile = new File(['public-key-content'], 'public.key', { type: 'text/plain' });
    
    fireEvent.change(fileInput, { target: { files: [keyFile] } });
    
    expect(screen.getByText('public.key')).toBeInTheDocument();
  });

  it('shows hybrid encryption benefits', () => {
    render(<HybridEncryptionPanel {...defaultProps} />);
    
    expect(screen.getByText('Lợi ích của Hybrid Encryption:')).toBeInTheDocument();
    expect(screen.getByText(/Bảo mật cao.*symmetric.*asymmetric/)).toBeInTheDocument();
    expect(screen.getByText(/Hiệu suất tốt.*file lớn/)).toBeInTheDocument();
    expect(screen.getByText(/Forward secrecy.*session key/)).toBeInTheDocument();
  });

  it('shows post-quantum security notice', () => {
    render(<HybridEncryptionPanel {...defaultProps} />);
    
    const kyberOption = screen.getByLabelText('Kyber1024 + ChaCha20-Poly1305');
    fireEvent.click(kyberOption);
    
    expect(screen.getByText(/Post-Quantum Security/)).toBeInTheDocument();
    expect(screen.getByText(/chống lại.*quantum computer/)).toBeInTheDocument();
  });

  it('handles copy to clipboard', async () => {
    const { hybridEncryptionService } = require('../../../services/hybrid-encryption.service');
    hybridEncryptionService.generateKeyPair.mockResolvedValue({
      publicKey: 'copy-public-key',
      privateKey: 'copy-private-key',
      algorithm: 'X25519'
    });

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined)
      }
    });

    render(<HybridEncryptionPanel {...defaultProps} />);
    
    const generateButton = screen.getByRole('button', { name: 'Tạo Key Pair Mới' });
    fireEvent.click(generateButton);
    
    await waitFor(() => {
      const copyButtons = screen.getAllByRole('button', { name: /copy/i });
      fireEvent.click(copyButtons[0]); // Copy public key
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('copy-public-key');
    });
  });
});
