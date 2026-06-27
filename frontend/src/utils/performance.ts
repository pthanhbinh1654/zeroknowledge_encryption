/**
 * Performance Optimization Utilities
 * ==================================
 * Utilities for optimizing frontend performance, caching, and resource management.
 */

// ==================================================
// LAZY LOADING UTILITIES
// ==================================================

/**
 * Lazy load components with error boundary
 */
export const lazyLoadComponent = (importFunc: () => Promise<any>) => {
  return React.lazy(() =>
    importFunc().catch(error => {
      console.error('Error loading component:', error);
      // Return a fallback component
      return { default: () => React.createElement('div', null, 'Error loading component') };
    })
  );
};

/**
 * Preload component for better UX
 */
export const preloadComponent = (importFunc: () => Promise<any>) => {
  const componentImport = importFunc();
  componentImport.catch(error => {
    console.error('Error preloading component:', error);
  });
  return componentImport;
};

// ==================================================
// MEMORY MANAGEMENT
// ==================================================

/**
 * Cleanup function for large objects
 */
export const cleanupLargeObjects = (...objects: any[]) => {
  objects.forEach(obj => {
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        delete obj[key];
      });
    }
  });
};

/**
 * Memory-efficient file chunking
 */
export const createFileChunks = (file: File, chunkSize: number = 1024 * 1024): Promise<Blob[]> => {
  return new Promise((resolve) => {
    const chunks: Blob[] = [];
    let offset = 0;
    
    const readChunk = () => {
      if (offset >= file.size) {
        resolve(chunks);
        return;
      }
      
      const chunk = file.slice(offset, offset + chunkSize);
      chunks.push(chunk);
      offset += chunkSize;
      
      // Use setTimeout to prevent blocking the main thread
      setTimeout(readChunk, 0);
    };
    
    readChunk();
  });
};

// ==================================================
// CACHING UTILITIES
// ==================================================

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MemoryCache<T> {
  private cache = new Map<string, CacheItem<T>>();
  private maxSize: number;
  
  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }
  
  set(key: string, data: T, ttl: number = 300000): void { // 5 minutes default
    // Remove expired items if cache is full
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
      
      // If still full, remove oldest item
      if (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    // Check if expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
  }
  
  size(): number {
    return this.cache.size;
  }
}

// Global cache instances
export const apiCache = new MemoryCache<any>(50);
export const fileCache = new MemoryCache<ArrayBuffer>(10);

// ==================================================
// DEBOUNCING AND THROTTLING
// ==================================================

/**
 * Debounce function calls
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: number;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => func(...args), delay);
  };
};

/**
 * Throttle function calls
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let lastCall = 0;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  };
};

// ==================================================
// PERFORMANCE MONITORING
// ==================================================

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics: number = 100;
  
  start(name: string): void {
    this.metrics.push({
      name,
      startTime: performance.now()
    });
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }
  
  end(name: string): number | null {
    const metric = this.metrics.find(m => m.name === name && !m.endTime);
    
    if (!metric) {
      console.warn(`Performance metric '${name}' not found or already ended`);
      return null;
    }
    
    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;
    
    return metric.duration;
  }
  
  getMetrics(): PerformanceMetric[] {
    return this.metrics.filter(m => m.duration !== undefined);
  }
  
  getAverageTime(name: string): number {
    const namedMetrics = this.metrics.filter(m => m.name === name && m.duration);
    
    if (namedMetrics.length === 0) {
      return 0;
    }
    
    const total = namedMetrics.reduce((sum, m) => sum + (m.duration || 0), 0);
    return total / namedMetrics.length;
  }
  
  clear(): void {
    this.metrics = [];
  }
}

export const performanceMonitor = new PerformanceMonitor();

// ==================================================
// RESOURCE OPTIMIZATION
// ==================================================

/**
 * Optimize image loading with lazy loading and compression
 */
