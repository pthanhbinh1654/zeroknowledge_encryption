import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import OfflineExportManager from '../../../components/FileManagement/OfflineExportManager';
import { toast } from 'react-hot-toast';

// Mock dependencies
jest.mock('react-hot-toast');
jest.mock('file-saver');
jest.mock('jszip');

// Mock services
jest.mock('../../../services/backend-file.service', () => ({
  backendFileService: {
    downloadEncryptedFile: jest.fn()
  }
}));

// Mock crypto.subtle
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: jest.fn().mockResolvedValue(new ArrayBuffer(32))
    }
  }
});

// Mock JSZip
const mockZipFile = jest.fn();
const mockZipGenerateAsync = jest.fn();
const mockZipLoadAsync = jest.fn();

jest.mock('jszip', () => {
  return jest.fn().mockImplementation(() => ({
    file: mockZipFile,
    generateAsync: mockZipGenerateAsync,
    loadAsync: mockZipLoadAsync
  }));
});

describe('OfflineExportManager Component', () => {
  const mockSelectedFiles = [
    {
      id: 'file1',
      filename: 'test1.txt',
      size: 1024,
      algorithm: 'AES-256-GCM',
      uploaded_at: '2024-01-01T00:00:00Z'
    },
    {
      id: 'file2',
      filename: 'test2.pdf',
      size: 2048,
      algorithm: 'ChaCha20-Poly1305',
      uploaded_at: '2024-01-02T00:00:00Z'
    }
  ];

  const defaultProps = {
    selectedFiles: mockSelectedFiles,
    onExportComplete: jest.fn(),
    onImportComplete: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockZipGenerateAsync.mockResolvedValue(new Blob(['mock zip content']));
  });

  it('renders export manager with selected files', () => {
    render(<OfflineExportManager {...defaultProps} />);
    
    expect(screen.getByText('Xuất/Nhập File Offline')).toBeInTheDocument();
    expect(screen.getByText('File đã chọn (2)')).toBeInTheDocument();
    expect(screen.getByText('test1.txt')).toBeInTheDocument();
    expect(screen.getByText('test2.pdf')).toBeInTheDocument();
  });

  it('shows message when no files selected', () => {
    render(<OfflineExportManager {...defaultProps} selectedFiles={[]} />);
    
    expect(screen.getByText('Vui lòng chọn file từ danh sách để xuất offline')).toBeInTheDocument();
  });

  it('displays file information correctly', () => {
    render(<OfflineExportManager {...defaultProps} />);
    
    // Check file details
    expect(screen.getByText('test1.txt')).toBeInTheDocument();
    expect(screen.getByText('1 KB • AES-256-GCM')).toBeInTheDocument();
    expect(screen.getByText('test2.pdf')).toBeInTheDocument();
    expect(screen.getByText('2 KB • ChaCha20-Poly1305')).toBeInTheDocument();
  });

  it('shows limited file list when more than 5 files', () => {
    const manyFiles = Array.from({ length: 7 }, (_, i) => ({
      id: `file${i}`,
      filename: `test${i}.txt`,
      size: 1024,
      algorithm: 'AES-256-GCM',
      uploaded_at: '2024-01-01T00:00:00Z'
    }));

    render(<OfflineExportManager {...defaultProps} selectedFiles={manyFiles} />);
    
    expect(screen.getByText('File đã chọn (7)')).toBeInTheDocument();
    expect(screen.getByText('... và 2 file khác')).toBeInTheDocument();
  });

  it('handles export button click', async () => {
    const { backendFileService } = require('../../../services/backend-file.service');
    backendFileService.downloadEncryptedFile.mockResolvedValue({
      encryptedData: new ArrayBuffer(100),
      metadata: { algorithm: 'AES-256-GCM' }
    });

    render(<OfflineExportManager {...defaultProps} />);
    
    const exportButton = screen.getByText('Xuất File Offline');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText('Đang xuất file...')).toBeInTheDocument();
    });
  });

  it('shows export progress during export', async () => {
    const { backendFileService } = require('../../../services/backend-file.service');
    backendFileService.downloadEncryptedFile.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        encryptedData: new ArrayBuffer(100),
        metadata: { algorithm: 'AES-256-GCM' }
      }), 100))
    );

    render(<OfflineExportManager {...defaultProps} />);
    
    const exportButton = screen.getByText('Xuất File Offline');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText(/Đang chuẩn bị xuất file/)).toBeInTheDocument();
    });
  });

  it('calls onExportComplete when export succeeds', async () => {
    const { backendFileService } = require('../../../services/backend-file.service');
    backendFileService.downloadEncryptedFile.mockResolvedValue({
      encryptedData: new ArrayBuffer(100),
      metadata: { algorithm: 'AES-256-GCM' }
    });

    const onExportComplete = jest.fn();
    render(<OfflineExportManager {...defaultProps} onExportComplete={onExportComplete} />);
    
    const exportButton = screen.getByText('Xuất File Offline');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(onExportComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          fileCount: 2,
          size: expect.any(Number)
        })
      );
    });
  });

  it('handles export error gracefully', async () => {
    const { backendFileService } = require('../../../services/backend-file.service');
    backendFileService.downloadEncryptedFile.mockRejectedValue(new Error('Network error'));

    render(<OfflineExportManager {...defaultProps} />);
    
    const exportButton = screen.getByText('Xuất File Offline');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Lỗi khi xuất file'));
    });
  });

  it('opens import dialog when import button clicked', () => {
    render(<OfflineExportManager {...defaultProps} />);
    
    const importButton = screen.getByText('Nhập Package Offline');
    fireEvent.click(importButton);

    expect(screen.getByText('Nhập Package Offline')).toBeInTheDocument();
    expect(screen.getByText('Chọn file package (.zip)')).toBeInTheDocument();
  });

  it('handles file selection for import', () => {
    render(<OfflineExportManager {...defaultProps} />);
    
    const importButton = screen.getByText('Nhập Package Offline');
    fireEvent.click(importButton);

    const fileInput = screen.getByLabelText('Chọn file package (.zip)');
    const mockFile = new File(['mock content'], 'test-package.zip', { type: 'application/zip' });
    
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    expect(screen.getByText('test-package.zip')).toBeInTheDocument();
  });

  it('validates import file format', () => {
    render(<OfflineExportManager {...defaultProps} />);
    
    const importButton = screen.getByText('Nhập Package Offline');
    fireEvent.click(importButton);

    const fileInput = screen.getByLabelText('Chọn file package (.zip)');
    expect(fileInput).toHaveAttribute('accept', '.zip');
  });

  it('handles successful import', async () => {
    const mockPackageData = {
      version: '1.0.0',
      created_at: '2024-01-01T00:00:00Z',
      files: [
        {
          id: 'file1',
          filename: 'test.txt',
          size: 1024,
          algorithm: 'AES-256-GCM',
          metadata: {},
          encrypted_data: 'base64data'
        }
      ],
      checksum: 'mock-checksum'
    };

    mockZipLoadAsync.mockResolvedValue({
      file: jest.fn().mockReturnValue({
        async: jest.fn().mockResolvedValue(JSON.stringify(mockPackageData))
      })
    });

    const onImportComplete = jest.fn();
    render(<OfflineExportManager {...defaultProps} onImportComplete={onImportComplete} />);
    
    const importButton = screen.getByText('Nhập Package Offline');
    fireEvent.click(importButton);

    const fileInput = screen.getByLabelText('Chọn file package (.zip)');
    const mockFile = new File(['mock content'], 'test-package.zip', { type: 'application/zip' });
    
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    const importConfirmButton = screen.getByRole('button', { name: 'Nhập File' });
    fireEvent.click(importConfirmButton);

    await waitFor(() => {
      expect(onImportComplete).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'file1',
            filename: 'test.txt',
            source: 'offline_import'
          })
        ])
      );
    });
  });

  it('handles import error', async () => {
    mockZipLoadAsync.mockRejectedValue(new Error('Invalid ZIP file'));

    render(<OfflineExportManager {...defaultProps} />);
    
    const importButton = screen.getByText('Nhập Package Offline');
    fireEvent.click(importButton);

    const fileInput = screen.getByLabelText('Chọn file package (.zip)');
    const mockFile = new File(['invalid content'], 'invalid.zip', { type: 'application/zip' });
    
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    const importConfirmButton = screen.getByRole('button', { name: 'Nhập File' });
    fireEvent.click(importConfirmButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Lỗi khi import'));
    });
  });

  it('formats file sizes correctly', () => {
    const largeFiles = [
      {
        id: 'file1',
        filename: 'large.txt',
        size: 1024 * 1024 * 5, // 5 MB
        algorithm: 'AES-256-GCM',
        uploaded_at: '2024-01-01T00:00:00Z'
      }
    ];

    render(<OfflineExportManager {...defaultProps} selectedFiles={largeFiles} />);
    
    expect(screen.getByText('5 MB • AES-256-GCM')).toBeInTheDocument();
  });

  it('shows zero knowledge principles info', () => {
    render(<OfflineExportManager {...defaultProps} />);
    
    expect(screen.getByText('Về tính năng Offline Export:')).toBeInTheDocument();
    expect(screen.getByText(/Package chứa file đã mã hóa và metadata cần thiết/)).toBeInTheDocument();
    expect(screen.getByText(/Không chứa password hoặc key - vẫn đảm bảo Zero Knowledge/)).toBeInTheDocument();
  });

  it('disables import button when no file selected', () => {
    render(<OfflineExportManager {...defaultProps} />);
    
    const importButton = screen.getByText('Nhập Package Offline');
    fireEvent.click(importButton);

    const importConfirmButton = screen.getByRole('button', { name: 'Nhập File' });
    expect(importConfirmButton).toBeDisabled();
  });

  it('closes import dialog on cancel', () => {
    render(<OfflineExportManager {...defaultProps} />);
    
    const importButton = screen.getByText('Nhập Package Offline');
    fireEvent.click(importButton);

    const cancelButton = screen.getByRole('button', { name: 'Hủy' });
    fireEvent.click(cancelButton);

    expect(screen.queryByText('Nhập Package Offline')).not.toBeInTheDocument();
  });
});
