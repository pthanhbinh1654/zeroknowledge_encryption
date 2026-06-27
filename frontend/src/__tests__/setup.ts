/**
 * Vitest Setup File
 * =================
 * Thiết lập môi trường test cho các test cases mã hóa
 */

import { vi } from 'vitest';

// Mock Web Crypto API cho Node.js environment
Object.defineProperty(globalThis, 'crypto', {
  value: {
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    subtle: {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
      generateKey: vi.fn(),
      importKey: vi.fn(),
      exportKey: vi.fn(),
      sign: vi.fn(),
      verify: vi.fn(),
      digest: vi.fn(),
      deriveBits: vi.fn(),
      deriveKey: vi.fn(),
    }
  }
});

// Mock File API
global.File = class MockFile {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  webkitRelativePath?: string;
  
  constructor(bits: BlobPart[], filename: string, options?: FilePropertyBag) {
    this.name = filename;
    this.type = options?.type || '';
    this.lastModified = options?.lastModified || Date.now();
    
    // Calculate size
    this.size = bits.reduce((total, bit) => {
      if (typeof bit === 'string') {
        return total + new TextEncoder().encode(bit).length;
      } else if (bit instanceof ArrayBuffer) {
        return total + bit.byteLength;
      } else if (bit instanceof Uint8Array) {
        return total + bit.length;
      }
      return total;
    }, 0);
  }
  
  async arrayBuffer(): Promise<ArrayBuffer> {
    // Mock implementation
    const buffer = new ArrayBuffer(this.size);
    const view = new Uint8Array(buffer);
    
    // Fill with mock data based on filename
    for (let i = 0; i < this.size; i++) {
      view[i] = (this.name.charCodeAt(i % this.name.length) + i) % 256;
    }
    
    return buffer;
  }
  
  async text(): Promise<string> {
    const buffer = await this.arrayBuffer();
    return new TextDecoder().decode(buffer);
  }
  
  stream(): ReadableStream {
    throw new Error('Stream not implemented in mock');
  }
  
  slice(start?: number, end?: number, contentType?: string): Blob {
    throw new Error('Slice not implemented in mock');
  }
} as any;

// Mock Blob API
global.Blob = class MockBlob {
  size: number;
  type: string;
  
  constructor(blobParts?: BlobPart[], options?: BlobPropertyBag) {
    this.type = options?.type || '';
    this.size = blobParts?.reduce((total, part) => {
      if (typeof part === 'string') {
        return total + new TextEncoder().encode(part).length;
      } else if (part instanceof ArrayBuffer) {
        return total + part.byteLength;
      } else if (part instanceof Uint8Array) {
        return total + part.length;
      }
      return total;
    }, 0) || 0;
  }
  
  async arrayBuffer(): Promise<ArrayBuffer> {
    const buffer = new ArrayBuffer(this.size);
    return buffer;
  }
  
  async text(): Promise<string> {
    const buffer = await this.arrayBuffer();
    return new TextDecoder().decode(buffer);
  }
  
  stream(): ReadableStream {
    throw new Error('Stream not implemented in mock');
  }
  
  slice(start?: number, end?: number, contentType?: string): Blob {
    throw new Error('Slice not implemented in mock');
  }
} as any;

// Mock performance API
if (!globalThis.performance) {
  globalThis.performance = {
    now: () => Date.now(),
    mark: vi.fn(),
    measure: vi.fn(),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
    getEntries: vi.fn(() => []),
    getEntriesByName: vi.fn(() => []),
    getEntriesByType: vi.fn(() => []),
  } as any;
}

// Mock TextEncoder/TextDecoder if not available
if (!globalThis.TextEncoder) {
  globalThis.TextEncoder = class {
    encode(input: string): Uint8Array {
      const bytes = [];
      for (let i = 0; i < input.length; i++) {
        const code = input.charCodeAt(i);
        if (code < 0x80) {
          bytes.push(code);
        } else if (code < 0x800) {
          bytes.push(0xc0 | (code >> 6));
          bytes.push(0x80 | (code & 0x3f));
        } else {
          bytes.push(0xe0 | (code >> 12));
          bytes.push(0x80 | ((code >> 6) & 0x3f));
          bytes.push(0x80 | (code & 0x3f));
        }
      }
      return new Uint8Array(bytes);
    }
  } as any;
}

if (!globalThis.TextDecoder) {
  globalThis.TextDecoder = class {
    decode(input: Uint8Array): string {
      let result = '';
      for (let i = 0; i < input.length; i++) {
        result += String.fromCharCode(input[i]);
      }
      return result;
    }
  } as any;
}

// Console setup for better test output
console.log('🔧 Test environment setup completed');
console.log('📦 Mocked APIs: File, Blob, Crypto, Performance, TextEncoder/Decoder');