export const optimizeImageLoading = (
  img: HTMLImageElement,
  src: string,
  options: {
    lazy?: boolean;
    quality?: number;
    placeholder?: string;
  } = {}
) => {
  const { lazy = true, placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB2aWV3Qm94PSIwIDAgMSAxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNGM0Y0RjYiLz48L3N2Zz4=' } = options;
  
  if (placeholder) {
    img.src = placeholder;
  }
  
  if (lazy && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          img.src = src;
          observer.unobserve(img);
        }
      });
    });
    
    observer.observe(img);
  } else {
    img.src = src;
  }
};

/**
 * Preload critical resources
 */
export const preloadCriticalResources = (resources: string[]) => {
  resources.forEach(resource => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = resource;
    
    // Determine resource type
    if (resource.endsWith('.css')) {
      link.as = 'style';
    } else if (resource.endsWith('.js')) {
      link.as = 'script';
    } else if (resource.match(/\.(woff|woff2|ttf|eot)$/)) {
      link.as = 'font';
      link.crossOrigin = 'anonymous';
    } else if (resource.match(/\.(jpg|jpeg|png|webp|svg)$/)) {
      link.as = 'image';
    }
    
    document.head.appendChild(link);
  });
};

// ==================================================
// BUNDLE OPTIMIZATION
// ==================================================

/**
 * Dynamic import with retry logic
 */
export const dynamicImportWithRetry = async (
  importFunc: () => Promise<any>,
  retries: number = 3
): Promise<any> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await importFunc();
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};

/**
 * Check if feature is supported before loading polyfill
 */
export const loadPolyfillIfNeeded = async (
  feature: string,
  polyfillLoader: () => Promise<any>
) => {
  // Check common features
  const featureChecks: Record<string, boolean> = {
    'IntersectionObserver': 'IntersectionObserver' in window,
    'ResizeObserver': 'ResizeObserver' in window,
    'fetch': 'fetch' in window,
    'Promise': 'Promise' in window,
    'WebCrypto': 'crypto' in window && 'subtle' in crypto,
  };
  
  if (!featureChecks[feature]) {
    await polyfillLoader();
  }
};

// ==================================================
// WORKER UTILITIES
// ==================================================

/**
 * Create and manage web workers for heavy computations
 */
export class WorkerManager {
  private workers: Map<string, Worker> = new Map();
  
  createWorker(name: string, script: string): Worker {
    if (this.workers.has(name)) {
      this.terminateWorker(name);
    }
    
    const worker = new Worker(script);
    this.workers.set(name, worker);
    
    return worker;
  }
  
  getWorker(name: string): Worker | undefined {
    return this.workers.get(name);
  }
  
  terminateWorker(name: string): void {
    const worker = this.workers.get(name);
    if (worker) {
      worker.terminate();
      this.workers.delete(name);
    }
  }
  
  terminateAll(): void {
    this.workers.forEach((worker, name) => {
      worker.terminate();
    });
    this.workers.clear();
  }
}

export const workerManager = new WorkerManager();

// ==================================================
// REACT PERFORMANCE HOOKS
// ==================================================

import React, { useCallback, useMemo, useRef, useEffect } from 'react';

/**
 * Memoized callback that only changes when dependencies change
 */
export const useStableCallback = <T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T => {
  return useCallback(callback, deps);
};

/**
 * Memoized value with deep comparison
 */
export const useDeepMemo = <T>(
  factory: () => T,
  deps: React.DependencyList
): T => {
  const ref = useRef<{ deps: React.DependencyList; value: T }>();
  
  if (!ref.current || !deepEqual(ref.current.deps, deps)) {
    ref.current = { deps, value: factory() };
  }
  
  return ref.current.value;
};

/**
 * Deep equality check for dependencies
 */
const deepEqual = (a: any, b: any): boolean => {
  if (a === b) return true;
  
  if (a == null || b == null) return false;
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key) || !deepEqual(a[key], b[key])) {
        return false;
      }
    }
    return true;
  }
  
  return false;
};

/**
 * Hook for tracking component render performance
 */
export const useRenderPerformance = (componentName: string) => {
  const renderStart = useRef<number>();
  
  useEffect(() => {
    renderStart.current = performance.now();
  });
  
  useEffect(() => {
    if (renderStart.current) {
      const renderTime = performance.now() - renderStart.current;
      if (renderTime > 16) { // More than one frame
        console.warn(`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`);
      }
    }
  });
};
