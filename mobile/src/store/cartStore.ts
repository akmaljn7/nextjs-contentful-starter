import { create } from 'zustand';
import { cartStorage } from '../utils/storage';
import { CartItem } from '../types/api';

interface CartState {
  items: CartItem[];
  isLoading: boolean;
  
  // Computed
  totalItems: () => number;
  totalAmount: () => number;
  
  // Actions
  addItem: (item: CartItem) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  updateItemQuantity: (itemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  loadCart: () => Promise<void>;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  isLoading: false,

  totalItems: () => get().items.length,
  
  totalAmount: () => get().items.reduce((total, item) => total + item.price, 0),

  addItem: async (item: CartItem) => {
    const currentItems = get().items;
    
    // Check if item already exists
    const existingIndex = currentItems.findIndex(i => i.id === item.id);
    
    let newItems: CartItem[];
    if (existingIndex >= 0) {
      // Item exists - don't add duplicate for services
      newItems = currentItems;
    } else {
      newItems = [...currentItems, item];
    }
    
    set({ items: newItems });
    await cartStorage.setCart(newItems);
  },

  removeItem: async (itemId: string) => {
    const currentItems = get().items;
    const newItems = currentItems.filter(item => item.id !== itemId);
    
    set({ items: newItems });
    await cartStorage.setCart(newItems);
  },

  updateItemQuantity: async (itemId: string, quantity: number) => {
    // For service-based items, quantity is typically 1
    // This is here for future extensibility
    const currentItems = get().items;
    const newItems = currentItems.map(item =>
      item.id === itemId ? { ...item, quantity } : item
    );
    
    set({ items: newItems });
    await cartStorage.setCart(newItems);
  },

  clearCart: async () => {
    set({ items: [] });
    await cartStorage.clearCart();
  },

  loadCart: async () => {
    set({ isLoading: true });
    try {
      const items = await cartStorage.getCart();
      set({ items, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
    }
  },
}));
