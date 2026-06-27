"""
Performance Optimization Utilities
==================================
Backend utilities for performance monitoring, caching, and optimization.
"""

import time
import asyncio
import functools
import logging
from typing import Any, Callable, Dict, Optional, Union
from datetime import datetime, timedelta
import hashlib
import json
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

# ==================================================
# PERFORMANCE MONITORING
# ==================================================

class PerformanceMonitor:
    """Monitor and track performance metrics"""
    
    def __init__(self):
        self.metrics: Dict[str, list] = {}
        self.active_timers: Dict[str, float] = {}
    
    def start_timer(self, name: str) -> None:
        """Start a performance timer"""
        self.active_timers[name] = time.perf_counter()
    
    def end_timer(self, name: str) -> Optional[float]:
        """End a performance timer and record the duration"""
        if name not in self.active_timers:
            logger.warning(f"Timer '{name}' not found")
            return None
        
        duration = time.perf_counter() - self.active_timers[name]
        del self.active_timers[name]
        
        if name not in self.metrics:
            self.metrics[name] = []
        
        self.metrics[name].append({
            'duration': duration,
            'timestamp': datetime.utcnow()
        })
        
        # Keep only last 100 measurements
        if len(self.metrics[name]) > 100:
            self.metrics[name] = self.metrics[name][-100:]
        
        return duration
    
    @asynccontextmanager
    async def timer(self, name: str):
        """Context manager for timing operations"""
        self.start_timer(name)
        try:
            yield
        finally:
            duration = self.end_timer(name)
            if duration and duration > 1.0:  # Log slow operations
                logger.warning(f"Slow operation '{name}': {duration:.3f}s")
    
    def get_stats(self, name: str) -> Dict[str, Any]:
        """Get statistics for a metric"""
        if name not in self.metrics:
            return {}
        
        durations = [m['duration'] for m in self.metrics[name]]
        
        return {
            'count': len(durations),
            'avg': sum(durations) / len(durations),
            'min': min(durations),
            'max': max(durations),
            'recent': durations[-10:] if len(durations) >= 10 else durations
        }
    
    def get_all_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get statistics for all metrics"""
        return {name: self.get_stats(name) for name in self.metrics.keys()}

# Global performance monitor
performance_monitor = PerformanceMonitor()

# ==================================================
# CACHING UTILITIES
# ==================================================

class AsyncLRUCache:
    """Async LRU Cache implementation"""
    
    def __init__(self, maxsize: int = 128, ttl: int = 300):
        self.maxsize = maxsize
        self.ttl = ttl
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.access_order: list = []
    
    def _make_key(self, *args, **kwargs) -> str:
        """Create cache key from arguments"""
        key_data = {
            'args': args,
            'kwargs': sorted(kwargs.items())
        }
        key_str = json.dumps(key_data, sort_keys=True, default=str)
        return hashlib.md5(key_str.encode()).hexdigest()
    
    def _is_expired(self, item: Dict[str, Any]) -> bool:
        """Check if cache item is expired"""
        return time.time() - item['timestamp'] > self.ttl
    
    def _evict_expired(self) -> None:
        """Remove expired items from cache"""
        current_time = time.time()
        expired_keys = [
            key for key, item in self.cache.items()
            if current_time - item['timestamp'] > self.ttl
        ]
        
        for key in expired_keys:
            del self.cache[key]
            if key in self.access_order:
                self.access_order.remove(key)
    
    def _evict_lru(self) -> None:
        """Remove least recently used item"""
        if self.access_order:
            lru_key = self.access_order.pop(0)
            if lru_key in self.cache:
                del self.cache[lru_key]
    
    async def get(self, key: str) -> Any:
        """Get item from cache"""
        if key not in self.cache:
            return None
        
        item = self.cache[key]
        
        if self._is_expired(item):
            del self.cache[key]
            if key in self.access_order:
                self.access_order.remove(key)
            return None
        
        # Update access order
        if key in self.access_order:
            self.access_order.remove(key)
        self.access_order.append(key)
        
        return item['value']
    
    async def set(self, key: str, value: Any) -> None:
        """Set item in cache"""
        # Clean up expired items
        self._evict_expired()
        
        # Evict LRU if at capacity
        while len(self.cache) >= self.maxsize:
            self._evict_lru()
        
        self.cache[key] = {
            'value': value,
            'timestamp': time.time()
        }
        
        # Update access order
        if key in self.access_order:
            self.access_order.remove(key)
        self.access_order.append(key)
    
    async def delete(self, key: str) -> bool:
        """Delete item from cache"""
        if key in self.cache:
            del self.cache[key]
            if key in self.access_order:
                self.access_order.remove(key)
            return True
        return False
    
    async def clear(self) -> None:
        """Clear all cache items"""
        self.cache.clear()
        self.access_order.clear()
    
    def size(self) -> int:
        """Get current cache size"""
        return len(self.cache)

# Global cache instance
global_cache = AsyncLRUCache(maxsize=256, ttl=600)

# ==================================================
# DECORATORS
# ==================================================

def async_timed(func: Callable) -> Callable:
    """Decorator to time async function execution"""
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = time.perf_counter()
        try:
            result = await func(*args, **kwargs)
            return result
        finally:
            duration = time.perf_counter() - start_time
            logger.info(f"{func.__name__} took {duration:.3f}s")
            
            # Record in performance monitor
            performance_monitor.metrics.setdefault(func.__name__, []).append({
                'duration': duration,
                'timestamp': datetime.utcnow()
            })
    
    return wrapper

def cached(ttl: int = 300, maxsize: int = 128):
    """Decorator for caching function results"""
    def decorator(func: Callable) -> Callable:
        cache = AsyncLRUCache(maxsize=maxsize, ttl=ttl)
        
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Create cache key
            key = cache._make_key(*args, **kwargs)
            
            # Try to get from cache
            cached_result = await cache.get(key)
            if cached_result is not None:
                return cached_result
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            await cache.set(key, result)
            
            return result
        
        # Add cache management methods
        wrapper.cache_clear = cache.clear
        wrapper.cache_size = cache.size
        
        return wrapper
    
    return decorator

def rate_limited(calls: int, period: int):
    """Decorator for rate limiting function calls"""
    def decorator(func: Callable) -> Callable:
        call_times: list = []
        
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            now = time.time()
            
            # Remove old calls outside the period
            call_times[:] = [t for t in call_times if now - t < period]
            
            # Check if rate limit exceeded
            if len(call_times) >= calls:
                raise Exception(f"Rate limit exceeded: {calls} calls per {period} seconds")
            
            # Record this call
            call_times.append(now)
            
            return await func(*args, **kwargs)
        
        return wrapper
    
    return decorator

# ==================================================
# DATABASE OPTIMIZATION
# ==================================================

class DatabaseOptimizer:
    """Database query optimization utilities"""
    
    @staticmethod
    def build_index_hint(collection_name: str, query: Dict[str, Any]) -> Dict[str, Any]:
        """Suggest optimal indexes for a query"""
        hints = {}
        
        # Equality queries should be indexed
        for field, value in query.items():
            if not field.startswith('$') and not isinstance(value, dict):
                hints[field] = 1
        
        # Range queries
        for field, value in query.items():
            if isinstance(value, dict):
                if any(op in value for op in ['$gte', '$lte', '$gt', '$lt']):
                    hints[field] = 1
        
        return hints
    
    @staticmethod
    def optimize_aggregation_pipeline(pipeline: list) -> list:
        """Optimize MongoDB aggregation pipeline"""
        optimized = []
        
        for stage in pipeline:
            # Move $match stages as early as possible
            if '$match' in stage:
                optimized.insert(0, stage)
            # Combine consecutive $project stages
            elif '$project' in stage and optimized and '$project' in optimized[-1]:
                optimized[-1]['$project'].update(stage['$project'])
            else:
                optimized.append(stage)
        
        return optimized

# ==================================================
# MEMORY OPTIMIZATION
# ==================================================

class MemoryOptimizer:
    """Memory usage optimization utilities"""
    
    @staticmethod
    def chunk_large_data(data: list, chunk_size: int = 1000):
        """Process large datasets in chunks"""
        for i in range(0, len(data), chunk_size):
            yield data[i:i + chunk_size]
    
    @staticmethod
    async def process_in_batches(items: list, processor: Callable, batch_size: int = 100):
        """Process items in batches to manage memory"""
        results = []
        
        for batch in MemoryOptimizer.chunk_large_data(items, batch_size):
            batch_results = await asyncio.gather(*[processor(item) for item in batch])
            results.extend(batch_results)
            
            # Allow other tasks to run
            await asyncio.sleep(0)
        
        return results

# ==================================================
# FILE PROCESSING OPTIMIZATION
# ==================================================

class FileProcessor:
    """Optimized file processing utilities"""
    
    @staticmethod
    async def stream_file_chunks(file_path: str, chunk_size: int = 8192):
        """Stream file in chunks for memory efficiency"""
        try:
            with open(file_path, 'rb') as file:
                while True:
                    chunk = file.read(chunk_size)
                    if not chunk:
                        break
                    yield chunk
                    await asyncio.sleep(0)  # Allow other tasks to run
        except Exception as e:
            logger.error(f"Error streaming file {file_path}: {e}")
            raise
    
    @staticmethod
    async def parallel_file_processing(file_paths: list, processor: Callable, max_concurrent: int = 5):
        """Process multiple files concurrently with limit"""
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def process_with_semaphore(file_path: str):
            async with semaphore:
                return await processor(file_path)
        
        tasks = [process_with_semaphore(path) for path in file_paths]
        return await asyncio.gather(*tasks, return_exceptions=True)

# ==================================================
# API OPTIMIZATION
# ==================================================

class APIOptimizer:
    """API performance optimization utilities"""
    
    @staticmethod
    def compress_response(data: Any, compression_threshold: int = 1024) -> Union[str, bytes]:
        """Compress response data if it exceeds threshold"""
        import gzip
        
        json_data = json.dumps(data, default=str)
        
        if len(json_data) > compression_threshold:
            return gzip.compress(json_data.encode())
        
        return json_data
    
    @staticmethod
    def paginate_results(query_results: list, page: int, per_page: int) -> Dict[str, Any]:
        """Efficiently paginate query results"""
        total = len(query_results)
        start = (page - 1) * per_page
        end = start + per_page
        
        return {
            'items': query_results[start:end],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page,
                'has_next': end < total,
                'has_prev': page > 1
            }
        }

# ==================================================
# MONITORING UTILITIES
# ==================================================

def log_slow_queries(threshold: float = 1.0):
    """Decorator to log slow database queries"""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.perf_counter()
            result = await func(*args, **kwargs)
            duration = time.perf_counter() - start_time
            
            if duration > threshold:
                logger.warning(
                    f"Slow query detected in {func.__name__}: {duration:.3f}s"
                )
            
            return result
        
        return wrapper
    
    return decorator

def monitor_memory_usage(func: Callable) -> Callable:
    """Decorator to monitor memory usage of functions"""
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        memory_before = process.memory_info().rss
        
        result = await func(*args, **kwargs)
        
        memory_after = process.memory_info().rss
        memory_diff = memory_after - memory_before
        
        if memory_diff > 50 * 1024 * 1024:  # 50MB
            logger.warning(
                f"High memory usage in {func.__name__}: {memory_diff / 1024 / 1024:.2f}MB"
            )
        
        return result
    
    return wrapper

# ==================================================
# GLOBAL INSTANCES
# ==================================================

db_optimizer = DatabaseOptimizer()
memory_optimizer = MemoryOptimizer()
file_processor = FileProcessor()
api_optimizer = APIOptimizer()
