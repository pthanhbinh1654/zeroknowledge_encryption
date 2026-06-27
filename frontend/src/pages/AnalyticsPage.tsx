import React, { useState } from 'react';
import {
  ChartBarIcon,
  PresentationChartBarIcon,
  DocumentChartBarIcon,
  ShieldCheckIcon,
  ClockIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Alert,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import { motion } from 'framer-motion';

// Import components
// Tạm ẩn dashboard nâng cao do thiếu dependency chartjs-adapter-date-fns
// import AdvancedAnalyticsDashboard from '../components/Analytics/AdvancedAnalyticsDashboard';

const AnalyticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports' | 'insights'>('dashboard');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <ChartBarIcon className="mx-auto h-16 w-16 text-primary-600 dark:text-primary-400 mb-4" />
          <Typography variant="h3" className="text-gray-900 dark:text-white font-bold mb-4">
            Analytics & Insights
          </Typography>
          <Typography variant="h6" className="text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Phân tích chi tiết hoạt động, xu hướng và hiệu suất hệ thống mã hóa Zero Knowledge
          </Typography>
        </motion.div>

        {/* Analytics Overview Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card className="h-full">
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2} className="mb-3">
                    <PresentationChartBarIcon className="h-8 w-8 text-blue-500" />
                    <Typography variant="h6">Dashboard Tổng quan</Typography>
                  </Stack>
                  <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
                    Biểu đồ và thống kê real-time về hoạt động mã hóa, giải mã và sử dụng hệ thống.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Card className="h-full">
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2} className="mb-3">
                    <DocumentChartBarIcon className="h-8 w-8 text-green-500" />
                    <Typography variant="h6">Báo cáo Chi tiết</Typography>
                  </Stack>
                  <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
                    Báo cáo chuyên sâu về xu hướng, hiệu suất và các chỉ số quan trọng theo thời gian.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Card className="h-full">
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2} className="mb-3">
                    <ShieldCheckIcon className="h-8 w-8 text-purple-500" />
                    <Typography variant="h6">Insights Bảo mật</Typography>
                  </Stack>
                  <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
                    Phân tích bảo mật, phát hiện anomaly và khuyến nghị cải thiện security posture.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </motion.div>

        {/* Zero Knowledge Analytics Principles */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <Alert severity="info" icon={<InformationCircleIcon className="h-5 w-5" />}>
            <Typography variant="body2" className="font-medium mb-2">
              Nguyên tắc Zero Knowledge trong Analytics:
            </Typography>
            <List dense>
              <ListItem disablePadding>
                <ListItemIcon className="min-w-0 mr-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                </ListItemIcon>
                <ListItemText
                  primary="Chỉ thu thập metadata và thống kê tổng hợp"
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              <ListItem disablePadding>
                <ListItemIcon className="min-w-0 mr-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                </ListItemIcon>
                <ListItemText
                  primary="Không lưu trữ nội dung file hoặc thông tin nhạy cảm"
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              <ListItem disablePadding>
                <ListItemIcon className="min-w-0 mr-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                </ListItemIcon>
                <ListItemText
                  primary="Dữ liệu được mã hóa và chỉ user sở hữu mới truy cập được"
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              <ListItem disablePadding>
                <ListItemIcon className="min-w-0 mr-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                </ListItemIcon>
                <ListItemText
                  primary="Tuân thủ GDPR và các quy định bảo mật quốc tế"
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
            </List>
          </Alert>
        </motion.div>

        {/* Main Content Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Paper className="mb-6">
            <Tabs
              value={activeTab}
              onChange={(_, newValue) => setActiveTab(newValue)}
              variant="fullWidth"
            >
              <Tab
                label="Dashboard"
                value="dashboard"
                icon={<PresentationChartBarIcon className="h-4 w-4" />}
              />
              <Tab
                label="Báo cáo"
                value="reports"
                icon={<DocumentChartBarIcon className="h-4 w-4" />}
              />
              <Tab
                label="Insights"
                value="insights"
                icon={<ShieldCheckIcon className="h-4 w-4" />}
              />
            </Tabs>
          </Paper>

          {/* Tab Content */}
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="p-6 text-center text-secondary-600 dark:text-secondary-400">
                Tính năng Dashboard nâng cao đang được cập nhật. Vui lòng quay lại sau.
              </div>
            </motion.div>
          )}

          {activeTab === 'reports' && (
            <motion.div
              key="reports"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Paper className="p-6">
                <Typography variant="h6" className="mb-4">
                  Báo cáo Chi tiết
                </Typography>
                <Alert severity="info">
                  <Typography variant="body2">
                    Tính năng báo cáo chi tiết sẽ được triển khai trong phiên bản tiếp theo.
                    Bao gồm: báo cáo tuần/tháng/quý, export PDF/Excel, scheduled reports.
                  </Typography>
                </Alert>
              </Paper>
            </motion.div>
          )}

          {activeTab === 'insights' && (
            <motion.div
              key="insights"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Paper className="p-6">
                <Typography variant="h6" className="mb-4">
                  Security Insights & AI Analysis
                </Typography>
                <Alert severity="info">
                  <Typography variant="body2">
                    Tính năng AI insights sẽ được triển khai trong phiên bản tiếp theo.
                    Bao gồm: anomaly detection, predictive analytics, security recommendations.
                  </Typography>
                </Alert>
              </Paper>
            </motion.div>
          )}
        </motion.div>
        {/* Key Metrics Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8"
        >
          <Paper className="p-6">
            <Typography variant="h6" className="mb-4">
              Chỉ số Quan trọng
            </Typography>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 3 }}>
                <Card variant="outlined">
                  <CardContent className="text-center">
                    <ClockIcon className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                    <Typography variant="h5" className="font-bold">
                      99.9%
                    </Typography>
                    <Typography variant="body2" className="text-gray-600">
                      Uptime hệ thống
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <Card variant="outlined">
                  <CardContent className="text-center">
                    <ShieldCheckIcon className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <Typography variant="h5" className="font-bold">
                      100%
                    </Typography>
                    <Typography variant="body2" className="text-gray-600">
                      Zero Knowledge compliance
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <Card variant="outlined">
                  <CardContent className="text-center">
                    <ChartBarIcon className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                    <Typography variant="h5" className="font-bold">
                      &lt;2s
                    </Typography>
                    <Typography variant="body2" className="text-gray-600">
                      Thời gian mã hóa trung bình
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <Card variant="outlined">
                  <CardContent className="text-center">
                    <DocumentChartBarIcon className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                    <Typography variant="h5" className="font-bold">
                      256-bit
                    </Typography>
                    <Typography variant="body2" className="text-gray-600">
                      Mức độ mã hóa
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        </motion.div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
