import React from 'react';
import { 
  Stack, 
  Typography, 
  FormControlLabel, 
  Checkbox, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  Slider, 
  Box,
  Paper,
  Chip
} from '@mui/material';
import { CogIcon } from '@heroicons/react/24/outline';
import { DocumentIcon, FolderIcon } from '@heroicons/react/24/outline';
import { EncryptionMode, SignatureAlgorithm, KeyWrapAlgorithm } from '../../types/enums';

interface AdvancedOptionsPanelProps {
  encryptionMode: EncryptionMode;
  onEncryptionModeChange: (mode: EncryptionMode) => void;
  isLargeFile: boolean;
  chunkSize: number;
  onChunkSizeChange: (size: number) => void;
  enableSignature: boolean;
  onEnableSignatureChange: (enabled: boolean) => void;
  signatureAlgorithm: SignatureAlgorithm;
  onSignatureAlgorithmChange: (algorithm: SignatureAlgorithm) => void;
  useKeyWrap: boolean;
  onUseKeyWrapChange: (enabled: boolean) => void;
  keyWrapAlgorithm: KeyWrapAlgorithm;
  onKeyWrapAlgorithmChange: (algorithm: KeyWrapAlgorithm) => void;
  publicKey?: string;
}

const AdvancedOptionsPanel: React.FC<AdvancedOptionsPanelProps> = ({
  encryptionMode,
  onEncryptionModeChange,
  isLargeFile,
  chunkSize,
  onChunkSizeChange,
  enableSignature,
  onEnableSignatureChange,
  signatureAlgorithm,
  onSignatureAlgorithmChange,
  useKeyWrap,
  onUseKeyWrapChange,
  keyWrapAlgorithm,
  onKeyWrapAlgorithmChange,
  publicKey
}) => {
  const encryptionModes = [
    { value: EncryptionMode.SINGLE, label: 'File đơn', icon: DocumentIcon },
    { value: EncryptionMode.MULTI, label: 'Nhiều file', icon: DocumentIcon },
    { value: EncryptionMode.FOLDER, label: 'Thư mục', icon: FolderIcon }
  ];

  return (
    <Box className="mt-6">
      <Stack spacing={4}>
        <Stack direction="row" spacing={1} alignItems="center">
          <CogIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <Typography variant="h6" className="text-gray-900 dark:text-white">
            Tùy chọn nâng cao
          </Typography>
        </Stack>

        {/* Encryption Mode */}
        <Box>
          <Typography variant="subtitle2" className="text-gray-700 dark:text-gray-300 mb-2">
            Chế độ mã hóa
          </Typography>
          <Stack direction="row" spacing={2}>
            {encryptionModes.map((mode) => {
              const IconComponent = mode.icon;
              return (
                <Paper
                  key={mode.value}
                  className={`
                    p-3 cursor-pointer transition-all duration-200 border-2
                    ${encryptionMode === mode.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500'
                    }
                  `}
                  onClick={() => onEncryptionModeChange(mode.value)}
                  elevation={0}
                >
                  <Stack spacing={1} alignItems="center">
                    <IconComponent className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    <Typography 
                      variant="caption" 
                      className={`font-medium ${
                        encryptionMode === mode.value 
                          ? 'text-blue-700 dark:text-blue-300' 
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {mode.label}
                    </Typography>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        </Box>

        {/* Large File Chunking */}
        {isLargeFile && (
          <Box>
            <Typography variant="subtitle2" className="text-gray-700 dark:text-gray-300 mb-2">
              Kích thước chunk (MB)
            </Typography>
            <Slider
              value={chunkSize}
              onChange={(_, value) => onChunkSizeChange(value as number)}
              min={1}
              max={50}
              step={1}
              marks={[
                { value: 1, label: '1MB' },
                { value: 25, label: '25MB' },
                { value: 50, label: '50MB' }
              ]}
              valueLabelDisplay="on"
              className="mt-2"
            />
            <Typography variant="caption" className="text-gray-500 dark:text-gray-400 mt-1">
              File lớn sẽ được chia thành các chunk để xử lý hiệu quả hơn
            </Typography>
          </Box>
        )}

        {/* Digital Signatures */}
        <Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={enableSignature}
                onChange={(e) => onEnableSignatureChange(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" className="text-gray-700 dark:text-gray-300">
                  Ký số file
                </Typography>
                <Chip label="Bảo mật" size="small" color="success" variant="outlined" />
              </Stack>
            }
          />

          {enableSignature && (
            <Box className="ml-8 mt-2">
              <FormControl size="small" className="min-w-48">
                <InputLabel>Thuật toán ký số</InputLabel>
                <Select
                  value={signatureAlgorithm}
                  onChange={(e) => onSignatureAlgorithmChange(e.target.value as SignatureAlgorithm)}
                  label="Thuật toán ký số"
                >
                  <MenuItem value={SignatureAlgorithm.ED25519}>
                    <Stack>
                      <Typography variant="body2">Ed25519</Typography>
                      <Typography variant="caption" className="text-gray-500">
                        Classic, nhanh
                      </Typography>
                    </Stack>
                  </MenuItem>
                  <MenuItem value={SignatureAlgorithm.DILITHIUM3}>
                    <Stack>
                      <Typography variant="body2">Dilithium3</Typography>
                      <Typography variant="caption" className="text-gray-500">
                        Post-Quantum, cân bằng
                      </Typography>
                    </Stack>
                  </MenuItem>
                  <MenuItem value={SignatureAlgorithm.DILITHIUM5}>
                    <Stack>
                      <Typography variant="body2">Dilithium5</Typography>
                      <Typography variant="caption" className="text-gray-500">
                        Post-Quantum, bảo mật cao
                      </Typography>
                    </Stack>
                  </MenuItem>
                </Select>
              </FormControl>

              {publicKey && (
                <Box className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
                  <Typography variant="caption" className="text-green-700 dark:text-green-300">
                    ✅ Key pair đã được tạo
                  </Typography>
                  <Typography variant="caption" className="text-green-600 dark:text-green-400 block mt-1">
                    Public Key: {publicKey.substring(0, 32)}...
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* Hybrid Encryption */}
        <Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={useKeyWrap}
                onChange={(e) => onUseKeyWrapChange(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" className="text-gray-700 dark:text-gray-300">
                  Mã hóa lai (Key Wrapping)
                </Typography>
                <Chip label="Nâng cao" size="small" color="info" variant="outlined" />
              </Stack>
            }
          />

          {useKeyWrap && (
            <Box className="ml-8 mt-2">
              <FormControl size="small" className="min-w-48">
                <InputLabel>Thuật toán key wrapping</InputLabel>
                <Select
                  value={keyWrapAlgorithm}
                  onChange={(e) => onKeyWrapAlgorithmChange(e.target.value as KeyWrapAlgorithm)}
                  label="Thuật toán key wrapping"
                >
                  <MenuItem value={KeyWrapAlgorithm.X25519}>
                    <Stack>
                      <Typography variant="body2">X25519</Typography>
                      <Typography variant="caption" className="text-gray-500">
                        Classic ECDH
                      </Typography>
                    </Stack>
                  </MenuItem>
                  <MenuItem value={KeyWrapAlgorithm.KYBER1024}>
                    <Stack>
                      <Typography variant="body2">Kyber1024</Typography>
                      <Typography variant="caption" className="text-gray-500">
                        Post-Quantum KEM
                      </Typography>
                    </Stack>
                  </MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </Box>
      </Stack>
    </Box>
  );
};

export default AdvancedOptionsPanel;
