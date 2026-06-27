import React, { useState, useEffect, useCallback } from 'react';
import { 
  ChartBarIcon,
  ClockIcon,
  ShieldCheckIcon,
  DocumentIcon,
  UserIcon,
  ComputerDesktopIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  InformationCircleIcon,
  CalendarIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import { 
  Box, 
  Typography, 
  Paper,
  Stack,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  Alert
} from '@mui/material';
import { motion } from 'framer-motion';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  TimeScale
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

// Import services
import ApiClient from '../../lib/api';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  TimeScale
);

// ==================================================
// TYPES & INTERFACES
// ==================================================

interface AnalyticsData {
  overview: {
    total_files: number;
    total_size: number;
    total_encryptions: number;
    total_decryptions: number;
    success_rate: number;
    avg_file_size: number;
  };
  trends: {
    daily_activity: Array<{
      date: string;
      encryptions: number;
      decryptions: number;
      file_uploads: number;
    }>;
    algorithm_usage: Array<{
      algorithm: string;
      count: number;
      percentage: number;
    }>;
    file_types: Array<{
      type: string;
      count: number;
      size: number;
    }>;
  };
  security: {
    login_attempts: Array<{
      date: string;
      successful: number;
      failed: number;
    }>;
    security_events: Array<{
      event_type: string;
      count: number;
      severity: string;
    }>;
  };
  performance: {
    avg_encryption_time: number;
    avg_decryption_time: number;
    peak_usage_hours: Array<{
      hour: number;
      activity_count: number;
    }>;
  };
}

interface AdvancedAnalyticsDashboardProps {
  className?: string;
}

// ==================================================
// ADVANCED ANALYTICS DASHBOARD COMPONENT
// ==================================================

