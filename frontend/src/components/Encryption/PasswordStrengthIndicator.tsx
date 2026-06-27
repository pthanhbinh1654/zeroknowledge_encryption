import React from 'react';
import { Stack, Typography, LinearProgress, Box } from '@mui/material';
import { PasswordStrength } from '../../types/enums';

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

interface PasswordStrengthResult {
  score: number;
  strength: PasswordStrength;
  feedback: string[];
}

const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ 
  password, 
  className = '' 
}) => {
  const getPasswordStrength = (password: string): PasswordStrengthResult => {
    if (!password) return { score: 0, strength: PasswordStrength.WEAK, feedback: [] };
    
    let score = 0;
    const feedback: string[] = [];

    if (password.length >= 8) score += 1;
    else feedback.push('Mật khẩu phải có ít nhất 8 ký tự');

    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Cần có chữ thường');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Cần có chữ hoa');

    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('Cần có số');

    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    else feedback.push('Cần có ký tự đặc biệt');

    let strength: PasswordStrength;
    if (score <= 2) strength = PasswordStrength.WEAK;
    else if (score <= 3) strength = PasswordStrength.MEDIUM;
    else if (score <= 4) strength = PasswordStrength.GOOD;
    else strength = PasswordStrength.STRONG;

    return { score, strength, feedback };
  };

  const strengthResult = getPasswordStrength(password);

  const getStrengthColor = (strength: PasswordStrength) => {
    switch (strength) {
      case PasswordStrength.WEAK:
        return 'error';
      case PasswordStrength.MEDIUM:
        return 'warning';
      case PasswordStrength.GOOD:
        return 'info';
      case PasswordStrength.STRONG:
        return 'success';
      default:
        return 'error';
    }
  };

  const getStrengthText = (strength: PasswordStrength) => {
    switch (strength) {
      case PasswordStrength.WEAK:
        return 'Yếu';
      case PasswordStrength.MEDIUM:
        return 'Trung bình';
      case PasswordStrength.GOOD:
        return 'Tốt';
      case PasswordStrength.STRONG:
        return 'Mạnh';
      default:
        return 'Yếu';
    }
  };

  if (!password) return null;

  return (
    <Box className={className}>
      <Stack spacing={1}>
        {/* Strength Bar */}
        <Stack direction="row" spacing={1}>
          {[1, 2, 3, 4, 5].map((level) => (
            <Box
              key={level}
              className={`h-2 flex-1 rounded ${
                strengthResult.score >= level
                  ? 'bg-green-500'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </Stack>

        {/* Strength Text */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" className="text-gray-500">
            Độ mạnh mật khẩu:
          </Typography>
          <Typography 
            variant="caption" 
            className={`font-medium ${
              strengthResult.strength === PasswordStrength.WEAK ? 'text-red-500' :
              strengthResult.strength === PasswordStrength.MEDIUM ? 'text-yellow-500' :
              strengthResult.strength === PasswordStrength.GOOD ? 'text-blue-500' :
              'text-green-500'
            }`}
          >
            {getStrengthText(strengthResult.strength)}
          </Typography>
        </Stack>

        {/* Progress Bar */}
        <LinearProgress
          variant="determinate"
          value={(strengthResult.score / 5) * 100}
          color={getStrengthColor(strengthResult.strength) as any}
          className="h-1 rounded"
        />

        {/* Feedback */}
        {strengthResult.feedback.length > 0 && (
          <Stack spacing={0.5}>
            {strengthResult.feedback.slice(0, 3).map((feedback, index) => (
              <Typography 
                key={index}
                variant="caption" 
                className="text-gray-500 dark:text-gray-400"
              >
                • {feedback}
              </Typography>
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

export default PasswordStrengthIndicator;
