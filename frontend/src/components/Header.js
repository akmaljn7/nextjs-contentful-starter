import { Link } from 'react-router-dom';
import { useAuthStore, useLanguageStore } from '@/lib/store';
import { t } from '@/lib/translations';
import { Button } from '@/components/ui/button';
import { Globe, User, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const Header = () => {
  const { user, logout } = useAuthStore();
  const { language, setLanguage } = useLanguageStore();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ha' : 'en');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2" data-testid="logo-link">
            <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-xl">L</span>
            </div>
            <span className="font-bold text-xl text-foreground hidden sm:inline-block">
              Lightban
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link
              to="/influencers"
              className="text-sm font-medium text-foreground/80 hover:text-foreground"
              data-testid="nav-influencers"
            >
              {t('nav.influencers', language)}
            </Link>
            <Link
              to="/billboards"
              className="text-sm font-medium text-foreground/80 hover:text-foreground"
              data-testid="nav-billboards"
            >
              {t('nav.billboards', language)}
            </Link>
            <Link
              to="/digital-ads"
              className="text-sm font-medium text-foreground/80 hover:text-foreground"
              data-testid="nav-digitalads"
            >
              {t('nav.digitalads', language)}
            </Link>
            <Link
              to="/kannywood"
              className="text-sm font-medium text-foreground/80 hover:text-foreground"
              data-testid="nav-kannywood"
            >
              {t('nav.kannywood', language)}
            </Link>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center space-x-3">
            {/* Language Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              data-testid="language-toggle-button"
              className="text-sm"
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
                    className="bg-accent hover:bg-accent/90 text-foreground font-medium"
                  >
                    {t('nav.buildcampaign', language)}
                  </Button>
                </Link>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" data-testid="user-menu-button">
                      <User className="h-4 w-4 mr-1" />
                      {user.name}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
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
                  <Button variant="ghost" size="sm" data-testid="signin-button">
                    {t('nav.signin', language)}
                  </Button>
                </Link>
                <Link to="/register">
                  <Button
                    size="sm"
                    data-testid="signup-button"
                    className="bg-primary hover:bg-primary/90 text-white"
                  >
                    {t('nav.signup', language)}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
