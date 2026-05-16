import { create } from 'zustand'

interface MixerState {
  isConnected: boolean
  masterLevel: number
  channels: Record<number, { level: number; mute: boolean; name: string }>
  setConnected: (connected: boolean) => void
  updateMasterLevel: (level: number) => void
  updateChannel: (id: number, data: Partial<{ level: number; mute: boolean; name: string }>) => void
}

export const useMixerStore = create<MixerState>((set) => ({
  isConnected: false,
  masterLevel: 0,
  channels: {},
  
  setConnected: (connected) => set({ isConnected: connected }),
  
  updateMasterLevel: (level) => set({ masterLevel: level }),
  
  updateChannel: (id, data) => set((state) => ({
    channels: {
      ...state.channels,
      [id]: {
        ...(state.channels[id] || { level: 0, mute: false, name: `Ch ${id}` }),
        ...data
      }
    }
  })),
}))
