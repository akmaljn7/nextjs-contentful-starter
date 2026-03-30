import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore, useLanguageStore, useCartStore } from '@/lib/store';
import { t } from '@/lib/translations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Globe, User, LogOut, ShoppingCart, Menu, X, Search } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import api from '@/lib/api';

// Default logo URL
const DEFAULT_LOGO = 'https://customer-assets.emergentagent.com/job_ads-kano/artifacts/xiehimyl_App_logo.PNG';

export const Header = () => {
  const { user, logout } = useAuthStore();
  const { language, setLanguage } = useLanguageStore();
  const { items } = useCartStore();
  const navigate = useNavigate();
  const cartItemCount = items.length;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get('/settings');
        setSettings(response.data);
      } catch (error) {
        console.log('Using default header settings');
      }
    };
    fetchSettings();
  }, []);

  const logoUrl = settings?.web_logo_url || settings?.primary_logo_url || DEFAULT_LOGO;

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ha' : 'en');
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      closeMobileMenu();
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-primary shadow-lg">
      {/* Orange diagonal accent bar */}
      <div className="h-1 sm:h-2 bg-gradient-to-r from-accent via-orange-500 to-accent"></div>
      
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex h-16 sm:h-24 items-center justify-between">
          {/* Logo - Shifted left with negative margin and increased size */}
          <Link to="/" className="flex items-center shrink-0 -ml-2 sm:-ml-4" data-testid="logo-link" onClick={closeMobileMenu}>
            <img 
              src={logoUrl}
              alt={settings?.site_name || 'Adlinka'} 
              className="h-14 sm:h-24 w-auto"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-2">
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="relative mr-2">
              <div className="flex items-center bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                <Search className="h-4 w-4 ml-3 text-white/70" />
                <Input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-32 xl:w-48 h-9 bg-transparent border-0 text-white placeholder:text-white/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                  data-testid="header-search-input"
                />
              </div>
            </form>
            
            <Link to="/influencers" data-testid="nav-influencers">
              <Button 
                variant="ghost" 
                className="text-white hover:bg-accent hover:text-white font-medium h-10 px-4"
              >
                {t('nav.influencers', language)}
              </Button>
            </Link>
            <Link to="/billboards" data-testid="nav-billboards">
              <Button 
                variant="ghost" 
                className="text-white hover:bg-accent hover:text-white font-medium h-10 px-4"
              >
                {t('nav.billboards', language)}
              </Button>
            </Link>
            <Link to="/digital-ads" data-testid="nav-digitalads">
              <Button 
                variant="ghost" 
                className="text-white hover:bg-accent hover:text-white font-medium h-10 px-4"
              >
                {t('nav.digitalads', language)}
              </Button>
            </Link>
            <Link to="/kannywood" data-testid="nav-kannywood">
              <Button 
                variant="ghost" 
                className="text-white hover:bg-accent hover:text-white font-medium h-10 px-4"
              >
                {t('nav.kannywood', language)}
              </Button>
            </Link>
            <Link to="/consultation" data-testid="nav-consultation">
              <Button 
                variant="ghost" 
                className="text-white hover:bg-accent hover:text-white font-medium h-10 px-4"
              >
                Consultation
              </Button>
            </Link>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center space-x-1 sm:space-x-2">
            {/* Language Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              data-testid="language-toggle-button"
              className="text-white hover:bg-accent/20 h-8 sm:h-10 px-2 sm:px-3 text-xs sm:text-sm"
            >
              <Globe className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              {language.toUpperCase()}
            </Button>

            {/* Cart Button */}
            <Link to="/cart">
              <Button
                size="sm"
                data-testid="cart-button"
                className="bg-accent hover:bg-accent/90 text-white font-medium h-8 sm:h-10 px-2 sm:px-4 relative"
              >
                <ShoppingCart className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Cart</span>
                {cartItemCount > 0 && (
                  <span 
                    className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-white text-primary text-xs font-bold rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center"
                    data-testid="cart-count"
                  >
                    {cartItemCount}
                  </span>
                )}
              </Button>
            </Link>

            {/* Desktop Auth Buttons */}
            <div className="hidden lg:flex items-center space-x-2">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      data-testid="user-menu-button"
                      className="text-white hover:bg-accent/20"
                    >
                      <User className="h-4 w-4 mr-1" />
                      {user.name}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-white">
                    <DropdownMenuItem asChild>
                      <Link to="/dashboard" data-testid="dashboard-link">
                        {t('nav.dashboard', language)}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={logout} data-testid="logout-button">
                      <LogOut className="h-4 w-4 mr-2" />
                      {t('nav.logout', language)}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Link to="/login">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      data-testid="signin-button"
                      className="text-white hover:bg-accent/20 font-medium h-10 px-4"
                    >
                      {t('nav.signin', language)}
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button
                      size="sm"
                      data-testid="signup-button"
                      className="bg-accent hover:bg-accent/90 text-white font-semibold h-10 px-5"
                    >
                      {t('nav.signup', language)}
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden text-white hover:bg-accent/20 h-8 w-8 sm:h-10 sm:w-10 p-0"
              data-testid="mobile-menu-button"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-primary border-t border-white/10">
          <div className="px-4 py-4 space-y-2">
            {/* Mobile Search Bar */}
            <form onSubmit={handleSearch} className="mb-4">
              <div className="flex items-center bg-white/10 rounded-lg">
                <Search className="h-5 w-5 ml-3 text-white/70" />
                <Input
                  type="text"
                  placeholder="Search influencers, billboards..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 h-11 bg-transparent border-0 text-white placeholder:text-white/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                  data-testid="mobile-search-input"
                />
                <Button 
                  type="submit" 
                  size="sm" 
                  className="mr-1 bg-accent hover:bg-accent/90"
                >
                  Search
                </Button>
              </div>
            </form>

            {/* Navigation Links */}
            <Link 
              to="/influencers" 
              onClick={closeMobileMenu}
              className="block px-4 py-3 text-white hover:bg-accent rounded-lg font-medium"
            >
              {t('nav.influencers', language)}
            </Link>
            <Link 
              to="/billboards" 
              onClick={closeMobileMenu}
              className="block px-4 py-3 text-white hover:bg-accent rounded-lg font-medium"
            >
              {t('nav.billboards', language)}
            </Link>
            <Link 
              to="/digital-ads" 
              onClick={closeMobileMenu}
              className="block px-4 py-3 text-white hover:bg-accent rounded-lg font-medium"
            >
              {t('nav.digitalads', language)}
            </Link>
            <Link 
              to="/kannywood" 
              onClick={closeMobileMenu}
              className="block px-4 py-3 text-white hover:bg-accent rounded-lg font-medium"
            >
              {t('nav.kannywood', language)}
            </Link>
            <Link 
              to="/consultation" 
              onClick={closeMobileMenu}
              className="block px-4 py-3 text-white hover:bg-accent rounded-lg font-medium"
            >
              Consultation
            </Link>

            {/* Divider */}
            <div className="border-t border-white/20 my-3"></div>

            {/* Auth Section */}
            {user ? (
              <>
                <Link 
                  to="/dashboard" 
                  onClick={closeMobileMenu}
                  className="flex items-center px-4 py-3 text-white hover:bg-accent rounded-lg font-medium"
                >
                  <User className="h-5 w-5 mr-3" />
                  {t('nav.dashboard', language)}
                </Link>
                <button
                  onClick={() => { logout(); closeMobileMenu(); }}
                  className="flex items-center w-full px-4 py-3 text-white hover:bg-red-600 rounded-lg font-medium"
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  {t('nav.logout', language)}
                </button>
              </>
            ) : (
              <div className="space-y-2 pt-2">
                <Link to="/login" onClick={closeMobileMenu}>
                  <Button 
                    variant="outline"
                    className="w-full border-white text-white hover:bg-white hover:text-primary font-medium h-12"
                  >
                    {t('nav.signin', language)}
                  </Button>
                </Link>
                <Link to="/register" onClick={closeMobileMenu}>
                  <Button
                    className="w-full bg-accent hover:bg-accent/90 text-white font-semibold h-12"
                  >
                    {t('nav.signup', language)}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Bottom accent line */}
      <div className="h-0.5 sm:h-1 bg-accent/30"></div>
    </header>
  );
};
