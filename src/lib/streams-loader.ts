interface LoadProgress {
  loaded: number;
  total: number;
}

interface CacheConfig {
  cacheName: string;
  ttl?: number;
}

interface ParallelLoadResult<T> {
  url: string;
  data?: T;
  error?: Error;
}

interface RetryConfig {
  retries: number;
  delay: number;
}

export class ProgressiveLoader {
  private abortControllers: Map<string, AbortController> = new Map();
  private cacheName: string;
  private cacheTTL: number;

  constructor(config: CacheConfig = { cacheName: 'marvel-nexus-cache', ttl: 3600000 }) {
    this.cacheName = config.cacheName;
    this.cacheTTL = config.ttl ?? 3600000;
  }

  async *loadChunks(url: string, chunkSize: number = 1024): AsyncGenerator<ArrayBuffer, void, unknown> {
    const abortController = new AbortController();
    this.abortControllers.set(url, abortController);

    try {
      const response = await fetch(url, { signal: abortController.signal });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('ReadableStream not supported');
      }

      let receivedLength = 0;
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
        
        if (receivedLength >= chunkSize) {
          const chunk = new Uint8Array(receivedLength);
          let position = 0;
          
          for (const chunkPart of chunks) {
            chunk.set(chunkPart, position);
            position += chunkPart.length;
          }
          
          yield chunk.buffer;
          
          chunks.length = 0;
          receivedLength = 0;
        }
      }

      if (receivedLength > 0) {
        const chunk = new Uint8Array(receivedLength);
        let position = 0;
        
        for (const chunkPart of chunks) {
          chunk.set(chunkPart, position);
          position += chunkPart.length;
        }
        
        yield chunk.buffer;
      }
    } finally {
      this.abortControllers.delete(url);
    }
  }

  async loadWithProgress(
    url: string, 
    onProgress?: (loaded: number, total: number) => void
  ): Promise<ArrayBuffer> {
    const abortController = new AbortController();
    this.abortControllers.set(url, abortController);

    try {
      const response = await fetch(url, { signal: abortController.signal });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('ReadableStream not supported');
      }

      const chunks: Uint8Array[] = [];
      let receivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
        
        if (onProgress) {
          onProgress(receivedLength, total);
        }
      }

      const result = new Uint8Array(receivedLength);
      let position = 0;
      
      for (const chunk of chunks) {
        result.set(chunk, position);
        position += chunk.length;
      }

      return result.buffer;
    } finally {
      this.abortControllers.delete(url);
    }
  }

  async loadParallel<T>(
    urls: string[], 
    concurrency: number = 5
  ): Promise<ParallelLoadResult<T>[]> {
    const results: ParallelLoadResult<T>[] = [];
    const executing: Set<Promise<void>> = new Set();

    for (const url of urls) {
      const task = this.loadSingle<T>(url).then(
        data => {
          results.push({ url, data });
        },
        error => {
          results.push({ url, error: error instanceof Error ? error : new Error(String(error)) });
        }
      );

      const wrappedTask = task.then(() => {
        executing.delete(wrappedTask);
      });

      executing.add(wrappedTask);

      if (executing.size >= concurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
    return results;
  }

  private async loadSingle<T>(url: string): Promise<T> {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json() as Promise<T>;
    }
    
    const text = await response.text();
    return text as unknown as T;
  }

  async loadWithRetry(
    url: string, 
    retries: number = 3
  ): Promise<Response> {
    const retryConfig: RetryConfig = {
      retries,
      delay: 1000
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryConfig.retries; attempt++) {
      try {
        const response = await fetch(url);
        
        if (response.ok) {
          return response;
        }
        
        lastError = new Error(`HTTP error! status: ${response.status}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      if (attempt < retryConfig.retries) {
        const delay = retryConfig.delay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError ?? new Error('Failed to load resource');
  }

  async preloadImages(urls: string[]): Promise<Map<string, HTMLImageElement>> {
    const imageMap = new Map<string, HTMLImageElement>();
    
    const preloadPromises = urls.map(url => 
      new Promise<void>((resolve, reject) => {
        const img = new Image();
        
        img.onload = () => {
          imageMap.set(url, img);
          resolve();
        };
        
        img.onerror = () => {
          reject(new Error(`Failed to load image: ${url}`));
        };
        
        img.src = url;
      })
    );

    await Promise.all(preloadPromises);
    return imageMap;
  }

  async streamJSON<T>(url: string): Promise<T> {
    const abortController = new AbortController();
    this.abortControllers.set(url, abortController);

    try {
      const response = await fetch(url, { signal: abortController.signal });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('ReadableStream not supported');
      }

      const decoder = new TextDecoder();
      let jsonString = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        
        for (const line of lines) {
          if (line.trim()) {
            jsonString += line;
          }
        }
      }

      if (buffer.trim()) {
        jsonString += buffer;
      }

      return JSON.parse(jsonString) as T;
    } finally {
      this.abortControllers.delete(url);
    }
  }

  async cacheFirst(url: string): Promise<Response> {
    try {
      const cache = await caches.open(this.cacheName);
      const cachedResponse = await cache.match(url);
      
      if (cachedResponse) {
        const dateHeader = cachedResponse.headers.get('date');
        if (dateHeader) {
          const cachedDate = new Date(dateHeader).getTime();
          const now = Date.now();
          
          if (now - cachedDate < this.cacheTTL) {
            return cachedResponse;
          }
        }
      }
    } catch (error) {
      console.warn('Cache lookup failed:', error);
    }

    const response = await fetch(url);
    
    if (response.ok) {
      try {
        const cache = await caches.open(this.cacheName);
        const responseClone = response.clone();
        await cache.put(url, responseClone);
      } catch (error) {
        console.warn('Failed to cache response:', error);
      }
    }

    return response;
  }

  async networkFirst(url: string): Promise<Response> {
    try {
      const response = await fetch(url);
      
      if (response.ok) {
        try {
          const cache = await caches.open(this.cacheName);
          const responseClone = response.clone();
          await cache.put(url, responseClone);
        } catch (error) {
          console.warn('Failed to cache response:', error);
        }
        
        return response;
      }
    } catch (error) {
      console.warn('Network request failed, trying cache:', error);
    }

    try {
      const cache = await caches.open(this.cacheName);
      const cachedResponse = await cache.match(url);
      
      if (cachedResponse) {
        return cachedResponse;
      }
    } catch (error) {
      console.warn('Cache lookup failed:', error);
    }

    throw new Error(`Failed to load ${url} from network or cache`);
  }

  cancelLoad(url: string): void {
    const abortController = this.abortControllers.get(url);
    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(url);
    }
  }

  cancelAllLoads(): void {
    this.abortControllers.forEach(controller => {
      controller.abort();
    });
    this.abortControllers.clear();
  }

  async clearCache(): Promise<void> {
    try {
      await caches.delete(this.cacheName);
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  async getCacheSize(): Promise<number> {
    try {
      const cache = await caches.open(this.cacheName);
      const keys = await cache.keys();
      return keys.length;
    } catch (error) {
      console.warn('Failed to get cache size:', error);
      return 0;
    }
  }
}
