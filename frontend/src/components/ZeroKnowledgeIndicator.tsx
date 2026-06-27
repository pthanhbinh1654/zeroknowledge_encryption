/**
 * Zero-Knowledge Indicator Component
 * ==================================
 * Component hiển thị trạng thái Zero-Knowledge của hệ thống.
 */

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheckIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

// ==================================================
// TYPES & INTERFACES
// ==================================================

interface ZeroKnowledgeStatus {
  zero_knowledge_enabled: boolean;
  compliance_status: 'compliant' | 'violations_detected';
  total_violations: number;
  principles: Array<{
    name: string;
    description: string;
    status: string;
  }>;
  recent_violations: Array<any>;
  system_info: {
    server_never_sees_original_data: boolean;
    server_never_sees_private_keys: boolean;
    server_never_sees_plaintext_passwords: boolean;
    client_side_encryption_enforced: boolean;
    end_to_end_encryption: boolean;
  };
}

interface ZeroKnowledgeIndicatorProps {
  className?: string;
  showDetails?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

// ==================================================
// ZERO-KNOWLEDGE INDICATOR COMPONENT
// ==================================================

/**
 * ZeroKnowledgeIndicator Component
 * 
 * Features:
 * 1. Hiển thị trạng thái Zero-Knowledge compliance
 * 2. Auto-refresh status
 * 3. Hiển thị violations nếu có
 * 4. Tooltip với chi tiết
 */
const ZeroKnowledgeIndicator: React.FC<ZeroKnowledgeIndicatorProps> = ({
  className = '',
  showDetails = false,
  autoRefresh = true,
  refreshInterval = 30000 // 30 seconds
}) => {
  // ==================================================
  // STATE MANAGEMENT
  // ==================================================

  const [status, setStatus] = useState<ZeroKnowledgeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  // ==================================================
  // EFFECTS
  // ==================================================

  useEffect(() => {
    fetchZeroKnowledgeStatus();

    if (autoRefresh) {
      const interval = setInterval(fetchZeroKnowledgeStatus, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  // ==================================================
  // METHODS
  // ==================================================

  const fetchZeroKnowledgeStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      // Trong thực tế sẽ gọi API
      // const response = await api.get('/zero-knowledge/status');
      // setStatus(response.data);

      // Mock data cho demo
      const mockStatus: ZeroKnowledgeStatus = {
        zero_knowledge_enabled: true,
        compliance_status: 'compliant',
        total_violations: 0,
        principles: [
          {
            name: 'no_original_data',
            description: 'Server never sees original file content',
            status: 'enforced'
          },
          {
            name: 'no_private_keys',
            description: 'Server never stores or processes private keys',
            status: 'enforced'
          },
          {
            name: 'no_plaintext_passwords',
            description: 'Server never receives plaintext passwords',
            status: 'enforced'
          },
          {
            name: 'client_side_encryption',
            description: 'All encryption happens on client side',
            status: 'enforced'
          },
          {
            name: 'server_blind_storage',
            description: 'Server stores encrypted data without knowledge of content',
            status: 'enforced'
          },
          {
            name: 'end_to_end_encryption',
            description: 'End-to-end encryption from client to storage',
            status: 'enforced'
          }
        ],
        recent_violations: [],
        system_info: {
          server_never_sees_original_data: true,
          server_never_sees_private_keys: true,
          server_never_sees_plaintext_passwords: true,
          client_side_encryption_enforced: true,
          end_to_end_encryption: true
        }
      };

      setStatus(mockStatus);

    } catch (err) {
      console.error('Error fetching Zero-Knowledge status:', err);
      setError('Failed to fetch Zero-Knowledge status');
      toast.error('Failed to fetch Zero-Knowledge status');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = () => {
    if (loading) {
      return <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />;
    }

    if (error) {
      return <XCircleIcon className="w-4 h-4 text-red-500" />;
    }

    if (!status) {
      return <InformationCircleIcon className="w-4 h-4 text-gray-400" />;
    }

    if (status.compliance_status === 'compliant') {
      return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
    } else {
      return <ExclamationTriangleIcon className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusText = () => {
    if (loading) return 'Checking...';
    if (error) return 'Error';
    if (!status) return 'Unknown';
    
    return status.compliance_status === 'compliant' 
      ? 'Zero-Knowledge Compliant' 
      : 'Violations Detected';
  };

  const getStatusColor = () => {
    if (loading || error || !status) return 'text-secondary-500 dark:text-secondary-400';

    return status.compliance_status === 'compliant'
      ? 'text-success-600 dark:text-success-400'
      : 'text-warning-600 dark:text-warning-400';
  };

  const getBackgroundColor = () => {
    if (loading || error || !status) return 'bg-secondary-50 dark:bg-secondary-800';

    return status.compliance_status === 'compliant'
      ? 'bg-success-50 dark:bg-success-900/20'
      : 'bg-warning-50 dark:bg-warning-900/20';
  };

  const getBorderColor = () => {
    if (loading || error || !status) return 'border-secondary-200 dark:border-secondary-700';

    return status.compliance_status === 'compliant'
      ? 'border-success-200 dark:border-success-800'
      : 'border-warning-200 dark:border-warning-800';
  };

  // ==================================================
  // RENDER
  // ==================================================

  if (!showDetails) {
    return (
      <div 
        className={clsx(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium cursor-pointer transition-all duration-200',
          getBackgroundColor(),
          getBorderColor(),
          getStatusColor(),
          className
        )}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <ShieldCheckIcon className="w-4 h-4" />
        {getStatusIcon()}
        <span>{getStatusText()}</span>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-50 whitespace-nowrap">
            <div className="flex items-center gap-2">
              <ShieldCheckIcon className="w-3 h-3" />
              Zero-Knowledge Security
            </div>
            <div className="mt-1 text-gray-300">
              {status?.compliance_status === 'compliant' 
                ? 'All security principles enforced'
                : `${status?.total_violations || 0} violations detected`
              }
            </div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-secondary-900 dark:text-white flex items-center gap-2">
          <ShieldCheckIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          Zero-Knowledge Security Status
        </h3>

        <button
          onClick={fetchZeroKnowledgeStatus}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors duration-200"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Status Card */}
      <div className={clsx(
        'p-4 rounded-lg border',
        getBackgroundColor(),
        getBorderColor()
      )}>
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <h4 className={clsx('font-medium', getStatusColor())}>
              {getStatusText()}
            </h4>
            {status && (
              <p className="text-sm text-gray-600 mt-1">
                {status.total_violations} violations • {status.principles.length} principles enforced
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Principles List */}
      {status && (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Security Principles</h4>
          <div className="grid gap-3">
            {status.principles.map((principle, index) => (
              <div 
                key={index}
                className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200"
              >
                <CheckCircleIcon className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h5 className="font-medium text-gray-900 capitalize">
                    {principle.name.replace(/_/g, ' ')}
                  </h5>
                  <p className="text-sm text-gray-600 mt-1">
                    {principle.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System Info */}
      {status && (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">System Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(status.system_info).map(([key, value]) => (
              <div 
                key={key}
                className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200"
              >
                {value ? (
                  <CheckCircleIcon className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircleIcon className="w-4 h-4 text-red-500" />
                )}
                <span className="text-sm text-gray-700 capitalize">
                  {key.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Violations */}
      {status && status.recent_violations.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Recent Violations</h4>
          <div className="space-y-2">
            {status.recent_violations.map((violation, index) => (
              <div 
                key={index}
                className="p-3 bg-red-50 border border-red-200 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium text-red-800">
                    {violation.operation}
                  </span>
                </div>
                <p className="text-sm text-red-600 mt-1">
                  {violation.timestamp}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <XCircleIcon className="w-5 h-5 text-red-500" />
            <span className="font-medium text-red-800">Error</span>
          </div>
          <p className="text-sm text-red-600 mt-1">{error}</p>
        </div>
      )}
    </div>
  );
};

export default ZeroKnowledgeIndicator; 
