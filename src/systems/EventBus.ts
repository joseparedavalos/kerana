import Phaser from 'phaser';

// Bus de eventos global para comunicar escenas (Level ↔ UI) sin referencias cruzadas.
export const EventBus = new Phaser.Events.EventEmitter();

export const GameEvents = {
  heartsChanged: 'hearts:changed', // (current: number, max: number)
  playerRespawned: 'player:respawned', // (reason: 'pit' | 'water' | 'hazard')
  checkpointActivated: 'checkpoint:activated', // (id: number)
  levelReady: 'level:ready', // (levelId: string)
} as const;
