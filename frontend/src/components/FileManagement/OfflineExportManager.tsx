import React, { useState, useCallback } from 'react';
import { 
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  DocumentIcon,
  FolderIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';
import { 
  Box, 
  Typography, 
  Button, 
  Paper,
  Stack,
  Alert,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

// Import services
import { FileService } from '../../services/file.service';
import SessionFileManager from '../../utils/sessionFileManager';

// Removed BackendFileService - using FileService instead

// ==================================================
// TYPES & INTERFACES
// ==================================================

interface OfflinePackage {
  version: string;
  created_at: string;
  files: Array<{
    id: string;
    filename: string;
    size: number;
    algorithm: string;
    metadata: any;
    encrypted_data: string; // Base64 encoded
  }>;
  signature?: string;
  checksum: string;
}

interface ExportProgress {
  stage: 'preparing' | 'downloading' | 'packaging' | 'complete';
  progress: number;
  message: string;
  currentFile?: string;
}

interface OfflineExportManagerProps {
  selectedFiles: Array<{
    id: string;
    filename: string;
    size: number;
    algorithm: string;
    uploaded_at: string;
  }>;
  onExportComplete?: (packageInfo: any) => void;
  onImportComplete?: (importedFiles: any[]) => void;
  className?: string;
}

// ==================================================
// OFFLINE EXPORT MANAGER COMPONENT
// ==================================================

const OfflineExportManager: React.FC<OfflineExportManagerProps> = ({
  selectedFiles,
  onExportComplete,
  onImportComplete,
  className
}) => {
  // State management
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    stage: 'preparing',
    progress: 0,
    message: 'Sẵn sàng xuất file'
  });
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importPassword, setImportPassword] = useState('');
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);

  // ==================================================
  // EXPORT FUNCTIONS
  // ==================================================

  const updateProgress = useCallback((stage: ExportProgress['stage'], progress: number, message: string, currentFile?: string) => {
    setExportProgress({ stage, progress, message, currentFile });
  }, []);

  const handleExportOffline = useCallback(async () => {
    if (selectedFiles.length === 0) {
      toast.error('Vui lòng chọn ít nhất một file để xuất');
      return;
    }

    setIsExporting(true);
    
    try {
      // Stage 1: Preparing
      updateProgress('preparing', 10, 'Đang chuẩn bị xuất file...', 'Khởi tạo package');
      
      const offlinePackage: OfflinePackage = {
        version: '1.0.0',
        created_at: new Date().toISOString(),
        files: [],
        checksum: ''
      };

      // Stage 2: Downloading files
      updateProgress('downloading', 20, 'Đang tải file từ server...', '');
      
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const progressPercent = 20 + (i / selectedFiles.length) * 50;
        
        updateProgress('downloading', progressPercent, 'Đang tải file...', file.filename);
        
        try {
          // Download encrypted file and metadata
          const fileData = await SessionFileManager.getFile(file.id);
          if (!fileData) continue;
          
          // Convert ArrayBuffer to Base64
          const base64Data = arrayBufferToBase64(fileData.encryptedData);
          
          offlinePackage.files.push({
            id: file.id,
            filename: file.filename,
            size: file.size,
            algorithm: file.algorithm,
            metadata: fileData.metadata,
            encrypted_data: base64Data
          });
          
        } catch (error) {
          console.error(`Failed to download file ${file.filename}:`, error);
          toast.error(`Lỗi khi tải file: ${file.filename}`);
        }
      }

      // Stage 3: Packaging
      updateProgress('packaging', 80, 'Đang đóng gói file...', 'Tạo package offline');
      
      // Calculate checksum
      const packageJson = JSON.stringify(offlinePackage, null, 2);
      const checksum = await calculateSHA256(packageJson);
      offlinePackage.checksum = checksum;

      // Create ZIP package
      const zip = new JSZip();
      
      // Add package metadata
      zip.file('package.json', JSON.stringify(offlinePackage, null, 2));
      
      // Add individual encrypted files
      offlinePackage.files.forEach(file => {
        const fileData = base64ToArrayBuffer(file.encrypted_data);
        zip.file(`files/${file.id}.enc`, fileData);
        zip.file(`metadata/${file.id}.json`, JSON.stringify(file.metadata, null, 2));
      });
      
      // Add README
      const readme = `
# Zero Knowledge Encrypted Files - Offline Package

This package contains encrypted files that can be decrypted offline using the Zero Knowledge Encryption system.

## Package Information
- Version: ${offlinePackage.version}
- Created: ${offlinePackage.created_at}
- Files: ${offlinePackage.files.length}
- Checksum: ${offlinePackage.checksum}

## Usage
1. Upload this package to the Zero Knowledge Encryption system
2. Use the decrypt function with your original password/key
3. Files will be decrypted and restored to their original format

## Security Notes
- This package contains only encrypted data
- No passwords or keys are included
- Only you can decrypt these files with your original credentials
- Keep this package secure as it contains your encrypted data
      `;
      
      zip.file('README.md', readme);

      // Generate and download ZIP
      updateProgress('packaging', 95, 'Đang tạo file tải xuống...', 'Hoàn tất package');
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `zero_knowledge_package_${timestamp}.zip`;
      
      saveAs(zipBlob, filename);
      
      // Stage 4: Complete
      updateProgress('complete', 100, 'Xuất file hoàn tất!', `Đã tạo package: ${filename}`);
      
      onExportComplete?.({
        filename,
        fileCount: offlinePackage.files.length,
        size: zipBlob.size,
        checksum: offlinePackage.checksum
      });
      
      toast.success(`Đã xuất ${offlinePackage.files.length} file thành công!`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
      toast.error(`Lỗi khi xuất file: ${errorMessage}`);
      updateProgress('preparing', 0, 'Lỗi khi xuất file', errorMessage);
    } finally {
      setIsExporting(false);
    }
  }, [selectedFiles, onExportComplete, updateProgress]);

  // ==================================================
  // IMPORT FUNCTIONS
  // ==================================================

  const handleImportOffline = useCallback(async () => {
    if (!selectedImportFile) {
      toast.error('Vui lòng chọn file package để import');
      return;
    }

    setIsImporting(true);
    
    try {
      // Read ZIP file
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(selectedImportFile);
      
      // Read package.json
      const packageFile = zipContent.file('package.json');
      if (!packageFile) {
        throw new Error('Package không hợp lệ: thiếu package.json');
      }
      
      const packageJson = await packageFile.async('text');
      const offlinePackage: OfflinePackage = JSON.parse(packageJson);
      
      // Verify checksum
      const calculatedChecksum = await calculateSHA256(JSON.stringify({
        ...offlinePackage,
        checksum: ''
      }, null, 2));
      
      if (calculatedChecksum !== offlinePackage.checksum) {
        throw new Error('Package bị hỏng: checksum không khớp');
      }
      
      // Process imported files
      const importedFiles = offlinePackage.files.map(file => ({
        id: file.id,
        filename: file.filename,
        size: file.size,
        algorithm: file.algorithm,
        metadata: file.metadata,
        encrypted_data: file.encrypted_data,
        source: 'offline_import'
      }));
      
      onImportComplete?.(importedFiles);
      toast.success(`Đã import ${importedFiles.length} file thành công!`);
      
      setShowImportDialog(false);
      setSelectedImportFile(null);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
      toast.error(`Lỗi khi import: ${errorMessage}`);
    } finally {
      setIsImporting(false);
    }
  }, [selectedImportFile, onImportComplete]);

  // ==================================================
  // HELPER FUNCTIONS
  // ==================================================

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const calculateSHA256 = async (data: string): Promise<string> => {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center">
        <ArrowDownTrayIcon className="mx-auto h-12 w-12 text-primary-600 dark:text-primary-400 mb-4" />
        <Typography variant="h5" className="text-gray-900 dark:text-white font-bold mb-2">
          Xuất/Nhập File Offline
        </Typography>
        <Typography variant="body1" className="text-gray-600 dark:text-gray-400">
          Tạo package offline để sử dụng file đã mã hóa mà không cần internet
        </Typography>
      </div>

      {/* Export Section */}
      <Paper className="p-6">
        <Typography variant="h6" className="mb-4">
          Xuất File Offline
        </Typography>
        
        {selectedFiles.length > 0 ? (
          <div className="space-y-4">
            {/* Selected Files List */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" className="mb-2">
                  File đã chọn ({selectedFiles.length})
                </Typography>
                <List dense>
                  {selectedFiles.slice(0, 5).map((file, index) => (
                    <ListItem key={index} disablePadding>
                      <ListItemIcon>
                        <DocumentIcon className="h-5 w-5 text-blue-500" />
                      </ListItemIcon>
                      <ListItemText
                        primary={file.filename}
                        secondary={`${formatFileSize(file.size)} • ${file.algorithm}`}
                      />
                    </ListItem>
                  ))}
                  {selectedFiles.length > 5 && (
                    <ListItem disablePadding>
                      <ListItemText
                        primary={`... và ${selectedFiles.length - 5} file khác`}
                        className="text-gray-500"
                      />
                    </ListItem>
                  )}
                </List>
              </CardContent>
            </Card>

            {/* Export Progress */}
            {isExporting && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" className="mb-2">
                      {exportProgress.message}
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={exportProgress.progress}
                      className="mb-2"
                    />
                    <Typography variant="caption" className="text-gray-500">
                      {exportProgress.currentFile && `Đang xử lý: ${exportProgress.currentFile}`}
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Export Button */}
            <Button
              variant="contained"
              size="large"
              onClick={handleExportOffline}
              disabled={isExporting}
              startIcon={<ArrowDownTrayIcon className="h-5 w-5" />}
              fullWidth
            >
              {isExporting ? 'Đang xuất file...' : 'Xuất File Offline'}
            </Button>
          </div>
        ) : (
          <Alert severity="info">
            <Typography variant="body2">
              Vui lòng chọn file từ danh sách để xuất offline
            </Typography>
          </Alert>
        )}
      </Paper>

      {/* Import Section */}
      <Paper className="p-6">
        <Typography variant="h6" className="mb-4">
          Nhập File Offline
        </Typography>
        
        <Button
          variant="outlined"
          size="large"
          onClick={() => setShowImportDialog(true)}
          startIcon={<ArrowUpTrayIcon className="h-5 w-5" />}
          fullWidth
        >
          Nhập Package Offline
        </Button>
      </Paper>

      {/* Import Dialog */}
      <Dialog 
        open={showImportDialog} 
        onClose={() => setShowImportDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Nhập Package Offline</DialogTitle>
        <DialogContent>
          <div className="space-y-4 pt-2">
            <Button
              variant="outlined"
              component="label"
              fullWidth
              startIcon={<ArrowUpTrayIcon className="h-4 w-4" />}
            >
              {selectedImportFile ? selectedImportFile.name : 'Chọn file package (.zip)'}
              <input
                type="file"
                hidden
                accept=".zip"
                onChange={(e) => setSelectedImportFile(e.target.files?.[0] || null)}
              />
            </Button>
            
            {selectedImportFile && (
              <Alert severity="info">
                <Typography variant="body2">
                  File: {selectedImportFile.name}<br/>
                  Kích thước: {formatFileSize(selectedImportFile.size)}
                </Typography>
              </Alert>
            )}
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowImportDialog(false)}>
            Hủy
          </Button>
          <Button 
            onClick={handleImportOffline}
            disabled={!selectedImportFile || isImporting}
            variant="contained"
          >
            {isImporting ? 'Đang nhập...' : 'Nhập File'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Information */}
      <Alert severity="info" icon={<InformationCircleIcon className="h-5 w-5" />}>
        <Typography variant="body2" className="font-medium mb-1">
          Về tính năng Offline Export:
        </Typography>
        <ul className="text-sm space-y-1 ml-4">
          <li>• Package chứa file đã mã hóa và metadata cần thiết</li>
          <li>• Không chứa password hoặc key - vẫn đảm bảo Zero Knowledge</li>
          <li>• Có thể sử dụng offline và upload lại để giải mã</li>
          <li>• Bao gồm checksum để đảm bảo tính toàn vẹn</li>
        </ul>
      </Alert>
    </div>
  );
};

export default OfflineExportManager;
