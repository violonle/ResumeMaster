class ResumeUploadHandler {
  constructor(config = {}) {
    this.config = {
      uploadEndpoint: config.uploadEndpoint || '/library/upload',
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024,
      supportedFormats: config.supportedFormats || ['pdf', 'doc', 'docx', 'txt'],
      onSuccess: config.onSuccess || null,
      onError: config.onError || null,
      onProgress: config.onProgress || null,
      apiRequest: config.apiRequest || null
    };
    
    this.selectedFiles = [];
    this.uploadQueue = [];
  }

  validateFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    if (!this.config.supportedFormats.includes(extension)) {
      throw new Error(`不支持的文件格式: ${extension}。支持的格式: ${this.config.supportedFormats.join(', ')}`);
    }
    
    if (file.size > this.config.maxFileSize) {
      throw new Error(`文件大小超过限制 (${this.config.maxFileSize / 1024 / 1024}MB)`);
    }
    
    return true;
  }

  async readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  async uploadFiles(files) {
    if (!Array.isArray(files)) {
      files = [files];
    }

    this.selectedFiles = [];
    
    for (const file of files) {
      try {
        this.validateFile(file);
        this.selectedFiles.push(file);
      } catch (error) {
        if (this.config.onError) {
          this.config.onError(error, file);
        }
        throw error;
      }
    }

    if (this.selectedFiles.length === 0) {
      throw new Error('没有有效的文件可上传');
    }

    const results = [];
    
    for (let i = 0; i < this.selectedFiles.length; i++) {
      const file = this.selectedFiles[i];
      
      if (this.config.onProgress) {
        this.config.onProgress(i, this.selectedFiles.length, file);
      }

      try {
        const base64 = await this.readFileAsBase64(file);
        const result = await this.uploadSingleFile(file, base64);
        results.push(result);
        
        if (this.config.onSuccess) {
          this.config.onSuccess(result, file);
        }
      } catch (error) {
        if (this.config.onError) {
          this.config.onError(error, file);
        }
        throw error;
      }
    }

    return results;
  }

  async uploadSingleFile(file, base64) {
    if (!this.config.apiRequest || typeof this.config.apiRequest !== 'function') {
      throw new Error('API请求方法未配置');
    }

    const payload = {
      file_name: file.name,
      file_base64: base64
    };

    if (this.additionalData) {
        Object.assign(payload, this.additionalData);
    }

    return await this.config.apiRequest(this.config.uploadEndpoint, 'POST', payload);
  }

  setUploadEndpoint(endpoint) {
    this.config.uploadEndpoint = endpoint;
  }

  setApiRequest(apiRequest) {
    this.config.apiRequest = apiRequest;
  }

  clearFiles() {
    this.selectedFiles = [];
    this.uploadQueue = [];
  }
}

window.ResumeUploadHandler = ResumeUploadHandler;