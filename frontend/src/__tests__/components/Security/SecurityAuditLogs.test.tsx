import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SecurityAuditLogs from '../../../components/Security/SecurityAuditLogs';
import ApiClient from '../../../lib/api';
import { toast } from 'react-hot-toast';

// Mock dependencies
jest.mock('../../../lib/api');
jest.mock('react-hot-toast');

const mockApiClient = ApiClient as jest.Mocked<typeof ApiClient>;

describe('SecurityAuditLogs Component', () => {
  const mockSecurityEvents = [
    {
      id: '1',
      event_type: 'login',
      user_id: 'user1',
      username: 'testuser',
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0...',
      timestamp: '2024-01-01T10:00:00Z',
      details: { success: true },
      severity: 'low',
      status: 'success'
    },
    {
      id: '2',
      event_type: 'failed_login',
      user_id: 'user1',
      username: 'testuser',
      ip_address: '192.168.1.2',
      user_agent: 'Mozilla/5.0...',
      timestamp: '2024-01-01T11:00:00Z',
      details: { reason: 'invalid_password' },
      severity: 'medium',
      status: 'failed'
    },
    {
      id: '3',
      event_type: 'file_upload',
      user_id: 'user1',
      username: 'testuser',
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0...',
      timestamp: '2024-01-01T12:00:00Z',
      details: { filename: 'test.txt' },
      severity: 'low',
      status: 'success'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockApiClient.get.mockResolvedValue({
      data: {
        events: mockSecurityEvents,
        total: mockSecurityEvents.length
      }
    });
  });

  it('renders security audit logs component', async () => {
    render(<SecurityAuditLogs />);
    
    expect(screen.getByText('Security Audit Logs')).toBeInTheDocument();
    expect(screen.getByText('Lịch sử hoạt động và sự kiện bảo mật chi tiết')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });
  });

  it('loads and displays security events', async () => {
    render(<SecurityAuditLogs />);
    
    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/security/audit-logs')
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Đăng nhập')).toBeInTheDocument();
      expect(screen.getByText('Đăng nhập thất bại')).toBeInTheDocument();
      expect(screen.getByText('Upload file')).toBeInTheDocument();
    });
  });

  it('displays event details correctly', async () => {
    render(<SecurityAuditLogs />);
    
    await waitFor(() => {
      // Check IP addresses
      expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
      expect(screen.getByText('192.168.1.2')).toBeInTheDocument();
      
      // Check severity chips
      expect(screen.getByText('LOW')).toBeInTheDocument();
      expect(screen.getByText('MEDIUM')).toBeInTheDocument();
      
      // Check status chips
      expect(screen.getByText('SUCCESS')).toBeInTheDocument();
      expect(screen.getByText('FAILED')).toBeInTheDocument();
    });
  });

  it('formats timestamps correctly', async () => {
    render(<SecurityAuditLogs />);
    
    await waitFor(() => {
      // Should display formatted Vietnamese dates
      expect(screen.getByText(/01\/01\/2024/)).toBeInTheDocument();
    });
  });

  it('handles search functionality', async () => {
    render(<SecurityAuditLogs />);
    
    const searchInput = screen.getByPlaceholderText('IP, username, event...');
    fireEvent.change(searchInput, { target: { value: '192.168.1.2' } });
    
    const applyButton = screen.getByText('Áp dụng bộ lọc');
    fireEvent.click(applyButton);
    
    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('search=192.168.1.2')
      );
    });
  });

  it('handles event type filtering', async () => {
    render(<SecurityAuditLogs />);
    
    const eventTypeSelect = screen.getByLabelText('Loại sự kiện');
    fireEvent.mouseDown(eventTypeSelect);
    
    const loginOption = screen.getByText('Đăng nhập');
    fireEvent.click(loginOption);
    
    const applyButton = screen.getByText('Áp dụng bộ lọc');
    fireEvent.click(applyButton);
    
    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('event_type=login')
      );
    });
  });

  it('handles severity filtering', async () => {
    render(<SecurityAuditLogs />);
    
    const severitySelect = screen.getByLabelText('Mức độ nghiêm trọng');
    fireEvent.mouseDown(severitySelect);
    
    const highOption = screen.getByText('Cao');
    fireEvent.click(highOption);
    
    const applyButton = screen.getByText('Áp dụng bộ lọc');
    fireEvent.click(applyButton);
    
    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('severity=high')
      );
    });
  });

  it('handles status filtering', async () => {
    render(<SecurityAuditLogs />);
    
    const statusSelect = screen.getByLabelText('Trạng thái');
    fireEvent.mouseDown(statusSelect);
    
    const successOption = screen.getByText('Thành công');
    fireEvent.click(successOption);
    
    const applyButton = screen.getByText('Áp dụng bộ lọc');
    fireEvent.click(applyButton);
    
    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('status=success')
      );
    });
  });

  it('handles date range filtering', async () => {
    render(<SecurityAuditLogs />);
    
    const fromDateInput = screen.getByLabelText('Từ ngày');
    fireEvent.change(fromDateInput, { target: { value: '2024-01-01' } });
    
    const toDateInput = screen.getByLabelText('Đến ngày');
    fireEvent.change(toDateInput, { target: { value: '2024-01-31' } });
    
    const applyButton = screen.getByText('Áp dụng bộ lọc');
    fireEvent.click(applyButton);
    
    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('date_from=2024-01-01')
      );
      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('date_to=2024-01-31')
      );
    });
  });

  it('opens event detail dialog', async () => {
    render(<SecurityAuditLogs />);
    
    await waitFor(() => {
      const detailButtons = screen.getAllByText('Chi tiết');
      fireEvent.click(detailButtons[0]);
    });
    
    expect(screen.getByText('Chi tiết sự kiện bảo mật')).toBeInTheDocument();
    expect(screen.getByText('Đăng nhập')).toBeInTheDocument();
    expect(screen.getByText('testuser')).toBeInTheDocument();
  });

  it('displays event details in dialog', async () => {
    render(<SecurityAuditLogs />);
    
    await waitFor(() => {
      const detailButtons = screen.getAllByText('Chi tiết');
      fireEvent.click(detailButtons[0]);
    });
    
    // Check all detail fields
    expect(screen.getByText('Loại sự kiện')).toBeInTheDocument();
    expect(screen.getByText('Thời gian')).toBeInTheDocument();
    expect(screen.getByText('Người dùng')).toBeInTheDocument();
    expect(screen.getByText('IP Address')).toBeInTheDocument();
    expect(screen.getByText('User Agent')).toBeInTheDocument();
    expect(screen.getByText('Chi tiết bổ sung')).toBeInTheDocument();
  });

  it('closes event detail dialog', async () => {
    render(<SecurityAuditLogs />);
    
    await waitFor(() => {
      const detailButtons = screen.getAllByText('Chi tiết');
      fireEvent.click(detailButtons[0]);
    });
    
    const closeButton = screen.getByText('Đóng');
    fireEvent.click(closeButton);
    
    expect(screen.queryByText('Chi tiết sự kiện bảo mật')).not.toBeInTheDocument();
  });

  it('handles CSV export', async () => {
    // Mock blob and URL creation
    global.URL.createObjectURL = jest.fn().mockReturnValue('mock-url');
    global.URL.revokeObjectURL = jest.fn();
    
    const mockBlob = new Blob(['csv content']);
    mockApiClient.get.mockResolvedValueOnce({
      data: mockBlob
    });

    render(<SecurityAuditLogs />);
    
    const exportButton = screen.getByText('Xuất CSV');
    fireEvent.click(exportButton);
    
    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/security/audit-logs/export'),
        expect.objectContaining({
          responseType: 'blob'
        })
      );
    });
    
    expect(toast.success).toHaveBeenCalledWith('Đã xuất audit logs thành công');
  });

  it('handles export error', async () => {
    mockApiClient.get.mockRejectedValueOnce(new Error('Export failed'));

    render(<SecurityAuditLogs />);
    
    const exportButton = screen.getByText('Xuất CSV');
    fireEvent.click(exportButton);
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Lỗi khi xuất audit logs');
    });
  });

  it('handles pagination', async () => {
    const manyEvents = Array.from({ length: 25 }, (_, i) => ({
      ...mockSecurityEvents[0],
      id: `event-${i}`,
      timestamp: `2024-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`
    }));

    mockApiClient.get.mockResolvedValue({
      data: {
        events: manyEvents.slice(0, 20),
        total: 25
      }
    });

    render(<SecurityAuditLogs />);
    
    await waitFor(() => {
      // Should show pagination
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    mockApiClient.get.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<SecurityAuditLogs />);
    
    expect(screen.getByText('Đang tải...')).toBeInTheDocument();
  });

  it('shows empty state when no events', async () => {
    mockApiClient.get.mockResolvedValue({
      data: {
        events: [],
        total: 0
      }
    });

    render(<SecurityAuditLogs />);
    
    await waitFor(() => {
      expect(screen.getByText('Không có sự kiện nào')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    mockApiClient.get.mockRejectedValue(new Error('API Error'));

    render(<SecurityAuditLogs />);
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Lỗi khi tải audit logs');
    });
  });

  it('displays correct severity colors', async () => {
    const eventsWithDifferentSeverities = [
      { ...mockSecurityEvents[0], severity: 'critical' },
      { ...mockSecurityEvents[0], severity: 'high' },
      { ...mockSecurityEvents[0], severity: 'medium' },
      { ...mockSecurityEvents[0], severity: 'low' }
    ];

    mockApiClient.get.mockResolvedValue({
      data: {
        events: eventsWithDifferentSeverities,
        total: 4
      }
    });

    render(<SecurityAuditLogs />);
    
    await waitFor(() => {
      expect(screen.getByText('CRITICAL')).toBeInTheDocument();
      expect(screen.getByText('HIGH')).toBeInTheDocument();
      expect(screen.getByText('MEDIUM')).toBeInTheDocument();
      expect(screen.getByText('LOW')).toBeInTheDocument();
    });
  });

  it('displays correct status colors', async () => {
    const eventsWithDifferentStatuses = [
      { ...mockSecurityEvents[0], status: 'success' },
      { ...mockSecurityEvents[0], status: 'failed' },
      { ...mockSecurityEvents[0], status: 'blocked' }
    ];

    mockApiClient.get.mockResolvedValue({
      data: {
        events: eventsWithDifferentStatuses,
        total: 3
      }
    });

    render(<SecurityAuditLogs />);
    
    await waitFor(() => {
      expect(screen.getByText('SUCCESS')).toBeInTheDocument();
      expect(screen.getByText('FAILED')).toBeInTheDocument();
      expect(screen.getByText('BLOCKED')).toBeInTheDocument();
    });
  });
});
