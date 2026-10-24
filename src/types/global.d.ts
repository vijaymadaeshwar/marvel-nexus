import type { NexusCore, PanelModule } from './index';

declare global {
  interface Window {
    NexusCore?: NexusCore;
    NexusVillains?: PanelModule;
    NexusCredits?: PanelModule;
    Eggs?: PanelModule;
    ShareCard?: PanelModule;
    Nostalgia?: PanelModule;
    StanLee?: PanelModule;
    Surprise?: PanelModule;
    NexusProgress?: PanelModule;
    Quiz?: PanelModule;
    WatchParty?: PanelModule;
  }
}

export {};
