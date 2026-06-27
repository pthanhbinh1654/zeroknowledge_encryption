import React, { useState } from 'react';
import { 
  InformationCircleIcon,
  ShieldCheckIcon,
  CpuChipIcon,
  ClockIcon,
  CheckCircleIcon,
  //ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
// Removed crypto.service import - using direct types
import clsx from 'clsx';

interface Props {
  selectedAlgorithm: string;
  onAlgorithmChange: (algorithm: string) => void;
  className?: string;
}

const EncryptionAlgorithmSelector: React.FC<Props> = ({
  selectedAlgorithm,
  onAlgorithmChange,
  className
}) => {
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  // Define algorithms directly instead of using CryptoService
  const algorithms = [
    {
      name: 'AES-256-GCM',
      display_name: 'AES-256-GCM',
      description: 'Advanced Encryption Standard với Galois/Counter Mode',
      security_level: 'very_high' as const,
      performance: 'high' as const,
      key_size: 256,
      features: ['Authenticated encryption', 'Hardware acceleration', 'NIST approved'],
      use_cases: ['General purpose', 'High performance', 'Government use']
    },
    {
      name: 'XChaCha20-Poly1305',
      display_name: 'XChaCha20-Poly1305',
      description: 'ChaCha20 stream cipher với Poly1305 authenticator',
      security_level: 'very_high' as const,
      performance: 'very_high' as const,
      key_size: 256,
      features: ['Authenticated encryption', 'Resistant to timing attacks', 'Modern design'],
      use_cases: ['Mobile devices', 'IoT', 'High security']
    },
    {
      name: 'Camellia-CTR-HMAC',
      display_name: 'Camellia-CTR+HMAC',
      description: 'Camellia cipher trong Counter mode với HMAC',
      security_level: 'high' as const,
      performance: 'medium' as const,
      key_size: 256,
      features: ['International standard', 'Strong security', 'Lightweight'],
      use_cases: ['International compliance', 'Embedded systems', 'Legacy support']
    }
  ];

  const selectedAlg = algorithms.find(alg => alg.name === selectedAlgorithm);

  const getSecurityColor = (level: 'very_high' | 'high' | 'medium' | 'low') => {
    switch (level) {
      case 'very_high': return 'text-green-600 dark:text-green-400';
      case 'high': return 'text-blue-600 dark:text-blue-400';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      default: return 'text-secondary-600 dark:text-secondary-400';
    }
  };

  const getPerformanceColor = (performance: 'very_high' | 'high' | 'medium' | 'low') => {
    switch (performance) {
      case 'very_high': return 'text-green-600 dark:text-green-400';
      case 'high': return 'text-blue-600 dark:text-blue-400';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'low': return 'text-red-600 dark:text-red-400';
    }
  };

  const renderAlgorithmCard = (algorithm: any) => {
    const isSelected = selectedAlgorithm === algorithm.name;
    // All algorithms are supported in modern browsers
    const support = { supported: true, reason: 'Supported in modern browsers' };

    return (
      <div
        key={algorithm.name}
        className={clsx(
          'border rounded-lg p-4 cursor-pointer transition-all duration-200 min-w-[220px]',
          isSelected 
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
            : 'border-secondary-200 dark:border-secondary-700 hover:border-secondary-300 dark:hover:border-secondary-600'
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onAlgorithmChange(algorithm.name);
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-secondary-900 dark:text-white">
                {algorithm.name}
              </h3>
              {isSelected && (
                <CheckCircleIcon className="h-5 w-5 text-primary-500" />
              )}
            </div>
            
            <p className="text-sm text-secondary-600 dark:text-secondary-400 mt-1">
              {algorithm.description}
            </p>

            <div className="flex items-center space-x-4 mt-3">
              <div className="flex items-center space-x-1">
                <ShieldCheckIcon className="h-4 w-4 text-secondary-400" />
                <span className={clsx('text-xs font-medium', getSecurityColor(algorithm.security_level))}>
                  {algorithm.security_level === 'very_high' ? 'Rất cao' : 
                   algorithm.security_level === 'high' ? 'Cao' : 'Trung bình'}
                </span>
              </div>
              
              <div className="flex items-center space-x-1">
                <ClockIcon className="h-4 w-4 text-secondary-400" />
                <span className={clsx('text-xs font-medium', getPerformanceColor(algorithm.performance))}>
                  {algorithm.performance === 'excellent' ? 'Xuất sắc' :
                   algorithm.performance === 'good' ? 'Tốt' :
                   algorithm.performance === 'fair' ? 'Khá' : 'Chậm'}
                </span>
              </div>

              <div className="flex items-center space-x-1">
                <CpuChipIcon className="h-4 w-4 text-secondary-400" />
                <span className="text-xs text-secondary-600 dark:text-secondary-400">
                  {algorithm.key_size} bit
                </span>
              </div>
            </div>

            {/* Support Status */}
            <div className="flex items-center space-x-2 mt-2">
              {support.supported ? (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                  Native Support
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
                  Library Required
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowDetails(showDetails === algorithm.name ? null : algorithm.name);
            }}
            className="p-1 text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-300"
          >
            <InformationCircleIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Detailed Information */}
        {showDetails === algorithm.name && (
          <div className="mt-4 pt-4 border-t border-secondary-200 dark:border-secondary-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pros */}
              <div>
                <h4 className="font-medium text-green-600 dark:text-green-400 mb-2">
                  ✅ Ưu điểm:
                </h4>
                <ul className="text-sm space-y-1">
                  {algorithm.pros.map((pro, index) => (
                    <li key={index} className="text-secondary-600 dark:text-secondary-400">
                      • {pro}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Cons */}
              <div>
                <h4 className="font-medium text-orange-600 dark:text-orange-400 mb-2">
                  ⚠️ Nhược điểm:
                </h4>
                <ul className="text-sm space-y-1">
                  {algorithm.cons.map((con, index) => (
                    <li key={index} className="text-secondary-600 dark:text-secondary-400">
                      • {con}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Use Cases */}
            <div className="mt-4">
              <h4 className="font-medium text-secondary-900 dark:text-white mb-2">
                🎯 Ứng dụng phù hợp:
              </h4>
              <div className="flex flex-wrap gap-2">
                {algorithm.use_cases.map((useCase, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-secondary-100 text-secondary-700 dark:bg-secondary-700 dark:text-secondary-300"
                  >
                    {useCase.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>

            {/* Features */}
            <div className="mt-4">
              <h4 className="font-medium text-secondary-900 dark:text-white mb-2">
                🔧 Tính năng:
              </h4>
              <div className="flex flex-wrap gap-2">
                {algorithm.features.map((feature, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300"
                  >
                    {feature.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>

            {/* Support Info */}
            <div className="mt-4">
              <h4 className="font-medium text-secondary-900 dark:text-white mb-2">
                💻 Hỗ trợ platform:
              </h4>
              <ul className="text-sm space-y-1">
                {[support.reason].map((note, index) => (
                  <li key={index} className="text-secondary-600 dark:text-secondary-400">
                    • {note}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">
          Chọn thuật toán mã hóa
        </h3>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowComparison(!showComparison);
          }}
          className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
        >
          {showComparison ? 'Ẩn so sánh' : 'So sánh thuật toán'}
        </button>
      </div>

      {/* Algorithm Recommendations */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
        <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
          💡 Khuyến nghị:
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <li>• <strong>AES-256-GCM</strong>: Tốt nhất cho compatibility và performance</li>
          <li>• <strong>XChaCha20-Poly1305</strong>: Tốt nhất cho modern security và mobile</li>
          <li>• <strong>Serpent-256-GCM</strong>: Tốt nhất cho maximum security</li>
        </ul>
      </div>

      {/* Algorithm Cards Horizontal */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {algorithms.map(renderAlgorithmCard)}
      </div>

      {/* Comparison Tool */}
      {showComparison && selectedAlg && (
        <div className="mt-6 bg-secondary-50 dark:bg-secondary-800 rounded-lg p-6">
          <h4 className="font-semibold text-secondary-900 dark:text-white mb-4">
            🔍 So sánh với {selectedAlg.name}:
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {algorithms
              .filter(alg => alg.name !== selectedAlgorithm)
              .slice(0, 2)
              .map(compareAlg => {
                // Simple comparison logic
                const getRecommendation = (alg1: string, alg2: string) => {
                  if (alg1 === 'XChaCha20-Poly1305') return `${alg1} có hiệu suất tốt hơn trên mobile`;
                  if (alg1 === 'AES-256-GCM') return `${alg1} có hỗ trợ phần cứng tốt hơn`;
                  return `${alg1} và ${alg2} đều có độ bảo mật cao`;
                };

                return (
                  <div key={compareAlg.name} className="bg-white dark:bg-secondary-700 rounded-lg p-4">
                    <h5 className="font-medium text-secondary-900 dark:text-white mb-2">
                      vs {compareAlg.name}
                    </h5>
                    <p className="text-sm text-secondary-600 dark:text-secondary-400">
                      {getRecommendation(selectedAlgorithm, compareAlg.name)}
                    </p>
                    <div className="flex items-center space-x-4 mt-2">
                      <span className={clsx(
                        'text-xs px-2 py-1 rounded',
                        'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
                      )}>
                        Security: Tương đương
                      </span>
                      <span className={clsx(
                        'text-xs px-2 py-1 rounded',
                        'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
                      )}>
                        Performance: Tương đương
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Selected Algorithm Summary */}
      {selectedAlg && (
        <div className="mt-6 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
          <h4 className="font-medium text-primary-900 dark:text-primary-200 mb-2">
            ✅ Đã chọn: {selectedAlg.name}
          </h4>
          <p className="text-sm text-primary-800 dark:text-primary-300">
            {selectedAlg.description}
          </p>
          <div className="flex items-center space-x-4 mt-2">
            <span className="text-xs text-primary-700 dark:text-primary-400">
              Bảo mật: <strong>{selectedAlg.security_level === 'very_high' ? 'Rất cao' : 'Cao'}</strong>
            </span>
            <span className="text-xs text-primary-700 dark:text-primary-400">
              Hiệu suất: <strong>{selectedAlg.performance === 'very_high' ? 'Rất cao' : selectedAlg.performance === 'high' ? 'Cao' : 'Trung bình'}</strong>
            </span>
            <span className="text-xs text-primary-700 dark:text-primary-400">
              Key: <strong>{selectedAlg.key_size} bit</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default EncryptionAlgorithmSelector; 
