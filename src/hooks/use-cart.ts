'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Cart item interface
 */
export interface CartItem {
  id: string; // variant ID
  productId: string;
  productName: string;
  variantName?: string;
  sku: string;
  price: number;
  quantity: number;
  image?: string;
  attributes?: Record<string, any>;
  maxQuantity?: number; // Available stock
}

/**
 * Cart store interface
 */
interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  
  // Actions
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  getItem: (itemId: string) => CartItem | undefined;
  
  // UI Actions
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
}

/**
 * Cart store using Zustand with persistence
 */
export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (newItem) => {
        const { items } = get();
        const existingItem = items.find(item => item.id === newItem.id);

        if (existingItem) {
          // Update quantity if item already exists
          const newQuantity = existingItem.quantity + (newItem.quantity || 1);
          const maxQuantity = newItem.maxQuantity || existingItem.maxQuantity;
          
          set({
            items: items.map(item =>
              item.id === newItem.id
                ? { 
                    ...item, 
                    quantity: maxQuantity ? Math.min(newQuantity, maxQuantity) : newQuantity,
                    maxQuantity: maxQuantity || item.maxQuantity
                  }
                : item
            )
          });
        } else {
          // Add new item
          const quantity = newItem.quantity || 1;
          const maxQuantity = newItem.maxQuantity;
          
          set({
            items: [
              ...items,
              {
                ...newItem,
                quantity: maxQuantity ? Math.min(quantity, maxQuantity) : quantity
              }
            ]
          });
        }
      },

      removeItem: (itemId) => {
        set({
          items: get().items.filter(item => item.id !== itemId)
        });
      },

      updateQuantity: (itemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(itemId);
          return;
        }

        set({
          items: get().items.map(item => {
            if (item.id === itemId) {
              const maxQuantity = item.maxQuantity;
              return {
                ...item,
                quantity: maxQuantity ? Math.min(quantity, maxQuantity) : quantity
              };
            }
            return item;
          })
        });
      },

      clearCart: () => {
        set({ items: [] });
      },

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getTotalPrice: () => {
        return get().items.reduce((total, item) => total + (item.price * item.quantity), 0);
      },

      getItem: (itemId) => {
        return get().items.find(item => item.id === itemId);
      },

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set({ isOpen: !get().isOpen }),
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({ items: state.items }),
    }
  )
);