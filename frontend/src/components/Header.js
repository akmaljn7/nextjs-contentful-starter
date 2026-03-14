import { Link } from 'react-router-dom';
import { useAuthStore, useLanguageStore, useThemeStore } from '@/lib/store';
import { t } from '@/lib/translations';
import { Button } from '@/components/ui/button';
import { Globe, User, LogOut, Palette } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const Header = () => {
  const { user, logout } = useAuthStore();
  const { language, setLanguage } = useLanguageStore();
  const { theme, toggleTheme } = useThemeStore();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ha' : 'en');
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-primary shadow-lg">
      {/* Orange diagonal accent bar - inspired by letterhead */}
      <div className="h-2 bg-gradient-to-r from-accent via-orange-500 to-accent"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          {/* Logo - Much bigger with white background container */}
          <Link to="/" className="flex items-center" data-testid="logo-link">
            <div className="bg-white px-4 py-2 rounded-md">
              <img 
                src="https://customer-assets.emergentagent.com/job_ads-kano/artifacts/togqcbtl_LightBan%20Horizontal%205b.png" 
                alt="Lightban Technology" 
                className="h-12 w-auto"
                style={{ filter: 'invert(1)' }}
              />
            </div>
          </Link>

          {/* Desktop Navigation - Styled as buttons */}
          <nav className="hidden lg:flex items-center space-x-3">
            <Link to="/influencers" data-testid="nav-influencers">
              <Button 
                variant="ghost" 
                className="text-white hover:bg-accent hover:text-white font-medium h-10 px-5"
              >
                {t('nav.influencers', language)}
              </Button>
            </Link>
            <Link to="/billboards" data-testid="nav-billboards">
              <Button 
                variant="ghost" 
                className="text-white hover:bg-accent hover:text-white font-medium h-10 px-5"
              >
                {t('nav.billboards', language)}
              </Button>
            </Link>
            <Link to="/digital-ads" data-testid="nav-digitalads">
              <Button 
                variant="ghost" 
                className="text-white hover:bg-accent hover:text-white font-medium h-10 px-5"
              >
                {t('nav.digitalads', language)}
              </Button>
            </Link>
            <Link to="/kannywood" data-testid="nav-kannywood">
              <Button 
                variant="ghost" 
                className="text-white hover:bg-accent hover:text-white font-medium h-10 px-5"
              >
                {t('nav.kannywood', language)}
              </Button>
            </Link>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center space-x-2">
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              data-testid="theme-toggle-button"
              className="text-white hover:bg-accent/20"
              title={`Switch to ${theme === 'navy' ? 'Orange' : 'Navy'} theme`}
            >
              <Palette className="h-4 w-4" />
            </Button>

            {/* Language Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              data-testid="language-toggle-button"
              className="text-white hover:bg-accent/20"
            >
              <Globe className="h-4 w-4 mr-1" />
              {language.toUpperCase()}
            </Button>

            {user ? (
              <>
                <Link to="/campaign-builder">
                  <Button
                    size="sm"
                    data-testid="build-campaign-button"
                    className="bg-accent hover:bg-accent/90 text-white font-medium h-10 px-5"
                  >
                    {t('nav.buildcampaign', language)}
                  </Button>
                </Link>

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
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    data-testid="signin-button"
                    className="text-white hover:bg-accent/20 font-medium h-10 px-5"
                  >
                    {t('nav.signin', language)}
                  </Button>
                </Link>
                <Link to="/register">
                  <Button
                    size="sm"
                    data-testid="signup-button"
                    className="bg-accent hover:bg-accent/90 text-white font-semibold h-10 px-6"
                  >
                    {t('nav.signup', language)}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Bottom accent line */}
      <div className="h-1 bg-accent/30"></div>
    </header>
  );
};
