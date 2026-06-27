import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DigitalSignatureManager from '../../../components/Signatures/DigitalSignatureManager';
import { toast } from 'react-hot-toast';

// Mock dependencies
jest.mock('react-hot-toast');
jest.mock('../../../services/signature.service');

const mockToast = toast as jest.Mocked<typeof toast>;

describe('DigitalSignatureManager Component', () => {
  const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
  
  const defaultProps = {
    file: mockFile,
    onSignatureComplete: jest.fn(),
    onVerificationComplete: jest.fn(),
    className: 'test-class'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders signature manager with tabs', () => {
    render(<DigitalSignatureManager {...defaultProps} />);
    
    expect(screen.getByText('Quản lý Chữ ký Số')).toBeInTheDocument();
    expect(screen.getByText('Ký file')).toBeInTheDocument();
    expect(screen.getByText('Xác thực')).toBeInTheDocument();
    expect(screen.getByText('Quản lý key')).toBeInTheDocument();
  });

  it('shows file information', () => {
    render(<DigitalSignatureManager {...defaultProps} />);
    
    expect(screen.getByText('test.txt')).toBeInTheDocument();
    expect(screen.getByText('9 Bytes')).toBeInTheDocument();
    expect(screen.getByText('text/plain')).toBeInTheDocument();
  });

  it('switches between tabs correctly', () => {
    render(<DigitalSignatureManager {...defaultProps} />);
    
    // Default tab should be signing
    expect(screen.getByText('Chọn thuật toán ký số')).toBeInTheDocument();
    
    // Switch to verification tab
    fireEvent.click(screen.getByText('Xác thực'));
    expect(screen.getByText('Upload file chữ ký')).toBeInTheDocument();
    
    // Switch to key management tab
    fireEvent.click(screen.getByText('Quản lý key'));
    expect(screen.getByText('Tạo cặp key mới')).toBeInTheDocument();
  });

  it('shows algorithm selection for signing', () => {
    render(<DigitalSignatureManager {...defaultProps} />);
    
    expect(screen.getByText('Ed25519')).toBeInTheDocument();
    expect(screen.getByText('Dilithium3')).toBeInTheDocument();
    expect(screen.getByText('Dilithium5')).toBeInTheDocument();
  });

  it('handles algorithm selection', () => {
    render(<DigitalSignatureManager {...defaultProps} />);
    
    const dilithium3Option = screen.getByLabelText('Dilithium3');
    fireEvent.click(dilithium3Option);
    
    expect(dilithium3Option).toBeChecked();
  });

  it('shows private key input for signing', () => {
    render(<DigitalSignatureManager {...defaultProps} />);
    
    expect(screen.getByLabelText('Private Key (Base64)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nhập private key để ký file...')).toBeInTheDocument();
  });

  it('validates private key input', async () => {
    render(<DigitalSignatureManager {...defaultProps} />);
    
    const signButton = screen.getByRole('button', { name: 'Ký File' });
    fireEvent.click(signButton);
    
    await waitFor(() => {
      expect(screen.getByText('Vui lòng nhập private key')).toBeInTheDocument();
    });
  });

  it('handles file signing', async () => {
    const { signatureService } = require('../../../services/signature.service');
    signatureService.signFile.mockResolvedValue({
      signature: 'mock-signature-base64',
      algorithm: 'Ed25519',
      timestamp: new Date().toISOString()
    });

    const onSignatureComplete = jest.fn();
    render(<DigitalSignatureManager {...defaultProps} onSignatureComplete={onSignatureComplete} />);
    
    const privateKeyInput = screen.getByLabelText('Private Key (Base64)');
    const signButton = screen.getByRole('button', { name: 'Ký File' });
    
    fireEvent.change(privateKeyInput, { target: { value: 'mock-private-key-base64' } });
    fireEvent.click(signButton);
    
    await waitFor(() => {
      expect(signatureService.signFile).toHaveBeenCalledWith(
        mockFile,
        'mock-private-key-base64',
        'Ed25519'
      );
      expect(onSignatureComplete).toHaveBeenCalled();
    });
  });

  it('shows signing progress', async () => {
    const { signatureService } = require('../../../services/signature.service');
    signatureService.signFile.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        signature: 'mock-signature',
        algorithm: 'Ed25519',
        timestamp: new Date().toISOString()
      }), 100))
    );

    render(<DigitalSignatureManager {...defaultProps} />);
    
    const privateKeyInput = screen.getByLabelText('Private Key (Base64)');
    const signButton = screen.getByRole('button', { name: 'Ký File' });
    
    fireEvent.change(privateKeyInput, { target: { value: 'mock-private-key' } });
    fireEvent.click(signButton);
    
    expect(screen.getByText('Đang ký file...')).toBeInTheDocument();
    expect(signButton).toBeDisabled();
  });

  it('handles signing error', async () => {
    const { signatureService } = require('../../../services/signature.service');
    signatureService.signFile.mockRejectedValue(new Error('Signing failed'));

    render(<DigitalSignatureManager {...defaultProps} />);
    
    const privateKeyInput = screen.getByLabelText('Private Key (Base64)');
    const signButton = screen.getByRole('button', { name: 'Ký File' });
    
    fireEvent.change(privateKeyInput, { target: { value: 'invalid-key' } });
    fireEvent.click(signButton);
    
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Lỗi khi ký file: Signing failed');
    });
  });

  it('shows verification tab content', () => {
    render(<DigitalSignatureManager {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Xác thực'));
    
    expect(screen.getByText('Upload file chữ ký')).toBeInTheDocument();
    expect(screen.getByText('Public Key (Base64)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xác thực Chữ ký' })).toBeInTheDocument();
  });

  it('handles signature file upload', () => {
    render(<DigitalSignatureManager {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Xác thực'));
    
    const fileInput = screen.getByLabelText('Upload file chữ ký');
    const signatureFile = new File(['signature content'], 'signature.sig', { type: 'application/octet-stream' });
    
    fireEvent.change(fileInput, { target: { files: [signatureFile] } });
    
    expect(screen.getByText('signature.sig')).toBeInTheDocument();
  });

  it('handles signature verification', async () => {
    const { signatureService } = require('../../../services/signature.service');
    signatureService.verifySignature.mockResolvedValue({
      isValid: true,
      algorithm: 'Ed25519',
      timestamp: new Date().toISOString()
    });

    const onVerificationComplete = jest.fn();
    render(<DigitalSignatureManager {...defaultProps} onVerificationComplete={onVerificationComplete} />);
    
    fireEvent.click(screen.getByText('Xác thực'));
    
    const signatureFile = new File(['signature'], 'test.sig', { type: 'application/octet-stream' });
    const fileInput = screen.getByLabelText('Upload file chữ ký');
    const publicKeyInput = screen.getByLabelText('Public Key (Base64)');
    const verifyButton = screen.getByRole('button', { name: 'Xác thực Chữ ký' });
    
    fireEvent.change(fileInput, { target: { files: [signatureFile] } });
    fireEvent.change(publicKeyInput, { target: { value: 'mock-public-key' } });
    fireEvent.click(verifyButton);
    
    await waitFor(() => {
      expect(signatureService.verifySignature).toHaveBeenCalled();
      expect(onVerificationComplete).toHaveBeenCalledWith({
        isValid: true,
        algorithm: 'Ed25519',
        timestamp: expect.any(String)
      });
    });
  });

  it('shows key management tab content', () => {
    render(<DigitalSignatureManager {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Quản lý key'));
    
    expect(screen.getByText('Tạo cặp key mới')).toBeInTheDocument();
    expect(screen.getByText('Import key từ file')).toBeInTheDocument();
    expect(screen.getByText('Export key ra file')).toBeInTheDocument();
  });

  it('handles key pair generation', async () => {
    const { signatureService } = require('../../../services/signature.service');
    signatureService.generateKeyPair.mockResolvedValue({
      publicKey: 'mock-public-key',
      privateKey: 'mock-private-key',
      algorithm: 'Ed25519'
    });

    render(<DigitalSignatureManager {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Quản lý key'));
    
    const generateButton = screen.getByRole('button', { name: 'Tạo Key Pair' });
    fireEvent.click(generateButton);
    
    await waitFor(() => {
      expect(signatureService.generateKeyPair).toHaveBeenCalledWith('Ed25519');
      expect(screen.getByText('Key pair đã được tạo thành công!')).toBeInTheDocument();
    });
  });

  it('shows generated keys', async () => {
    const { signatureService } = require('../../../services/signature.service');
    signatureService.generateKeyPair.mockResolvedValue({
      publicKey: 'mock-public-key-123',
      privateKey: 'mock-private-key-456',
      algorithm: 'Ed25519'
    });

    render(<DigitalSignatureManager {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Quản lý key'));
    
    const generateButton = screen.getByRole('button', { name: 'Tạo Key Pair' });
    fireEvent.click(generateButton);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('mock-public-key-123')).toBeInTheDocument();
      expect(screen.getByDisplayValue('mock-private-key-456')).toBeInTheDocument();
    });
  });

  it('handles key export', async () => {
    const { signatureService } = require('../../../services/signature.service');
    signatureService.generateKeyPair.mockResolvedValue({
      publicKey: 'mock-public-key',
      privateKey: 'mock-private-key',
      algorithm: 'Ed25519'
    });

    // Mock file download
    global.URL.createObjectURL = jest.fn().mockReturnValue('mock-url');
    global.URL.revokeObjectURL = jest.fn();

    render(<DigitalSignatureManager {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Quản lý key'));
    
    const generateButton = screen.getByRole('button', { name: 'Tạo Key Pair' });
    fireEvent.click(generateButton);
    
    await waitFor(() => {
      const exportButton = screen.getByRole('button', { name: 'Export Keys' });
      fireEvent.click(exportButton);
      
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  it('shows algorithm information', () => {
    render(<DigitalSignatureManager {...defaultProps} />);
    
    expect(screen.getByText(/Ed25519.*Nhanh, an toàn/)).toBeInTheDocument();
    expect(screen.getByText(/Dilithium3.*Post-quantum/)).toBeInTheDocument();
    expect(screen.getByText(/Dilithium5.*Post-quantum.*bảo mật cao/)).toBeInTheDocument();
  });

  it('handles file without extension', () => {
    const fileWithoutExt = new File(['content'], 'filename', { type: 'application/octet-stream' });
    render(<DigitalSignatureManager {...defaultProps} file={fileWithoutExt} />);
    
    expect(screen.getByText('filename')).toBeInTheDocument();
    expect(screen.getByText('application/octet-stream')).toBeInTheDocument();
  });

  it('shows zero knowledge principles', () => {
    render(<DigitalSignatureManager {...defaultProps} />);
    
    expect(screen.getByText('Nguyên tắc Zero Knowledge trong Chữ ký Số:')).toBeInTheDocument();
    expect(screen.getByText(/Private key chỉ tồn tại trên thiết bị/)).toBeInTheDocument();
    expect(screen.getByText(/Chữ ký được tạo hoàn toàn offline/)).toBeInTheDocument();
  });
});
