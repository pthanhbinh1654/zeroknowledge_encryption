import React, { useState } from 'react';
import {
  Stack,
  Typography,
  Paper,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Box,
  Divider,
  Alert,
  Chip
} from '@mui/material';
import { ShieldCheckIcon, KeyIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import PasswordStrengthIndicator from '../Encryption/PasswordStrengthIndicator';

interface SecuritySettingsPanelProps {
  otpEnabled: boolean;
  onOtpToggle: (enabled: boolean) => void;
  sessionTimeout: number;
  onSessionTimeoutChange: (timeout: number) => void;
  onPasswordChange: (currentPassword: string, newPassword: string) => Promise<void>;
}

const SecuritySettingsPanel: React.FC<SecuritySettingsPanelProps> = ({
  otpEnabled,
  onOtpToggle,
  sessionTimeout,
  onSessionTimeoutChange,
  onPasswordChange
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      alert('Mật khẩu xác nhận không khớp');
      return;
    }

    try {
      setIsChangingPassword(true);
      await onPasswordChange(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      alert('Đổi mật khẩu thành công');
    } catch (error) {
      alert('Lỗi đổi mật khẩu');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <Stack spacing={4}>
      {/* Header */}
      <Stack direction="row" spacing={2} alignItems="center">
        <ShieldCheckIcon className="w-6 h-6 text-blue-600" />
        <Typography variant="h5" className="text-gray-900 dark:text-white">
          Cài đặt bảo mật
        </Typography>
      </Stack>

      {/* Two-Factor Authentication */}
      <Paper className="p-6" elevation={1}>
        <Stack spacing={3}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6" className="text-gray-900 dark:text-white">
                Xác thực hai yếu tố (2FA)
              </Typography>
              <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
                Tăng cường bảo mật tài khoản với OTP
              </Typography>
            </Box>
            <Stack direction="row" spacing={2} alignItems="center">
              <Chip 
                label={otpEnabled ? 'Đã bật' : 'Đã tắt'} 
                color={otpEnabled ? 'success' : 'default'}
                variant="outlined"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={otpEnabled}
                    onChange={(e) => onOtpToggle(e.target.checked)}
                    color="primary"
                  />
                }
                label=""
              />
            </Stack>
          </Stack>

          {otpEnabled && (
            <Alert severity="success" className="mt-2">
              Xác thực hai yếu tố đã được kích hoạt. Tài khoản của bạn được bảo vệ tốt hơn.
            </Alert>
          )}
        </Stack>
      </Paper>

      {/* Session Management */}
      <Paper className="p-6" elevation={1}>
        <Stack spacing={3}>
          <Typography variant="h6" className="text-gray-900 dark:text-white">
            Quản lý phiên đăng nhập
          </Typography>

          <Stack direction="row" spacing={3} alignItems="center">
            <Typography variant="body2" className="text-gray-600 dark:text-gray-400 min-w-fit">
              Thời gian hết hạn phiên (phút):
            </Typography>
            <TextField
              type="number"
              value={sessionTimeout}
              onChange={(e) => onSessionTimeoutChange(Number(e.target.value))}
              size="small"
              inputProps={{ min: 5, max: 480 }}
              className="w-32"
            />
          </Stack>

          <Typography variant="caption" className="text-gray-500 dark:text-gray-400">
            Phiên đăng nhập sẽ tự động hết hạn sau khoảng thời gian không hoạt động
          </Typography>
        </Stack>
      </Paper>

      {/* Password Change */}
      <Paper className="p-6" elevation={1}>
        <Stack spacing={3}>
          <Stack direction="row" spacing={2} alignItems="center">
            <KeyIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <Typography variant="h6" className="text-gray-900 dark:text-white">
              Đổi mật khẩu
            </Typography>
          </Stack>

          <Stack spacing={3}>
            {/* Current Password */}
            <Box>
              <Typography variant="body2" className="text-gray-700 dark:text-gray-300 mb-2">
                Mật khẩu hiện tại
              </Typography>
              <Box className="relative">
                <TextField
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="Nhập mật khẩu hiện tại"
                />
                <Button
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 min-w-0 p-1"
                >
                  {showCurrentPassword ? 
                    <EyeSlashIcon className="w-4 h-4" /> : 
                    <EyeIcon className="w-4 h-4" />
                  }
                </Button>
              </Box>
            </Box>

            {/* New Password */}
            <Box>
              <Typography variant="body2" className="text-gray-700 dark:text-gray-300 mb-2">
                Mật khẩu mới
              </Typography>
              <Box className="relative">
                <TextField
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="Nhập mật khẩu mới"
                />
                <Button
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 min-w-0 p-1"
                >
                  {showNewPassword ? 
                    <EyeSlashIcon className="w-4 h-4" /> : 
                    <EyeIcon className="w-4 h-4" />
                  }
                </Button>
              </Box>
              <PasswordStrengthIndicator password={newPassword} className="mt-2" />
            </Box>

            {/* Confirm Password */}
            <Box>
              <Typography variant="body2" className="text-gray-700 dark:text-gray-300 mb-2">
                Xác nhận mật khẩu mới
              </Typography>
              <Box className="relative">
                <TextField
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="Nhập lại mật khẩu mới"
                  error={confirmPassword !== '' && newPassword !== confirmPassword}
                  helperText={
                    confirmPassword !== '' && newPassword !== confirmPassword 
                      ? 'Mật khẩu xác nhận không khớp' 
                      : ''
                  }
                />
                <Button
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 min-w-0 p-1"
                >
                  {showConfirmPassword ? 
                    <EyeSlashIcon className="w-4 h-4" /> : 
                    <EyeIcon className="w-4 h-4" />
                  }
                </Button>
              </Box>
            </Box>

            <Button
              variant="contained"
              onClick={handlePasswordChange}
              disabled={
                !currentPassword || 
                !newPassword || 
                !confirmPassword || 
                newPassword !== confirmPassword ||
                isChangingPassword
              }
              className="w-fit"
            >
              {isChangingPassword ? 'Đang đổi...' : 'Đổi mật khẩu'}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Security Recommendations */}
      <Paper className="p-6" elevation={1}>
        <Typography variant="h6" className="text-gray-900 dark:text-white mb-3">
          Khuyến nghị bảo mật
        </Typography>
        <Stack spacing={2}>
          <Alert severity="info">
            • Sử dụng mật khẩu mạnh với ít nhất 12 ký tự
          </Alert>
          <Alert severity="info">
            • Bật xác thực hai yếu tố để tăng cường bảo mật
          </Alert>
          <Alert severity="info">
            • Đăng xuất khỏi các thiết bị không sử dụng
          </Alert>
          <Alert severity="info">
            • Kiểm tra hoạt động đăng nhập thường xuyên
          </Alert>
        </Stack>
      </Paper>
    </Stack>
  );
};

export default SecuritySettingsPanel;
