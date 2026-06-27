import React from 'react';
import { Stack, Typography, Box, Paper } from '@mui/material';
import { LineChart, BarChart, PieChart } from '@mui/x-charts';

interface ChartData {
  encryptionTrends: Array<{
    date: string;
    count: number;
  }>;
  algorithmUsage: Array<{
    algorithm: string;
    count: number;
    percentage: number;
  }>;
  systemHealth: {
    database: string;
    storage: string;
    security: string;
  };
}

interface EncryptionAnalyticsChartsProps {
  data: ChartData;
}

const EncryptionAnalyticsCharts: React.FC<EncryptionAnalyticsChartsProps> = ({ data }) => {
  // Transform data for MUI X Charts
  const trendData = data.encryptionTrends.map(item => ({
    x: item.date,
    y: item.count
  }));

  const algorithmData = data.algorithmUsage.map(item => ({
    id: item.algorithm,
    value: item.count,
    label: item.algorithm
  }));

  const usageBarData = data.algorithmUsage.map(item => ({
    algorithm: item.algorithm,
    usage: item.percentage
  }));

  return (
    <Stack spacing={4}>
      {/* Encryption Trends */}
      <Paper className="p-6" elevation={1}>
        <Typography variant="h6" className="text-gray-900 dark:text-white mb-4">
          Xu hướng mã hóa theo thời gian
        </Typography>
        <Box className="h-80">
          <LineChart
            series={[
              {
                data: data.encryptionTrends.map(item => item.count),
                label: 'Số lượng file mã hóa',
                color: '#3B82F6'
              }
            ]}
            xAxis={[
              {
                data: data.encryptionTrends.map(item => item.date),
                scaleType: 'point'
              }
            ]}
            height={300}
            margin={{ left: 50, right: 50, top: 50, bottom: 50 }}
          />
        </Box>
      </Paper>

      {/* Algorithm Usage Distribution */}
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={4}>
        <Paper className="p-6 flex-1" elevation={1}>
          <Typography variant="h6" className="text-gray-900 dark:text-white mb-4">
            Phân bố thuật toán mã hóa
          </Typography>
          <Box className="h-80">
            <PieChart
              series={[
                {
                  data: algorithmData,
                  highlightScope: { fade: 'global', highlight: 'item' },
                  faded: { innerRadius: 30, additionalRadius: -30, color: 'gray' }
                }
              ]}
              height={300}
              margin={{ right: 200 }}
            />
          </Box>
        </Paper>

        <Paper className="p-6 flex-1" elevation={1}>
          <Typography variant="h6" className="text-gray-900 dark:text-white mb-4">
            Tỷ lệ sử dụng thuật toán
          </Typography>
          <Box className="h-80">
            <BarChart
              series={[
                {
                  data: usageBarData.map(item => item.usage),
                  label: 'Tỷ lệ sử dụng (%)',
                  color: '#8B5CF6'
                }
              ]}
              xAxis={[
                {
                  data: usageBarData.map(item => item.algorithm),
                  scaleType: 'band'
                }
              ]}
              height={300}
              margin={{ left: 50, right: 50, top: 50, bottom: 100 }}
            />
          </Box>
        </Paper>
      </Stack>

      {/* System Performance Metrics */}
      <Paper className="p-6" elevation={1}>
        <Typography variant="h6" className="text-gray-900 dark:text-white mb-4">
          Hiệu suất hệ thống
        </Typography>
        <Box className="h-80">
          <BarChart
            series={[
              {
                data: [95, 98, 92, 88, 94],
                label: 'Hiệu suất (%)',
                color: '#10B981'
              }
            ]}
            xAxis={[
              {
                data: ['CPU', 'Memory', 'Storage', 'Network', 'Database'],
                scaleType: 'band'
              }
            ]}
            height={300}
            margin={{ left: 50, right: 50, top: 50, bottom: 50 }}
          />
        </Box>
      </Paper>
    </Stack>
  );
};

export default EncryptionAnalyticsCharts;
