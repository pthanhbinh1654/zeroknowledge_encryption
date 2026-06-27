import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import SessionFileManager from '../utils/sessionFileManager';

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316'];

interface DashboardChartsProps {
  fileStats: any;
  securityStats: any;
  usageStats: any;
}

const DashboardCharts: React.FC<DashboardChartsProps> = ({ fileStats, securityStats, usageStats }) => {
  console.log('📊 DashboardCharts received:', { fileStats, securityStats, usageStats });

  // Generate real data from session storage or use provided data - Daily statistics
  const [realFileStats, setRealFileStats] = useState<any>(null);
  const [realUsageStats, setRealUsageStats] = useState<any>(null);

  useEffect(() => {
    const loadFileStats = async () => {
      if (fileStats) {
        setRealFileStats(fileStats);
        return;
      }

      try {
        // Use SessionFileManager to get user-specific files
        const sessionFiles = await SessionFileManager.getFiles();

        if (!sessionFiles || sessionFiles.length === 0) {
          setRealFileStats(null);
          return;
        }

        const now = new Date();
        const last7Days = [];

        // Generate data for last 7 days instead of 3 months
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          const dayKey = date.toISOString().slice(0, 10); // YYYY-MM-DD format

          const filesInDay = sessionFiles.filter((file: any) => {
            const fileDate = new Date(file.timestamp || file.created_at || Date.now());
            return fileDate.toISOString().slice(0, 10) === dayKey;
          });

          last7Days.push({
            date: dayKey,
            day: date.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' }),
            count: filesInDay.length
          });
        }

        setRealFileStats({
          uploads: last7Days,
          downloads: last7Days.map(day => ({ ...day, count: Math.floor(day.count * 0.8) })) // Assume 80% download rate
        });
      } catch (error) {
        console.log('Error loading file stats:', error);
        setRealFileStats(null); // Return null if no real data available
      }
    };

    loadFileStats();
  }, [fileStats]);

  useEffect(() => {
    const loadUsageStats = async () => {
      if (usageStats) {
        setRealUsageStats(usageStats);
        return;
      }

      try {
        // Use SessionFileManager to get user-specific files
        const sessionFiles = await SessionFileManager.getFiles();

        if (!sessionFiles || sessionFiles.length === 0) {
          setRealUsageStats(null);
          return;
        }

        // Calculate algorithm usage from real data
        const algorithmCounts: Record<string, number> = {};
        sessionFiles.forEach((file: any) => {
          const algorithm = file.algorithm || 'Unknown';
          algorithmCounts[algorithm] = (algorithmCounts[algorithm] || 0) + 1;
        });

        const algorithms = Object.entries(algorithmCounts).map(([name, count]) => ({
          name,
          usage: count
        }));

        // Calculate storage usage over time - Daily view
        const now = new Date();
        const last7Days = [];

        for (let i = 6; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          const dayKey = date.toISOString().slice(0, 10);

          const filesInDay = sessionFiles.filter((file: any) => {
            const fileDate = new Date(file.timestamp || file.created_at || Date.now());
            return fileDate.toISOString().slice(0, 10) === dayKey;
          });

          const totalSize = filesInDay.reduce((sum: number, file: any) => sum + (file.size || 0), 0);

          last7Days.push({
            date: dayKey,
            day: date.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' }),
            usage: Math.round(totalSize / (1024 * 1024)) // Convert to MB
          });
        }

        setRealUsageStats({
          storage: last7Days,
          algorithms: algorithms
        });
      } catch (error) {
        console.log('Error loading usage stats:', error);
        setRealUsageStats(null);
      }
    };

    loadUsageStats();
  }, [usageStats]);

  const getRealSecurityStats = () => {
    if (securityStats) return securityStats;

    // For security stats, we don't have meaningful real data in session storage
    // So we'll return null to hide these charts
    return null;
  };



  // Get real data
  // realFileStats and realUsageStats are now managed by useState above
  const realSecurityStats = getRealSecurityStats();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* File Upload/Download Trends - Only show if real data available */}
      {realFileStats && realFileStats.uploads && realFileStats.uploads.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Xu hướng Mã hóa File (7 ngày qua)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={realFileStats.uploads}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="day"
                stroke="#6b7280"
                tick={{ fill: '#6b7280', fontSize: 12 }}
              />
              <YAxis
                stroke="#6b7280"
                tick={{ fill: '#6b7280' }}
              />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: 'none',
                borderRadius: '8px',
                color: '#f9fafb'
              }}
              labelFormatter={(label) => `Ngày: ${label}`}
              formatter={(value, name) => [value, 'Số file mã hóa']}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#3b82f6"
              strokeWidth={3}
              name="Files Encrypted"
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
        </div>
      )}

      {/* Algorithm Usage - Only show if real data available */}
      {(() => {
        const algorithms = (realUsageStats && realUsageStats.algorithms) || (usageStats && usageStats.algorithms) || [];
        console.log('📊 Chart algorithms data:', algorithms);
        return algorithms.length > 0;
      })() && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Sử dụng Thuật toán
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={(realUsageStats && realUsageStats.algorithms) || (usageStats && usageStats.algorithms) || []}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="usage"
              >
                {((realUsageStats && realUsageStats.algorithms) || (usageStats && usageStats.algorithms) || []).map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{
                backgroundColor: '#1f2937',
                border: 'none',
                borderRadius: '8px',
                color: '#f9fafb'
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        </div>
      )}

      {/* Storage Usage - Only show if real data available */}
      {realUsageStats && realUsageStats.storage && realUsageStats.storage.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Sử dụng lưu trữ (7 ngày qua)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={realUsageStats.storage}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="day"
                stroke="#6b7280"
                tick={{ fill: '#6b7280', fontSize: 12 }}
              />
              <YAxis
                stroke="#6b7280"
                tick={{ fill: '#6b7280' }}
                label={{ value: 'MB', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#f9fafb'
                }}
                labelFormatter={(label) => `Ngày: ${label}`}
                formatter={(value, name) => [`${value} MB`, 'Dung lượng sử dụng']}
              />
              <Area
                type="monotone"
                dataKey="usage"
                stackId="1"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Show message if no charts are available */}
      {(!realFileStats || !realFileStats.uploads || realFileStats.uploads.length === 0) &&
       (!realUsageStats || !realUsageStats.algorithms || realUsageStats.algorithms.length === 0) &&
       (!realUsageStats || !realUsageStats.storage || realUsageStats.storage.length === 0) && (
        <div className="col-span-full bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Chưa có dữ liệu biểu đồ
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Hãy mã hóa một số file để xem thống kê và biểu đồ chi tiết.
          </p>
        </div>
      )}
    </div>
  );
};

export default DashboardCharts; 