const AdvancedAnalyticsDashboard: React.FC<AdvancedAnalyticsDashboardProps> = ({ className }) => {
  // State management
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [selectedMetric, setSelectedMetric] = useState<'activity' | 'security' | 'performance'>('activity');

  // ==================================================
  // DATA FETCHING
  // ==================================================

  const fetchAnalyticsData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await ApiClient.get(`/analytics/advanced?time_range=${timeRange}`);
      setAnalyticsData(response.data);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  // ==================================================
  // CHART CONFIGURATIONS
  // ==================================================

  const activityChartData = {
    labels: analyticsData?.trends.daily_activity.map(item => item.date) || [],
    datasets: [
      {
        label: 'Mã hóa',
        data: analyticsData?.trends.daily_activity.map(item => item.encryptions) || [],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Giải mã',
        data: analyticsData?.trends.daily_activity.map(item => item.decryptions) || [],
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const algorithmChartData = {
    labels: analyticsData?.trends.algorithm_usage.map(item => item.algorithm) || [],
    datasets: [
      {
        data: analyticsData?.trends.algorithm_usage.map(item => item.count) || [],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)',
        ],
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  };

  const securityChartData = {
    labels: analyticsData?.security.login_attempts.map(item => item.date) || [],
    datasets: [
      {
        label: 'Đăng nhập thành công',
        data: analyticsData?.security.login_attempts.map(item => item.successful) || [],
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
      },
      {
        label: 'Đăng nhập thất bại',
        data: analyticsData?.security.login_attempts.map(item => item.failed) || [],
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  // ==================================================
  // RENDER HELPERS
  // ==================================================

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const getTimeRangeLabel = (range: string): string => {
    switch (range) {
      case '7d': return '7 ngày qua';
      case '30d': return '30 ngày qua';
      case '90d': return '90 ngày qua';
      case '1y': return '1 năm qua';
      default: return range;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2">Đang tải dữ liệu analytics...</span>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <Alert severity="error">
        <Typography variant="body2">
          Không thể tải dữ liệu analytics. Vui lòng thử lại sau.
        </Typography>
      </Alert>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center">
        <ChartBarIcon className="mx-auto h-12 w-12 text-primary-600 dark:text-primary-400 mb-4" />
        <Typography variant="h5" className="text-gray-900 dark:text-white font-bold mb-2">
          Advanced Analytics Dashboard
        </Typography>
        <Typography variant="body1" className="text-gray-600 dark:text-gray-400">
          Phân tích chi tiết hoạt động, bảo mật và hiệu suất hệ thống
        </Typography>
      </div>

      {/* Controls */}
      <Paper className="p-4">
        <Stack direction="row" spacing={3} alignItems="center">
          <FormControl size="small" style={{ minWidth: 120 }}>
            <InputLabel>Khoảng thời gian</InputLabel>
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              label="Khoảng thời gian"
            >
              <MenuItem value="7d">7 ngày</MenuItem>
              <MenuItem value="30d">30 ngày</MenuItem>
              <MenuItem value="90d">90 ngày</MenuItem>
              <MenuItem value="1y">1 năm</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" style={{ minWidth: 120 }}>
            <InputLabel>Chỉ số</InputLabel>
            <Select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as any)}
              label="Chỉ số"
            >
              <MenuItem value="activity">Hoạt động</MenuItem>
              <MenuItem value="security">Bảo mật</MenuItem>
              <MenuItem value="performance">Hiệu suất</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            onClick={fetchAnalyticsData}
            startIcon={<FunnelIcon className="h-4 w-4" />}
          >
            Cập nhật
          </Button>

          <Chip 
            label={getTimeRangeLabel(timeRange)} 
            color="primary" 
            variant="outlined"
            icon={<CalendarIcon className="h-4 w-4" />}
          />
        </Stack>
      </Paper>

      {/* Overview Cards */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <DocumentIcon className="h-8 w-8 text-blue-500" />
                  <div>
                    <Typography variant="h4" className="font-bold">
                      {analyticsData.overview.total_files.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" className="text-gray-600">
                      Tổng số file
                    </Typography>
                  </div>
                </Stack>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <ComputerDesktopIcon className="h-8 w-8 text-green-500" />
                  <div>
                    <Typography variant="h4" className="font-bold">
                      {formatFileSize(analyticsData.overview.total_size)}
                    </Typography>
                    <Typography variant="body2" className="text-gray-600">
                      Tổng dung lượng
                    </Typography>
                  </div>
                </Stack>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <ShieldCheckIcon className="h-8 w-8 text-purple-500" />
                  <div>
                    <Typography variant="h4" className="font-bold">
                      {analyticsData.overview.total_encryptions.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" className="text-gray-600">
                      Lượt mã hóa
                    </Typography>
                  </div>
                </Stack>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  {analyticsData.overview.success_rate >= 95 ? (
                    <ArrowTrendingUpIcon className="h-8 w-8 text-green-500" />
                  ) : (
                    <ArrowTrendingDownIcon className="h-8 w-8 text-red-500" />
                  )}
                  <div>
                    <Typography variant="h4" className="font-bold">
                      {formatPercentage(analyticsData.overview.success_rate)}
                    </Typography>
                    <Typography variant="body2" className="text-gray-600">
                      Tỷ lệ thành công
                    </Typography>
                  </div>
                </Stack>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>

      {/* Main Charts */}
      <Grid container spacing={3}>
        {/* Activity Chart */}
        {selectedMetric === 'activity' && (
          <>
            <Grid size={{ xs: 12, lg: 8 }}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Paper className="p-6">
                  <Typography variant="h6" className="mb-4">
                    Hoạt động theo thời gian
                  </Typography>
                  <Line data={activityChartData} options={chartOptions} />
                </Paper>
              </motion.div>
            </Grid>

            <Grid size={{ xs: 12, lg: 4 }}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Paper className="p-6">
                  <Typography variant="h6" className="mb-4">
                    Thuật toán sử dụng
                  </Typography>
                  <Doughnut data={algorithmChartData} />
                </Paper>
              </motion.div>
            </Grid>
          </>
        )}

        {/* Security Chart */}
        {selectedMetric === 'security' && (
          <Grid size={{ xs: 12 }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Paper className="p-6">
                <Typography variant="h6" className="mb-4">
                  Hoạt động bảo mật
                </Typography>
                <Bar data={securityChartData} options={chartOptions} />
              </Paper>
            </motion.div>
          </Grid>
        )}

        {/* Performance Metrics */}
        {selectedMetric === 'performance' && (
          <Grid size={{ xs: 12 }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Paper className="p-6">
                <Typography variant="h6" className="mb-4">
                  Hiệu suất hệ thống
                </Typography>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Card variant="outlined">
                      <CardContent className="text-center">
                        <ClockIcon className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                        <Typography variant="h5" className="font-bold">
                          {analyticsData.performance.avg_encryption_time.toFixed(2)}s
                        </Typography>
                        <Typography variant="body2" className="text-gray-600">
                          Thời gian mã hóa trung bình
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Card variant="outlined">
                      <CardContent className="text-center">
                        <ClockIcon className="h-8 w-8 text-green-500 mx-auto mb-2" />
                        <Typography variant="h5" className="font-bold">
                          {analyticsData.performance.avg_decryption_time.toFixed(2)}s
                        </Typography>
                        <Typography variant="body2" className="text-gray-600">
                          Thời gian giải mã trung bình
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Card variant="outlined">
                      <CardContent className="text-center">
                        <UserIcon className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                        <Typography variant="h5" className="font-bold">
                          {Math.max(...analyticsData.performance.peak_usage_hours.map(h => h.activity_count))}
                        </Typography>
                        <Typography variant="body2" className="text-gray-600">
                          Hoạt động cao nhất/giờ
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Paper>
            </motion.div>
          </Grid>
        )}
      </Grid>

      {/* Additional Info */}
      <Alert severity="info" icon={<InformationCircleIcon className="h-5 w-5" />}>
        <Typography variant="body2">
          <strong>Lưu ý:</strong> Tất cả dữ liệu analytics được thu thập theo nguyên tắc Zero Knowledge. 
          Chỉ có metadata và thống kê tổng hợp được lưu trữ, không có thông tin nhạy cảm nào được ghi lại.
        </Typography>
      </Alert>
    </div>
  );
};

export default AdvancedAnalyticsDashboard;
