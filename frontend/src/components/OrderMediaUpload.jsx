import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  Upload,
  Image as ImageIcon,
  Video,
  Link as LinkIcon,
  X,
  Loader2,
  Plus,
  ExternalLink,
  Trash2,
  FileUp,
  Check
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Helper to ensure media URLs are absolute
const getAbsoluteMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const OrderMediaUpload = ({ 
  orderId, 
  existingMedia = [], 
  onMediaUpdate,
  isCompact = false,
  readOnly = false 
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.post(`/orders/${orderId}/media`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (response.data.status === 'success') {
          toast.success(`Uploaded: ${file.name}`);
        }
      }
      
      // Refresh media list
      if (onMediaUpdate) {
        onMediaUpdate();
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(linkUrl);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }

    setIsAddingLink(true);
    
    try {
      const response = await api.post(`/orders/${orderId}/media/link`, {
        url: linkUrl.trim(),
        title: linkTitle.trim() || null
      });

      if (response.data.status === 'success') {
        toast.success('Link added successfully');
        setLinkUrl('');
        setLinkTitle('');
        setShowLinkModal(false);
        
        if (onMediaUpdate) {
          onMediaUpdate();
        }
      }
    } catch (error) {
      console.error('Add link error:', error);
      toast.error(error.response?.data?.detail || 'Failed to add link');
    } finally {
      setIsAddingLink(false);
    }
  };

  const handleDeleteMedia = async (index) => {
    setDeletingIndex(index);
    
    try {
      await api.delete(`/orders/${orderId}/media/${index}`);
      toast.success('Media deleted');
      
      if (onMediaUpdate) {
        onMediaUpdate();
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete media');
    } finally {
      setDeletingIndex(null);
    }
  };

  const getMediaIcon = (type) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'link':
        return <LinkIcon className="h-4 w-4" />;
      default:
        return <FileUp className="h-4 w-4" />;
    }
  };

  // Compact view for order cards
  if (isCompact) {
    return (
      <div className="mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Upload className="h-3 w-3" />
            Ad Media ({existingMedia.length})
          </span>
          {!readOnly && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setShowLinkModal(true)}
              >
                <LinkIcon className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Media thumbnails */}
        {existingMedia.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {existingMedia.map((media, index) => (
              <div
                key={index}
                className="relative group w-12 h-12 rounded-lg overflow-hidden border border-border bg-muted/50"
              >
                {media.type === 'image' ? (
                  <img
                    src={getAbsoluteMediaUrl(media.url)}
                    alt={media.filename || 'Ad media'}
                    className="w-full h-full object-cover"
                  />
                ) : media.type === 'video' ? (
                  <div className="w-full h-full flex items-center justify-center bg-slate-800">
                    <Video className="h-4 w-4 text-white" />
                  </div>
                ) : (
                  <a
                    href={media.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-full flex items-center justify-center bg-blue-50 hover:bg-blue-100"
                  >
                    <LinkIcon className="h-4 w-4 text-blue-600" />
                  </a>
                )}
                
                {!readOnly && (
                  <button
                    onClick={() => handleDeleteMedia(index)}
                    disabled={deletingIndex === index}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                  >
                    {deletingIndex === index ? (
                      <Loader2 className="h-4 w-4 text-white animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-white" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {existingMedia.length === 0 && !readOnly && (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs border-dashed"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Upload className="h-3 w-3 mr-1" />
            )}
            Upload Ad Content
          </Button>
        )}

        {/* Link Modal */}
        <Dialog open={showLinkModal} onOpenChange={setShowLinkModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Link</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">URL *</label>
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Title (optional)</label>
                <Input
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Link description"
                  className="mt-1"
                />
              </div>
              <Button
                onClick={handleAddLink}
                disabled={isAddingLink}
                className="w-full"
              >
                {isAddingLink ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add Link
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Full view for order details page
  return (
    <Card className="border-2">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Upload className="h-4 w-4 text-accent" />
            Ad Media Content
          </h3>
          {!readOnly && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                Upload Files
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLinkModal(true)}
              >
                <LinkIcon className="h-4 w-4 mr-1" />
                Add Link
              </Button>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Media list */}
        {existingMedia.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {existingMedia.map((media, index) => (
              <div
                key={index}
                className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted/50"
              >
                {media.type === 'image' ? (
                  <img
                    src={getAbsoluteMediaUrl(media.url)}
                    alt={media.filename || 'Ad media'}
                    className="w-full h-full object-cover"
                  />
                ) : media.type === 'video' ? (
                  <video
                    src={getAbsoluteMediaUrl(media.url)}
                    className="w-full h-full object-cover"
                    controls
                  />
                ) : (
                  <a
                    href={media.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-full flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-100 p-2"
                  >
                    <LinkIcon className="h-8 w-8 text-blue-600 mb-2" />
                    <span className="text-xs text-blue-600 text-center line-clamp-2">
                      {media.title || media.url}
                    </span>
                    <ExternalLink className="h-3 w-3 text-blue-400 mt-1" />
                  </a>
                )}
                
                {/* Media type badge */}
                <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                  {getMediaIcon(media.type)}
                </div>
                
                {!readOnly && (
                  <button
                    onClick={() => handleDeleteMedia(index)}
                    disabled={deletingIndex === index}
                    className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {deletingIndex === index ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-muted/30 rounded-lg border border-dashed border-border">
            <Upload className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground text-sm mb-3">
              {readOnly ? 'No media uploaded yet' : 'Upload your ad content (photos, videos, or links)'}
            </p>
            {!readOnly && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1" />
                  )}
                  Upload Files
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLinkModal(true)}
                >
                  <LinkIcon className="h-4 w-4 mr-1" />
                  Add Link
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Link Modal */}
        <Dialog open={showLinkModal} onOpenChange={setShowLinkModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Link</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">URL *</label>
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Title (optional)</label>
                <Input
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Link description"
                  className="mt-1"
                />
              </div>
              <Button
                onClick={handleAddLink}
                disabled={isAddingLink}
                className="w-full"
              >
                {isAddingLink ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Add Link
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default OrderMediaUpload;
