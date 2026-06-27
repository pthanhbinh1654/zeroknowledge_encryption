import React from 'react';
import { useDropzone } from 'react-dropzone';
import { Stack, Typography, Box, Paper } from '@mui/material';
import { ArrowUpOnSquareIcon } from '@heroicons/react/24/solid';
import { DocumentIcon, FolderIcon } from '@heroicons/react/24/outline';

interface FileDropzoneProps {
  onDrop: (files: File[]) => void;
  isDragActive?: boolean;
  maxFiles?: number;
  acceptedFileTypes?: string[];
  maxSize?: number;
}

const FileDropzone: React.FC<FileDropzoneProps> = ({
  onDrop,
  maxFiles = 10,
  acceptedFileTypes,
  maxSize = 100 * 1024 * 1024, // 100MB
}) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: maxFiles > 1,
    accept: acceptedFileTypes ? acceptedFileTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}) : undefined,
    maxSize,
  });

  return (
    <Paper
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
        ${isDragActive 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
          : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500'
        }
      `}
      elevation={0}
    >
      <input {...getInputProps()} />
      
      <Stack spacing={3} alignItems="center">
        <Box className="relative">
          <ArrowUpOnSquareIcon className="w-12 h-12 text-gray-400 mx-auto" />
          <Box className="absolute -bottom-1 -right-1">
            <DocumentIcon className="w-6 h-6 text-blue-500" />
          </Box>
        </Box>

        <Stack spacing={1} alignItems="center">
          <Typography variant="h6" className="text-gray-900 dark:text-white font-medium">
            {isDragActive ? 'Thả file vào đây' : 'Kéo thả file hoặc click để chọn'}
          </Typography>
          
          <Typography variant="body2" className="text-gray-500 dark:text-gray-400">
            Hỗ trợ file đơn, nhiều file, hoặc thư mục hoàn chỉnh
          </Typography>
          
          <Typography variant="caption" className="text-gray-400 dark:text-gray-500">
            Tối đa {maxFiles} file • Kích thước tối đa {Math.round(maxSize / (1024 * 1024))}MB
          </Typography>
        </Stack>

        <Stack direction="row" spacing={2} className="mt-4">
          <Box className="flex items-center space-x-2 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full">
            <DocumentIcon className="w-4 h-4 text-gray-500" />
            <Typography variant="caption" className="text-gray-600 dark:text-gray-400">
              File đơn
            </Typography>
          </Box>
          
          <Box className="flex items-center space-x-2 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full">
            <FolderIcon className="w-4 h-4 text-gray-500" />
            <Typography variant="caption" className="text-gray-600 dark:text-gray-400">
              Thư mục
            </Typography>
          </Box>
        </Stack>
      </Stack>
    </Paper>
  );
};

export default FileDropzone;
