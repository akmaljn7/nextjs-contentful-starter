import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const GlobalSearch = ({ className, variant = 'default' }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Fetch suggestions on query change
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }
      
      setLoading(true);
      try {
        const response = await api.get('/search/suggestions', { params: { q: query } });
        setSuggestions(response.data.suggestions || []);
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (searchQuery = query) => {
    if (!searchQuery.trim()) return;
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    setShowSuggestions(false);
    setQuery('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    handleSearch(suggestion);
  };

  const isCompact = variant === 'compact';

  return (
    <div className={cn("relative", className)}>
      <div className={cn(
        "flex items-center",
        isCompact ? "bg-muted/50 rounded-full" : "bg-white rounded-lg shadow-sm border"
      )}>
        <Search className={cn(
          "text-muted-foreground",
          isCompact ? "h-4 w-4 ml-3" : "h-5 w-5 ml-4"
        )} />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search influencers, billboards, digital ads..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          className={cn(
            "border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent",
            isCompact ? "h-9 text-sm" : "h-11"
          )}
          data-testid="global-search-input"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            className="mr-1 h-7 w-7 p-0"
            onClick={() => {
              setQuery('');
              setSuggestions([]);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        {!isCompact && (
          <Button 
            className="mr-1 bg-accent hover:bg-accent/90"
            onClick={() => handleSearch()}
            data-testid="global-search-button"
          >
            Search
          </Button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && (query.length >= 2 || suggestions.length > 0) && (
        <div 
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border z-50 max-h-64 overflow-y-auto"
        >
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            </div>
          ) : suggestions.length > 0 ? (
            <div className="py-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  className="w-full px-4 py-2 text-left hover:bg-muted/50 flex items-center gap-2"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{suggestion}</span>
                </button>
              ))}
            </div>
          ) : query.length >= 2 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Press Enter to search for "{query}"
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
