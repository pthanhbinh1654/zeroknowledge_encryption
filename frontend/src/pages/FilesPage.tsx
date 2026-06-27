import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  DocumentTextIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  PencilIcon,
  CalendarIcon,
  CpuChipIcon,
  LockClosedIcon,
  EyeSlashIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { format, formatDistance } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import { FileService } from '../services/file.service';
import SessionFileManager, { SessionFile } from '../utils/sessionFileManager';
import LoadingSpinner from '../components/UI/LoadingSpinner';

import { Modal } from '../components/UI/Modal';
import OfflineExportManager from '../components/FileManagement/OfflineExportManager';
import clsx from 'clsx';

// ==================================================
// INTERFACES - Định nghĩa interfaces
// ==================================================

type FileItem = SessionFile;

interface DecryptModalProps {
  file: SessionFile | null;
  isOpen: boolean;
  onClose: () => void;
  onDecrypt: (fileId: string, password: string) => Promise<void>;
}

// ==================================================
// DECRYPT MODAL COMPONENT - Modal giải mã file
// ==================================================

const DecryptModal: React.FC<DecryptModalProps> = ({ file, isOpen, onClose, onDecrypt }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const handleDecrypt = async () => {
    if (!file || !password.trim()) {
      toast.error('Vui lòng nhập mật khẩu');
      return;
    }

    try {
      setIsDecrypting(true);
      await onDecrypt(file.id, password);
      setPassword('');
      onClose();
    } catch (error) {
      // Error được handle ở parent component
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setShowPassword(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Giải mã và tải file">
      <div className="space-y-4">
        {/* File Info */}
        <div className="bg-secondary-50 dark:bg-secondary-800 rounded-lg p-4">
          <div className="flex items-center">
            <DocumentTextIcon className="h-8 w-8 text-secondary-400 mr-3" />
            <div>
              <p className="font-medium text-secondary-900 dark:text-white">
                {file?.filename}
              </p>
              <p className="text-sm text-secondary-600 dark:text-secondary-400">
                {file && FileService.formatFileSize(file.size)} • {file?.algorithm}
              </p>
            </div>
          </div>
        </div>

        {/* Password Input */}
        <div>
          <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
            Nhập mật khẩu giải mã
          </label>
          <div className="relative">
            <LockClosedIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-secondary-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleDecrypt()}
              className="w-full pl-10 pr-10 py-2 border border-secondary-300 dark:border-secondary-600 rounded-lg bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Nhập mật khẩu mã hóa file"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-300"
            >
              {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-3 pt-4">
          <button
            onClick={handleClose}
            className="flex-1 py-2 px-4 border border-secondary-300 dark:border-secondary-600 rounded-lg text-secondary-700 dark:text-secondary-300 hover:bg-secondary-50 dark:hover:bg-secondary-700 transition-colors duration-200"
          >
            Hủy
          </button>
          <button
            onClick={handleDecrypt}
            disabled={!password.trim() || isDecrypting}
            className={clsx(
              'flex-1 py-2 px-4 rounded-lg text-white font-medium transition-all duration-200',
              !password.trim() || isDecrypting
                ? 'bg-secondary-400 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-700'
            )}
          >
            {isDecrypting ? (
              <div className="flex items-center justify-center">
                <LoadingSpinner size="small" color="white" className="mr-2" />
                Đang giải mã...
              </div>
            ) : (
              'Giải mã và tải xuống'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ==================================================
// FILES PAGE COMPONENT - Trang quản lý file
// ==================================================

/**
 * FilesPage Component - Trang quản lý file đã mã hóa
 * 
 * Features:
 * 1. File list với pagination
 * 2. Search và filter
 * 3. File decryption modal
 * 4. File operations (rename, delete)
 * 5. Bulk operations
 * 6. File statistics
 */
const FilesPage: React.FC = () => {
  // ==================================================
  // STATE MANAGEMENT - Quản lý state
  // ==================================================

  const [files, setFiles] = useState<SessionFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('');
  const [availableAlgorithms, setAvailableAlgorithms] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalFiles, setTotalFiles] = useState(0);
  
  // Modals
  const [decryptModal, setDecryptModal] = useState<{
    isOpen: boolean;
    file: SessionFile | null;
  }>({ isOpen: false, file: null });
  
  const [editingFile, setEditingFile] = useState<{
    id: string;
    newName: string;
  } | null>(null);

  const [showOfflineExport, setShowOfflineExport] = useState(false);

  // Form for search and filter
  const { register: registerFilter, handleSubmit: handleFilterSubmit } = useForm({
    defaultValues: {
      search: '',
      algorithm: '',
    },
  });

  // ==================================================
  // DATA FETCHING - Lấy dữ liệu
  // ==================================================

  const fetchFiles = useCallback(async (page: number = 1, search?: string, algorithm?: string) => {
    try {
      setIsLoading(true);

      // Use async session file manager to load from MongoDB + session
      const allFiles = await SessionFileManager.getFiles();
      const result = SessionFileManager.getFilesWithPaginationFromArray(allFiles, page, 10, search, algorithm);

      setFiles(result.files);
      setCurrentPage(result.currentPage);
      setTotalPages(result.totalPages);
      setTotalFiles(result.total);

      // If no files, show helpful message
      if (result.total === 0 && !search && !algorithm) {
        console.log('No encrypted files found. Encrypt some files first!');
      }
    } catch (error: any) {
      console.error('Failed to fetch session files:', error);
      toast.error(`Lỗi tải danh sách file: ${error.message}`);
      setFiles([]);
      setTotalFiles(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAvailableAlgorithms = useCallback(async () => {
    try {
      const algorithms = await FileService.getAvailableAlgorithms();
      setAvailableAlgorithms(algorithms);
    } catch (error: any) {
      console.error('Failed to fetch algorithms:', error);
      
      // Fallback algorithms when API is not available
      const fallbackAlgorithms = ['AES-256-GCM', 'ChaCha20-Poly1305', 'AES-256-CBC'];
      setAvailableAlgorithms(fallbackAlgorithms);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
    fetchAvailableAlgorithms();
  }, [fetchFiles, fetchAvailableAlgorithms]);

  // ==================================================
  // EVENT HANDLERS - Xử lý events
  // ==================================================

  const handleSearch = (data: any) => {
    setSearchQuery(data.search);
    setSelectedAlgorithm(data.algorithm);
    fetchFiles(1, data.search, data.algorithm);
  };

  const handleDecryptFile = async (fileId: string, password: string) => {
    try {
      const result = await FileService.downloadAndDecryptFile(fileId, { password });
      
      // Download the decrypted file
      FileService.downloadFile(result.data, result.filename);
      
      toast.success(`File ${result.filename} đã được giải mã và tải xuống`);
    } catch (error: any) {
      toast.error(`Lỗi giải mã: ${error.response?.data?.message || error.message}`);
      throw error;
    }
  };

  const handleDownloadEncryptedFile = (fileId: string) => {
    try {
      SessionFileManager.downloadFile(fileId);
      toast.success('File đã được tải xuống');
    } catch (error: any) {
      toast.error(`Lỗi tải file: ${error.message}`);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa file này?')) return;

    try {
      const success = SessionFileManager.removeFile(fileId);
      if (success) {
        toast.success('File đã được xóa thành công');
        fetchFiles(currentPage, searchQuery, selectedAlgorithm);
      } else {
        toast.error('Không thể xóa file');
      }
    } catch (error: any) {
      toast.error(`Lỗi xóa file: ${error.message}`);
    }
  };

  const handleRenameFile = async (fileId: string, newName: string) => {
    try {
      await FileService.updateUserFile(fileId, { filename: newName });
      toast.success('Đổi tên file thành công');
      setEditingFile(null);
      fetchFiles(currentPage, searchQuery, selectedAlgorithm);
    } catch (error: any) {
      toast.error(`Lỗi đổi tên file: ${error.message}`);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedFiles.size === 0) return;
    
    if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedFiles.size} file đã chọn?`)) return;

    try {
      await FileService.deleteMultipleUserFiles(Array.from(selectedFiles));
      toast.success(`Đã xóa ${selectedFiles.size} file thành công`);
      setSelectedFiles(new Set());
      fetchFiles(currentPage, searchQuery, selectedAlgorithm);
    } catch (error: any) {
      toast.error(`Lỗi xóa file: ${error.message}`);
    }
  };

  const toggleFileSelection = (fileId: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    setSelectedFiles(newSelection);
  };

  const selectAllFiles = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map(f => f.id)));
    }
  };

  // ==================================================
  // RENDER HELPERS - Các hàm render helper
  // ==================================================

  const renderFileRow = (file: FileItem) => {
    const isSelected = selectedFiles.has(file.id);
    const isEditing = editingFile?.id === file.id;

    return (
      <tr key={file.id} className={clsx(
        'hover:bg-secondary-50 dark:hover:bg-secondary-700 transition-colors duration-200',
        isSelected && 'bg-primary-50 dark:bg-primary-900/20'
      )}>
        {/* Checkbox */}
        <td className="px-6 py-4 whitespace-nowrap">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleFileSelection(file.id)}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 dark:border-secondary-600 rounded"
          />
        </td>

        {/* File Info */}
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <DocumentTextIcon className="h-8 w-8 text-secondary-400 mr-3" />
            <div>
              {isEditing ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={editingFile.newName}
                    onChange={(e) => setEditingFile({ ...editingFile, newName: e.target.value })}
                    className="text-sm font-medium text-secondary-900 dark:text-white bg-transparent border-b border-primary-500 focus:outline-none"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleRenameFile(file.id, editingFile.newName);
                      }
                      if (e.key === 'Escape') {
                        setEditingFile(null);
                      }
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => handleRenameFile(file.id, editingFile.newName)}
                    className="text-success-600 hover:text-success-700"
                  >
                    <CheckIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditingFile(null)}
                    className="text-danger-600 hover:text-danger-700"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <p className="text-sm font-medium text-secondary-900 dark:text-white">
                  {file.filename}
                </p>
              )}
              <p className="text-sm text-secondary-600 dark:text-secondary-400">
                {FileService.formatFileSize(file.size)} • {file.mode} • {file.type}
              </p>
            </div>
          </div>
        </td>

        {/* Algorithm */}
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <CpuChipIcon className="h-4 w-4 text-secondary-400 mr-2" />
            <span className="text-sm text-secondary-900 dark:text-white">
              {file.algorithm}
            </span>
          </div>
        </td>

        {/* Date */}
        <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-600 dark:text-secondary-400">
          <div className="flex items-center">
            <CalendarIcon className="h-4 w-4 mr-2" />
            <div>
              <p>{format(new Date(file.timestamp), 'dd/MM/yyyy', { locale: vi })}</p>
              <p className="text-xs">
                {formatDistance(new Date(file.timestamp), new Date(), { addSuffix: true, locale: vi })}
              </p>
            </div>
          </div>
        </td>

        {/* Actions */}
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <div className="flex items-center justify-end space-x-2">
            <button
              onClick={() => handleDownloadEncryptedFile(file.id)}
              className="text-success-600 hover:text-success-900 dark:text-success-400 dark:hover:text-success-300"
              title="Tải xuống file đã mã hóa"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDecryptModal({ isOpen: true, file })}
              className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
              title="Giải mã và tải xuống"
            >
              <EyeIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setEditingFile({ id: file.id, newName: file.filename })}
              className="text-secondary-600 hover:text-secondary-900 dark:text-secondary-400 dark:hover:text-secondary-300"
              title="Đổi tên file"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDeleteFile(file.id)}
              className="text-danger-600 hover:text-danger-900 dark:text-danger-400 dark:hover:text-danger-300"
              title="Xóa file"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const renderPagination = () => {
    const pages = [];
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => fetchFiles(i, searchQuery, selectedAlgorithm)}
          className={clsx(
            'px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200',
            i === currentPage
              ? 'bg-primary-600 text-white'
              : 'text-secondary-700 dark:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-700'
          )}
        >
          {i}
        </button>
      );
    }

    return (
      <div className="flex items-center justify-between px-6 py-3 border-t border-secondary-200 dark:border-secondary-700">
        <div className="text-sm text-secondary-600 dark:text-secondary-400">
          Hiển thị {files.length} / {totalFiles} file
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => fetchFiles(currentPage - 1, searchQuery, selectedAlgorithm)}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm font-medium text-secondary-700 dark:text-secondary-300 bg-white dark:bg-secondary-800 border border-secondary-300 dark:border-secondary-600 rounded-lg hover:bg-secondary-50 dark:hover:bg-secondary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Trước
          </button>
          {pages}
          <button
            onClick={() => fetchFiles(currentPage + 1, searchQuery, selectedAlgorithm)}
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm font-medium text-secondary-700 dark:text-secondary-300 bg-white dark:bg-secondary-800 border border-secondary-300 dark:border-secondary-600 rounded-lg hover:bg-secondary-50 dark:hover:bg-secondary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Sau
          </button>
        </div>
      </div>
    );
  };

  // ==================================================
  // MAIN RENDER - Render chính
  // ==================================================

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg p-4 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center">
            <DocumentTextIcon className="h-8 w-8 mr-3" />
            <div>
              <h1 className="text-2xl font-bold">File của tôi</h1>
              <p className="text-primary-100 mt-1">
                Quản lý file đã mã hóa ({totalFiles} file)
              </p>
            </div>
          </div>
          
          {selectedFiles.size > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
              <span className="text-primary-100 text-sm sm:text-base">
                {selectedFiles.size} file đã chọn
              </span>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <button
                  onClick={() => setShowOfflineExport(true)}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  <span>Xuất Offline</span>
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="px-4 py-2 bg-danger-600 hover:bg-danger-700 rounded-lg font-medium transition-colors duration-200"
                >
                  Xóa đã chọn
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white dark:bg-secondary-800 rounded-lg p-4 border border-secondary-200 dark:border-secondary-700">
        <form onSubmit={handleFilterSubmit(handleSearch)} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-secondary-400" />
              <input
                {...registerFilter('search')}
                type="text"
                placeholder="Tìm kiếm file..."
                className="block w-full pl-10 pr-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-lg bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white placeholder-secondary-500 dark:placeholder-secondary-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="sm:w-48">
            <div className="relative">
              <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-secondary-400" />
              <select
                {...registerFilter('algorithm')}
                className="block w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-lg bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Tất cả thuật toán</option>
                {availableAlgorithms.map((algo) => (
                  <option key={algo} value={algo}>{algo}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <button
              type="submit"
              className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors duration-200"
            >
              Tìm kiếm
            </button>
            <button
              type="button"
              onClick={() => fetchFiles(currentPage, searchQuery, selectedAlgorithm)}
              className="px-4 py-2 bg-secondary-600 hover:bg-secondary-700 text-white rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
              title="Làm mới danh sách file"
            >
              <ArrowPathIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Làm mới</span>
            </button>
          </div>
        </form>
      </div>

      {/* Files Table */}
      <div className="bg-white dark:bg-secondary-800 rounded-lg border border-secondary-200 dark:border-secondary-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="large" />
            <span className="ml-3 text-secondary-600 dark:text-secondary-400">
              Đang tải danh sách file...
            </span>
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12">
            <DocumentTextIcon className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
            <p className="text-secondary-600 dark:text-secondary-400 text-lg">
              {searchQuery || selectedAlgorithm ? 'Không tìm thấy file nào' : 'Chưa có file nào được mã hóa'}
            </p>
            <p className="text-secondary-500 dark:text-secondary-500 mt-2">
              {searchQuery || selectedAlgorithm 
                ? 'Thử thay đổi bộ lọc tìm kiếm' 
                : 'Backend API đang được phát triển. Hãy mã hóa file đầu tiên của bạn'
              }
            </p>
            {!searchQuery && !selectedAlgorithm && (
              <div className="mt-4 p-4 bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-800 rounded-lg max-w-md mx-auto">
                <p className="text-sm text-info-700 dark:text-info-300">
                  💡 <strong>Lưu ý:</strong> Một số chức năng quản lý file đang được hoàn thiện. 
                  Hiện tại bạn có thể sử dụng chức năng mã hóa file.
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-secondary-200 dark:divide-secondary-700">
                <thead className="bg-secondary-50 dark:bg-secondary-900">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedFiles.size === files.length && files.length > 0}
                        onChange={selectAllFiles}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 dark:border-secondary-600 rounded"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 dark:text-secondary-400 uppercase tracking-wider">
                      File
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 dark:text-secondary-400 uppercase tracking-wider">
                      Thuật toán
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 dark:text-secondary-400 uppercase tracking-wider">
                      Ngày tạo
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-secondary-500 dark:text-secondary-400 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-secondary-800 divide-y divide-secondary-200 dark:divide-secondary-700">
                  {files.map(renderFileRow)}
                </tbody>
              </table>
            </div>
            {renderPagination()}
          </>
        )}
      </div>

      {/* Offline Export Modal */}
      {showOfflineExport && (
        <Modal
          isOpen={showOfflineExport}
          onClose={() => setShowOfflineExport(false)}
          title="Xuất File Offline"
          size="large"
        >
          <OfflineExportManager
            selectedFiles={Array.from(selectedFiles).map(fileId => {
              const file = files.find(f => f.id === fileId);
              return file ? {
                id: file.id,
                filename: file.filename,
                size: file.size,
                algorithm: file.algorithm,
                uploaded_at: file.timestamp
              } : null;
            }).filter(Boolean) as any[]}
            onExportComplete={(packageInfo) => {
              toast.success(`Đã xuất ${packageInfo.fileCount} file thành công!`);
              setShowOfflineExport(false);
            }}
            onImportComplete={(importedFiles) => {
              toast.success(`Đã nhập ${importedFiles.length} file thành công!`);
              // Refresh file list
              fetchFiles(currentPage, searchQuery, selectedAlgorithm);
              setShowOfflineExport(false);
            }}
          />
        </Modal>
      )}

      {/* Decrypt Modal */}
      <DecryptModal
        file={decryptModal.file}
        isOpen={decryptModal.isOpen}
        onClose={() => setDecryptModal({ isOpen: false, file: null })}
        onDecrypt={handleDecryptFile}
      />
    </div>
  );
};

export default FilesPage; 
