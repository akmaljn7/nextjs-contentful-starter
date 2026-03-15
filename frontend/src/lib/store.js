import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        set({ user, token });
      },
      logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({ user: null, token: null });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);

export const useLanguageStore = create(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (lang) => set({ language: lang }),
    }),
    {
      name: 'language-storage',
    }
  )
);

export const useThemeStore = create(
  persist(
    (set) => ({
      theme: 'navy', // 'navy' or 'orange'
      toggleTheme: () => set((state) => ({ theme: state.theme === 'navy' ? 'orange' : 'navy' })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'theme-storage',
    }
  )
);

export const useCartStore = create(
  persist(
    (set) => ({
      items: [],
      addItem: (item) => set((state) => {
        // Check if item already exists
        const exists = state.items.find(i => 
          i.influencerId === item.influencerId && i.packageId === item.packageId
        );
        if (exists) {
          return state; // Don't add duplicate
        }
        return { items: [...state.items, item] };
      }),
      removeItem: (influencerId, packageId) => set((state) => ({
        items: state.items.filter(i => 
          !(i.influencerId === influencerId && i.packageId === packageId)
        ),
      })),
      clearCart: () => set({ items: [] }),
      getTotalAmount: () => {
        const state = useCartStore.getState();
        return state.items.reduce((total, item) => total + item.price, 0);
      },
    }),
    {
      name: 'cart-storage',
    }
  )
);
