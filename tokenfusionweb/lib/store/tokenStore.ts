import { create } from 'zustand';

interface TokenState {
  balance: number;
  estimatedCost: number;
  updateBalance: (balance: number) => void;
  deductTokens: (amount: number) => void;
  setEstimatedCost: (cost: number) => void;
}

export const useTokenStore = create<TokenState>((set) => ({
  balance: 0,
  estimatedCost: 0,

  updateBalance: (balance) => set({ balance }),

  deductTokens: (amount) =>
    set((state) => ({
      balance: Math.max(0, state.balance - amount),
    })),

  setEstimatedCost: (estimatedCost) => set({ estimatedCost }),
}));
