import { create } from 'zustand';
import type { TeamPublic } from '@shared/types';
import { fetchTeams } from '@/lib/api';

interface TeamState {
  teams: TeamPublic[];
  loadTeams: () => Promise<void>;
}

export const useTeamStore = create<TeamState>((set) => ({
  teams: [],

  loadTeams: async () => {
    try {
      const data = await fetchTeams();
      set({ teams: data.teams });
    } catch (err) {
      console.warn('Failed to load teams:', err);
    }
  },
}));
