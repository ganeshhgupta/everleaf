// PDFStorageService.js - IndexedDB service for storing and retrieving PDFs
class PDFStorageService {
  constructor() {
    this.dbName = 'PDFStorage';
    this.dbVersion = 1;
    this.storeName = 'pdfs';
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          
          // Create indexes for querying
          store.createIndex('projectId', 'projectId', { unique: false });
          store.createIndex('filename', 'filename', { unique: false });
          store.createIndex('uploadDate', 'uploadDate', { unique: false });
        }
      };
    });
  }

  async storePDF(documentId, projectId, filename, pdfBlob, metadata = {}) {
    try {
      await this.init();
      
      const pdfData = {
        id: documentId,
        projectId: projectId,
        filename: filename,
        blob: pdfBlob,
        size: pdfBlob.size,
        type: pdfBlob.type,
        uploadDate: new Date().toISOString(),
        metadata: metadata
      };

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      await new Promise((resolve, reject) => {
        const request = store.put(pdfData);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      console.log(`✅ PDF stored in IndexedDB: ${filename} (${pdfBlob.size} bytes)`);
      return true;
    } catch (error) {
      console.error('❌ Failed to store PDF:', error);
      return false;
    }
  }

  async getPDF(documentId) {
    try {
      await this.init();
      
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      const pdfData = await new Promise((resolve, reject) => {
        const request = store.get(documentId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (pdfData) {
        console.log(`📄 Retrieved PDF from IndexedDB: ${pdfData.filename}`);
        return pdfData;
      } else {
        console.warn(`⚠️ PDF not found in IndexedDB: ${documentId}`);
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to retrieve PDF:', error);
      return null;
    }
  }

  async getAllPDFs(projectId = null) {
    try {
      await this.init();
      
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      let request;
      if (projectId) {
        const index = store.index('projectId');
        request = index.getAll(projectId);
      } else {
        request = store.getAll();
      }
      
      const pdfs = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      console.log(`📚 Retrieved ${pdfs.length} PDFs from IndexedDB`);
      return pdfs;
    } catch (error) {
      console.error('❌ Failed to retrieve PDFs:', error);
      return [];
    }
  }

  async deletePDF(documentId) {
    try {
      await this.init();
      
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      await new Promise((resolve, reject) => {
        const request = store.delete(documentId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      console.log(`🗑️ PDF deleted from IndexedDB: ${documentId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to delete PDF:', error);
      return false;
    }
  }

  async getStorageInfo() {
    try {
      await this.init();
      
      const pdfs = await this.getAllPDFs();
      const totalSize = pdfs.reduce((sum, pdf) => sum + (pdf.size || 0), 0);
      
      return {
        count: pdfs.length,
        totalSize: totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
      };
    } catch (error) {
      console.error('❌ Failed to get storage info:', error);
      return { count: 0, totalSize: 0, totalSizeMB: '0.00' };
    }
  }

  async clearAllPDFs() {
    try {
      await this.init();
      
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      await new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      console.log('🧹 All PDFs cleared from IndexedDB');
      return true;
    } catch (error) {
      console.error('❌ Failed to clear PDFs:', error);
      return false;
    }
  }

  // Create a blob URL for viewing
  createBlobURL(pdfData) {
    if (pdfData && pdfData.blob) {
      return URL.createObjectURL(pdfData.blob);
    }
    return null;
  }

  // Clean up blob URLs
  revokeBlobURL(url) {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }

  // Check if IndexedDB is supported
  static isSupported() {
    return 'indexedDB' in window;
  }

  // Get storage quota info (if supported)
  async getStorageQuota() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          quota: estimate.quota,
          usage: estimate.usage,
          quotaMB: (estimate.quota / (1024 * 1024)).toFixed(2),
          usageMB: (estimate.usage / (1024 * 1024)).toFixed(2),
          percentUsed: ((estimate.usage / estimate.quota) * 100).toFixed(1)
        };
      } catch (error) {
        console.error('Failed to get storage quota:', error);
        return null;
      }
    }
    return null;
  }
}

// Create singleton instance
const pdfStorageService = new PDFStorageService();

export default pdfStorageService;