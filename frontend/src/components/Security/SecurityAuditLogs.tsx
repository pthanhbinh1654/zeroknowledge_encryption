import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  UserIcon,
  ComputerDesktopIcon,
  ClockIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { 
  Box, 
  Typography, 
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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

// Import services
import ApiClient from '../../lib/api';

// ==================================================
// TYPES & INTERFACES
// ==================================================

interface SecurityEvent {
  id: string;
  event_type: string;
  user_id: string;
  username: string;
  ip_address: string;
  user_agent: string;
  timestamp: string;
  details: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'success' | 'failed' | 'blocked';
}

interface AuditLogFilters {
  event_type: string;
  severity: string;
  status: string;
  date_from: string;
  date_to: string;
  search: string;
}

interface SecurityAuditLogsProps {
  className?: string;
}

// ==================================================
// SECURITY AUDIT LOGS COMPONENT
// ==================================================

const SecurityAuditLogs: React.FC<SecurityAuditLogsProps> = ({ className }) => {
  // State management
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalEvents, setTotalEvents] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [filters, setFilters] = useState<AuditLogFilters>({
    event_type: '',
    severity: '',
    status: '',
    date_from: '',
    date_to: '',
    search: ''
  });
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);
  const [showEventDetail, setShowEventDetail] = useState(false);

  // ==================================================
  // DATA FETCHING
  // ==================================================

  const fetchSecurityEvents = useCallback(async (page: number = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: pageSize.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '')
        )
      });

      const response = await ApiClient.get(`/security/audit-logs?${params}`);
      
      setEvents(response.data.events || []);
      setTotalEvents(response.data.total || 0);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching security events:', error);
      toast.error('Lỗi khi tải audit logs');
    } finally {
      setIsLoading(false);
    }
  }, [filters, pageSize]);

  useEffect(() => {
    fetchSecurityEvents(1);
  }, [fetchSecurityEvents]);

  // ==================================================
  // EVENT HANDLERS
  // ==================================================

  const handleFilterChange = (field: keyof AuditLogFilters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleSearch = () => {
    fetchSecurityEvents(1);
  };

  const handleExportLogs = async () => {
    try {
      const params = new URLSearchParams({
        export: 'true',
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '')
        )
      });

      const response = await ApiClient.get(`/security/audit-logs/export?${params}`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `security_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.success('Đã xuất audit logs thành công');
    } catch (error) {
      console.error('Error exporting logs:', error);
      toast.error('Lỗi khi xuất audit logs');
    }
  };

  const handleViewEventDetail = (event: SecurityEvent) => {
    setSelectedEvent(event);
    setShowEventDetail(true);
  };

  // ==================================================
  // RENDER HELPERS
  // ==================================================

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'success';
      case 'failed': return 'error';
      case 'blocked': return 'warning';
      default: return 'default';
    }
  };

  const getEventTypeIcon = (eventType: string) => {
    switch (eventType) {
      case 'login':
      case 'logout':
        return <UserIcon className="h-5 w-5" />;
      case 'file_upload':
      case 'file_download':
      case 'file_delete':
        return <ComputerDesktopIcon className="h-5 w-5" />;
      case 'password_change':
      case 'security_alert':
        return <ShieldCheckIcon className="h-5 w-5" />;
      default:
        return <InformationCircleIcon className="h-5 w-5" />;
    }
  };

  const formatEventType = (eventType: string) => {
    const typeMap: Record<string, string> = {
      'login': 'Đăng nhập',
      'logout': 'Đăng xuất',
      'register': 'Đăng ký',
      'password_change': 'Đổi mật khẩu',
      'file_upload': 'Upload file',
      'file_download': 'Download file',
      'file_delete': 'Xóa file',
      'security_alert': 'Cảnh báo bảo mật',
      'failed_login': 'Đăng nhập thất bại',
      'account_locked': 'Khóa tài khoản'
    };
    return typeMap[eventType] || eventType;
  };

  const formatTimestamp = (timestamp: string) => {
    return format(new Date(timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: vi });
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center">
        <ShieldCheckIcon className="mx-auto h-12 w-12 text-primary-600 dark:text-primary-400 mb-4" />
        <Typography variant="h5" className="text-gray-900 dark:text-white font-bold mb-2">
          Security Audit Logs
        </Typography>
        <Typography variant="body1" className="text-gray-600 dark:text-gray-400">
          Lịch sử hoạt động và sự kiện bảo mật chi tiết
        </Typography>
      </div>

      {/* Filters */}
      <Paper className="p-6">
        <Typography variant="h6" className="mb-4">
          Bộ lọc và tìm kiếm
        </Typography>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <TextField
            label="Tìm kiếm"
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            placeholder="IP, username, event..."
            InputProps={{
              startAdornment: <MagnifyingGlassIcon className="h-4 w-4 mr-2 text-gray-400" />
            }}
          />
          
          <FormControl>
            <InputLabel>Loại sự kiện</InputLabel>
            <Select
              value={filters.event_type}
              onChange={(e) => handleFilterChange('event_type', e.target.value)}
              label="Loại sự kiện"
            >
              <MenuItem value="">Tất cả</MenuItem>
              <MenuItem value="login">Đăng nhập</MenuItem>
              <MenuItem value="logout">Đăng xuất</MenuItem>
              <MenuItem value="file_upload">Upload file</MenuItem>
              <MenuItem value="file_download">Download file</MenuItem>
              <MenuItem value="password_change">Đổi mật khẩu</MenuItem>
              <MenuItem value="security_alert">Cảnh báo bảo mật</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl>
            <InputLabel>Mức độ nghiêm trọng</InputLabel>
            <Select
              value={filters.severity}
              onChange={(e) => handleFilterChange('severity', e.target.value)}
              label="Mức độ nghiêm trọng"
            >
              <MenuItem value="">Tất cả</MenuItem>
              <MenuItem value="low">Thấp</MenuItem>
              <MenuItem value="medium">Trung bình</MenuItem>
              <MenuItem value="high">Cao</MenuItem>
              <MenuItem value="critical">Nghiêm trọng</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl>
            <InputLabel>Trạng thái</InputLabel>
            <Select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              label="Trạng thái"
            >
              <MenuItem value="">Tất cả</MenuItem>
              <MenuItem value="success">Thành công</MenuItem>
              <MenuItem value="failed">Thất bại</MenuItem>
              <MenuItem value="blocked">Bị chặn</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            label="Từ ngày"
            type="date"
            value={filters.date_from}
            onChange={(e) => handleFilterChange('date_from', e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          
          <TextField
            label="Đến ngày"
            type="date"
            value={filters.date_to}
            onChange={(e) => handleFilterChange('date_to', e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </div>
        
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            onClick={handleSearch}
            startIcon={<FunnelIcon className="h-4 w-4" />}
          >
            Áp dụng bộ lọc
          </Button>
          <Button
            variant="outlined"
            onClick={handleExportLogs}
            startIcon={<ArrowDownTrayIcon className="h-4 w-4" />}
          >
            Xuất CSV
          </Button>
        </Stack>
      </Paper>

      {/* Events Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Thời gian</TableCell>
                <TableCell>Sự kiện</TableCell>
                <TableCell>Người dùng</TableCell>
                <TableCell>IP Address</TableCell>
                <TableCell>Mức độ</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell>Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                      <span className="ml-2">Đang tải...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Typography variant="body2" className="text-gray-500">
                      Không có sự kiện nào
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => (
                  <TableRow key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <ClockIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{formatTimestamp(event.timestamp)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getEventTypeIcon(event.event_type)}
                        <span>{formatEventType(event.event_type)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <UserIcon className="h-4 w-4 text-gray-400" />
                        <span>{event.username}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                        {event.ip_address}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={event.severity.toUpperCase()} 
                        color={getSeverityColor(event.severity) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={event.status.toUpperCase()} 
                        color={getStatusColor(event.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        onClick={() => handleViewEventDetail(event)}
                        startIcon={<EyeIcon className="h-4 w-4" />}
                      >
                        Chi tiết
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        {/* Pagination */}
        {totalEvents > pageSize && (
          <div className="flex justify-center py-4">
            <Pagination
              count={Math.ceil(totalEvents / pageSize)}
              page={currentPage}
              onChange={(_, page) => fetchSecurityEvents(page)}
              color="primary"
            />
          </div>
        )}
      </Paper>

      {/* Event Detail Dialog */}
      <Dialog 
        open={showEventDetail} 
        onClose={() => setShowEventDetail(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Chi tiết sự kiện bảo mật</DialogTitle>
        <DialogContent>
          {selectedEvent && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Typography variant="subtitle2" className="text-gray-600">Loại sự kiện</Typography>
                  <Typography variant="body2">{formatEventType(selectedEvent.event_type)}</Typography>
                </div>
                <div>
                  <Typography variant="subtitle2" className="text-gray-600">Thời gian</Typography>
                  <Typography variant="body2">{formatTimestamp(selectedEvent.timestamp)}</Typography>
                </div>
                <div>
                  <Typography variant="subtitle2" className="text-gray-600">Người dùng</Typography>
                  <Typography variant="body2">{selectedEvent.username}</Typography>
                </div>
                <div>
                  <Typography variant="subtitle2" className="text-gray-600">IP Address</Typography>
                  <Typography variant="body2">{selectedEvent.ip_address}</Typography>
                </div>
                <div>
                  <Typography variant="subtitle2" className="text-gray-600">Mức độ nghiêm trọng</Typography>
                  <Chip 
                    label={selectedEvent.severity.toUpperCase()} 
                    color={getSeverityColor(selectedEvent.severity) as any}
                    size="small"
                  />
                </div>
                <div>
                  <Typography variant="subtitle2" className="text-gray-600">Trạng thái</Typography>
                  <Chip 
                    label={selectedEvent.status.toUpperCase()} 
                    color={getStatusColor(selectedEvent.status) as any}
                    size="small"
                  />
                </div>
              </div>
              
              <div>
                <Typography variant="subtitle2" className="text-gray-600 mb-2">User Agent</Typography>
                <Typography variant="body2" className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs">
                  {selectedEvent.user_agent}
                </Typography>
              </div>
              
              {Object.keys(selectedEvent.details).length > 0 && (
                <div>
                  <Typography variant="subtitle2" className="text-gray-600 mb-2">Chi tiết bổ sung</Typography>
                  <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-auto">
                    {JSON.stringify(selectedEvent.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEventDetail(false)}>
            Đóng
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default SecurityAuditLogs;
