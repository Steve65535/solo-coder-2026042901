import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, Loader2, FileText, File, AlertCircle, Check } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { Document } from '@/services/api';

export default function FilesPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { documents, loadDocuments, uploadFile, deleteDocument, isLoading, error, clearError } = useAppStore();
  
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const allowedExtensions = ['.txt', '.md', '.pdf', '.docx', '.doc'];
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!allowedExtensions.includes(extension || '')) {
      setUploadError(`不支持的文件格式。支持的格式: ${allowedExtensions.join(', ')}`);
      return;
    }

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError('文件大小超过限制 (最大 50MB)');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90));
    }, 200);

    try {
      await uploadFile(file);
      setUploadProgress(100);
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 500);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setUploadError(error.response?.data?.message || '上传失败');
      setUploading(false);
      setUploadProgress(0);
    } finally {
      clearInterval(interval);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDelete = async (doc: Document) => {
    if (confirm(`确定要删除文件 "${doc.original_name}" 吗？`)) {
      await deleteDocument(doc.id);
    }
  };

  const formatFileSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <File className="w-5 h-5 text-red-500" />;
    if (ext === 'md') return <FileText className="w-5 h-5 text-blue-500" />;
    if (ext === 'txt') return <FileText className="w-5 h-5 text-gray-500" />;
    return <File className="w-5 h-5 text-gray-400" />;
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      <header className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-800">知识库</h1>
            <p className="text-sm text-gray-500">
              管理上传的文档，支持 txt、md、pdf、docx 格式
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <Upload className="w-4 h-4" />
            上传文件
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {(error || uploadError) && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-700">{error || uploadError}</p>
            </div>
            <button
              onClick={() => {
                clearError();
                setUploadError(null);
              }}
              className="text-red-400 hover:text-red-600"
            >
              关闭
            </button>
          </div>
        )}

        {uploading && (
          <div className="mb-6 p-4 bg-primary-50 border border-primary-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {uploadProgress === 100 ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Loader2 className="w-4 h-4 text-primary-600 animate-spin" />
                )}
                <span className="text-sm font-medium text-gray-700">
                  {uploadProgress === 100 ? '上传完成' : '正在上传...'}
                </span>
              </div>
              <span className="text-sm text-gray-500">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-primary-100 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mb-6 p-8 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-primary-400 bg-primary-50'
              : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.pdf,.docx,.doc"
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />
          <Upload className={`w-10 h-10 mx-auto mb-3 ${
            dragOver ? 'text-primary-500' : 'text-gray-400'
          }`} />
          <p className="text-sm font-medium text-gray-700 mb-1">
            拖拽文件到这里或点击上传
          </p>
          <p className="text-xs text-gray-400">
            支持 txt、md、pdf、docx 格式，单个文件最大 50MB
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">
              已上传文件 ({documents.length})
            </h2>
            {isLoading && documents.length > 0 && (
              <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
            )}
          </div>

          {documents.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">暂无上传的文件</p>
              <p className="text-sm text-gray-400 mt-1">
                上传文档后即可开始智能问答
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:border-primary-300 transition-colors"
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    {getFileIcon(doc.original_name)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {doc.original_name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatFileSize(doc.file_size)} · {formatDate(doc.created_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded">
                      已索引
                    </span>
                    <button
                      onClick={() => handleDelete(doc)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="删除文件"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
