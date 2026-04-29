import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, Image as ImageIcon, Loader2, Video } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const CHUNK_SIZE = 64 * 1024; // 64KB chunks

export const MultiMediaUpload = ({ 
  value = [], 
  onChange, 
  label = "Media Files",
  maxFiles = 10,
  className = ""
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const fileInputRef = useRef(null);

  const getAuthToken = () => {
    const authData = localStorage.getItem('auth-storage');
    if (authData) {
      const parsed = JSON.parse(authData);
      return parsed?.state?.token;
    }
    return null;
  };

  const uploadChunks = async (file) => {
    const token = getAuthToken();
    if (!token) {
      toast.error('Please log in to upload files');
      return null;
    }

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let fileId = null;

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      
      const base64Chunk = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(chunk);
      });

      const response = await fetch(`${API_URL}/api/upload/chunk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          chunk: base64Chunk,
          chunk_index: i,
          total_chunks: totalChunks,
          file_id: fileId,
          filename: file.name,
          content_type: file.type
        })
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      fileId = data.file_id;
      setProgress(Math.round(((i + 1) / totalChunks) * 100));

      if (data.url) {
        return data.url;
      }
    }
    return null;
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = maxFiles - (value?.length || 0);
    if (files.length > remainingSlots) {
      toast.error(`You can only add ${remainingSlots} more file(s)`);
      return;
    }

    setUploading(true);
    const newFiles = [];

    for (const file of files) {
      // Validate file type
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      
      if (!isImage && !isVideo) {
        toast.error(`${file.name} is not a valid image or video`);
        continue;
      }

      // Check file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 50MB)`);
        continue;
      }

      setCurrentFile(file.name);
      setProgress(0);

      try {
        const url = await uploadChunks(file);
        if (url) {
          newFiles.push({
            type: isVideo ? 'video' : 'image',
            url: url
          });
        }
      } catch (error) {
        console.error('Upload error:', error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (newFiles.length > 0) {
      const updatedFiles = [...(value || []), ...newFiles];
      onChange(updatedFiles);
      toast.success(`${newFiles.length} file(s) uploaded successfully`);
    }

    setUploading(false);
    setCurrentFile('');
    setProgress(0);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index) => {
    const updatedFiles = [...value];
    updatedFiles.splice(index, 1);
    onChange(updatedFiles);
  };

  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium mb-2">{label}</label>}
      
      {/* Existing files grid */}
      {value && value.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {value.map((file, index) => (
            <div key={index} className="relative aspect-video rounded-lg overflow-hidden bg-muted border">
              {file.type === 'video' ? (
                <video 
                  src={file.url} 
                  className="w-full h-full object-cover"
                  controls
                />
              ) : (
                <img 
                  src={file.url} 
                  alt={`Upload ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              )}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6"
                onClick={() => removeFile(index)}
              >
                <X className="h-3 w-3" />
              </Button>
              <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">
                {file.type === 'video' ? <Video className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                {file.type}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
      {(!value || value.length < maxFiles) && (
        <div 
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            uploading ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 cursor-pointer'
          }`}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {uploading ? (
            <div className="space-y-2">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Uploading {currentFile}...</p>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{progress}%</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium">Click to upload images or videos</p>
              <p className="text-xs text-muted-foreground">
                {value?.length || 0} / {maxFiles} files • Max 50MB per file
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiMediaUpload;
