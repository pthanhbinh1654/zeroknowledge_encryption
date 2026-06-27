import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DecryptModal from '../../../components/Encryption/DecryptModal';
import { toast } from 'react-hot-toast';

// Mock dependencies
jest.mock('react-hot-toast');
jest.mock('../../../services/encryption.service');

const mockToast = toast as jest.Mocked<typeof toast>;

describe('DecryptModal Component', () => {
  const mockFile = {
    id: 'file-1',
    filename: 'test-document.pdf',
    original_size: 1024000,
    encrypted_size: 1024512,
    algorithm: 'AES-256-GCM',
    uploaded_at: '2024-01-01T10:00:00Z',
    file_type: 'application/pdf',
    has_signature: true,
    signature_algorithm: 'Ed25519'
  };

  const defaultProps = {
    file: mockFile,
    isOpen: true,
    onClose: jest.fn(),
    onDecrypt: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders decrypt modal with file information', () => {
    render(<DecryptModal {...defaultProps} />);
    
    expect(screen.getByText('Giải mã file')).toBeInTheDocument();
    expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
    expect(screen.getByText('AES-256-GCM')).toBeInTheDocument();
    expect(screen.getByText('1000 KB')).toBeInTheDocument();
  });

  it('shows password input field', () => {
    render(<DecryptModal {...defaultProps} />);
    
    const passwordInput = screen.getByLabelText('Mật khẩu giải mã');
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('toggles password visibility', () => {
    render(<DecryptModal {...defaultProps} />);
    
    const passwordInput = screen.getByLabelText('Mật khẩu giải mã');
    const toggleButton = screen.getByRole('button', { name: /hiện mật khẩu/i });
    
    expect(passwordInput).toHaveAttribute('type', 'password');
    
    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');
    
    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('validates password input', async () => {
    render(<DecryptModal {...defaultProps} />);
    
    const decryptButton = screen.getByRole('button', { name: 'Giải mã' });
    fireEvent.click(decryptButton);
    
    await waitFor(() => {
      expect(screen.getByText('Vui lòng nhập mật khẩu')).toBeInTheDocument();
    });
  });

  it('calls onDecrypt with correct parameters', async () => {
    const onDecrypt = jest.fn().mockResolvedValue(undefined);
    render(<DecryptModal {...defaultProps} onDecrypt={onDecrypt} />);
    
    const passwordInput = screen.getByLabelText('Mật khẩu giải mã');
    const decryptButton = screen.getByRole('button', { name: 'Giải mã' });
    
    fireEvent.change(passwordInput, { target: { value: 'test-password' } });
    fireEvent.click(decryptButton);
    
    await waitFor(() => {
      expect(onDecrypt).toHaveBeenCalledWith(mockFile, 'test-password');
    });
  });

  it('shows loading state during decryption', async () => {
    const onDecrypt = jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );
    
    render(<DecryptModal {...defaultProps} onDecrypt={onDecrypt} />);
    
    const passwordInput = screen.getByLabelText('Mật khẩu giải mã');
    const decryptButton = screen.getByRole('button', { name: 'Giải mã' });
    
    fireEvent.change(passwordInput, { target: { value: 'test-password' } });
    fireEvent.click(decryptButton);
    
    expect(screen.getByText('Đang giải mã...')).toBeInTheDocument();
    expect(decryptButton).toBeDisabled();
  });

  it('handles decryption error', async () => {
    const onDecrypt = jest.fn().mockRejectedValue(new Error('Decryption failed'));
    render(<DecryptModal {...defaultProps} onDecrypt={onDecrypt} />);
    
    const passwordInput = screen.getByLabelText('Mật khẩu giải mã');
    const decryptButton = screen.getByRole('button', { name: 'Giải mã' });
    
    fireEvent.change(passwordInput, { target: { value: 'wrong-password' } });
    fireEvent.click(decryptButton);
    
    await waitFor(() => {
      expect(screen.getByText('Lỗi khi giải mã: Decryption failed')).toBeInTheDocument();
    });
  });

  it('shows signature verification option for signed files', () => {
    render(<DecryptModal {...defaultProps} />);
    
    expect(screen.getByText('File có chữ ký số')).toBeInTheDocument();
    expect(screen.getByText('Ed25519')).toBeInTheDocument();
    expect(screen.getByLabelText('Xác thực chữ ký số')).toBeInTheDocument();
  });

  it('hides signature verification for unsigned files', () => {
    const unsignedFile = { ...mockFile, has_signature: false };
    render(<DecryptModal {...defaultProps} file={unsignedFile} />);
    
    expect(screen.queryByText('File có chữ ký số')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Xác thực chữ ký số')).not.toBeInTheDocument();
  });

  it('closes modal when cancel button is clicked', () => {
    const onClose = jest.fn();
    render(<DecryptModal {...defaultProps} onClose={onClose} />);
    
    const cancelButton = screen.getByRole('button', { name: 'Hủy' });
    fireEvent.click(cancelButton);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('closes modal when backdrop is clicked', () => {
    const onClose = jest.fn();
    render(<DecryptModal {...defaultProps} onClose={onClose} />);
    
    const backdrop = screen.getByRole('presentation').firstChild;
    fireEvent.click(backdrop as Element);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render when isOpen is false', () => {
    render(<DecryptModal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText('Giải mã file')).not.toBeInTheDocument();
  });

  it('resets form when modal opens with new file', () => {
    const { rerender } = render(<DecryptModal {...defaultProps} isOpen={false} />);
    
    // Open modal with first file
    rerender(<DecryptModal {...defaultProps} isOpen={true} />);
    
    const passwordInput = screen.getByLabelText('Mật khẩu giải mã');
    fireEvent.change(passwordInput, { target: { value: 'test-password' } });
    
    // Close and reopen with different file
    const newFile = { ...mockFile, id: 'file-2', filename: 'different-file.txt' };
    rerender(<DecryptModal {...defaultProps} file={newFile} isOpen={false} />);
    rerender(<DecryptModal {...defaultProps} file={newFile} isOpen={true} />);
    
    expect(passwordInput).toHaveValue('');
  });

  it('shows progress bar during decryption', async () => {
    const onDecrypt = jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );
    
    render(<DecryptModal {...defaultProps} onDecrypt={onDecrypt} />);
    
    const passwordInput = screen.getByLabelText('Mật khẩu giải mã');
    const decryptButton = screen.getByRole('button', { name: 'Giải mã' });
    
    fireEvent.change(passwordInput, { target: { value: 'test-password' } });
    fireEvent.click(decryptButton);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays file size in human readable format', () => {
    const largeFile = { ...mockFile, original_size: 1073741824 }; // 1GB
    render(<DecryptModal {...defaultProps} file={largeFile} />);
    
    expect(screen.getByText('1 GB')).toBeInTheDocument();
  });

  it('handles keyboard shortcuts', () => {
    const onClose = jest.fn();
    render(<DecryptModal {...defaultProps} onClose={onClose} />);
    
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('focuses password input when modal opens', async () => {
    render(<DecryptModal {...defaultProps} />);
    
    const passwordInput = screen.getByLabelText('Mật khẩu giải mã');
    
    await waitFor(() => {
      expect(passwordInput).toHaveFocus();
    });
  });

  it('shows algorithm-specific information', () => {
    const chachaFile = { ...mockFile, algorithm: 'ChaCha20-Poly1305' };
    render(<DecryptModal {...defaultProps} file={chachaFile} />);
    
    expect(screen.getByText('ChaCha20-Poly1305')).toBeInTheDocument();
  });

  it('handles successful decryption', async () => {
    const onDecrypt = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    
    render(<DecryptModal {...defaultProps} onDecrypt={onDecrypt} onClose={onClose} />);
    
    const passwordInput = screen.getByLabelText('Mật khẩu giải mã');
    const decryptButton = screen.getByRole('button', { name: 'Giải mã' });
    
    fireEvent.change(passwordInput, { target: { value: 'correct-password' } });
    fireEvent.click(decryptButton);
    
    await waitFor(() => {
      expect(onDecrypt).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
