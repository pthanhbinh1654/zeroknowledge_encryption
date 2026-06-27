import React from 'react';
import { Stack, Typography, Box, IconButton, LinearProgress, Chip } from '@mui/material';
import { DocumentIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import { formatFileSize } from '../../utils/stringFormatters';
import { FileStatus } from '../../types/enums';

interface FileItem {
  name: string;
  size: number;
  type: string;
  progress?: number;
  status?: FileStatus;
}

interface FileListProps {
  files: FileItem[];
  onRemoveFile: (index: number) => void;
  onClearAll: () => void;
}

const FileList: React.FC<FileListProps> = ({ files, onRemoveFile, onClearAll }) => {
  if (files.length === 0) return null;

  const getStatusIcon = (status?: FileStatus) => {
    switch (status) {
      case FileStatus.COMPLETED:
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case FileStatus.ERROR:
        return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status?: FileStatus) => {
    switch (status) {
      case FileStatus.COMPLETED:
        return 'success';
      case FileStatus.UPLOADING:
        return 'primary';
      case FileStatus.ERROR:
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box className="mt-6">
      <Stack direction="row" justifyContent="space-between" alignItems="center" className="mb-4">
        <Typography variant="h6" className="text-gray-900 dark:text-white">
          Files đã chọn ({files.length})
        </Typography>
        <Typography 
          variant="body2" 
          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 cursor-pointer"
          onClick={onClearAll}
        >
          Xóa tất cả
        </Typography>
      </Stack>

      <Stack spacing={2}>
        {files.map((file, index) => (
          <Box
            key={index}
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            <Stack direction="row" spacing={2} alignItems="center" className="flex-1">
              <DocumentIcon className="w-8 h-8 text-blue-500 flex-shrink-0" />
              
              <Stack className="flex-1 min-w-0">
                <Typography variant="body2" className="text-gray-900 dark:text-white font-medium truncate">
                  {file.name}
                </Typography>
                
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" className="text-gray-500 dark:text-gray-400">
                    {formatFileSize(file.size)}
                  </Typography>
                  
                  {file.status && (
                    <Chip 
                      label={file.status} 
                      size="small" 
                      color={getStatusColor(file.status) as any}
                      variant="outlined"
                    />
                  )}
                </Stack>

                {file.status === FileStatus.UPLOADING && file.progress !== undefined && (
                  <Box className="mt-1">
                    <LinearProgress 
                      variant="determinate" 
                      value={file.progress} 
                      className="h-1 rounded"
                    />
                    <Typography variant="caption" className="text-gray-500 mt-1">
                      {file.progress}%
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              {getStatusIcon(file.status)}
              
              <IconButton
                onClick={() => onRemoveFile(index)}
                size="small"
                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              >
                <XMarkIcon className="w-4 h-4" />
              </IconButton>
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

export default FileList;
