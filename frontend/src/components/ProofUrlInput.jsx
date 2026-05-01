import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, Link as LinkIcon, Image as ImageIcon, Video, ExternalLink } from 'lucide-react';

export const ProofUrlInput = ({ 
  value = [], 
  onChange, 
  label = "Completion Proof",
  maxItems = 10,
  className = ""
}) => {
  const [newUrl, setNewUrl] = useState('');
  const [newType, setNewType] = useState('video');

  const addProof = () => {
    if (!newUrl.trim()) return;
    
    if (value.length >= maxItems) {
      return;
    }

    const newProof = {
      type: newType,
      url: newUrl.trim()
    };

    onChange([...value, newProof]);
    setNewUrl('');
  };

  const removeProof = (index) => {
    const updated = [...value];
    updated.splice(index, 1);
    onChange(updated);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addProof();
    }
  };

  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium mb-2">{label}</label>}
      
      {/* Existing proofs list */}
      {value && value.length > 0 && (
        <div className="space-y-2 mb-4">
          {value.map((proof, index) => (
            <div 
              key={index} 
              className="flex items-center gap-2 p-2 bg-muted rounded-lg border"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {proof.type === 'video' ? (
                  <Video className="h-4 w-4 text-blue-500 flex-shrink-0" />
                ) : (
                  <ImageIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
                )}
                <span className="text-xs font-medium uppercase text-muted-foreground w-12">
                  {proof.type}
                </span>
                <a 
                  href={proof.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline truncate flex items-center gap-1"
                >
                  {proof.url}
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                </a>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => removeProof(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new proof input */}
      {(!value || value.length < maxItems) && (
        <div className="flex gap-2">
          <Select value={newType} onValueChange={setNewType}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="video">
                <div className="flex items-center gap-2">
                  <Video className="h-3 w-3" />
                  Video
                </div>
              </SelectItem>
              <SelectItem value="image">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-3 w-3" />
                  Image
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1 relative">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="url"
              placeholder="Paste Google Drive, YouTube, or image URL..."
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pl-9"
            />
          </div>
          <Button 
            type="button" 
            onClick={addProof}
            disabled={!newUrl.trim()}
            size="icon"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-2">
        {value?.length || 0} / {maxItems} items • Paste URLs from Google Drive, YouTube, or direct image links
      </p>
    </div>
  );
};

export default ProofUrlInput;
