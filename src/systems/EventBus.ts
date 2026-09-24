import Phaser from 'phaser';

// Bus de eventos global para comunicar escenas (Level ↔ UI) sin referencias cruzadas.
export const EventBus = new Phaser.Events.EventEmitter();

export const GameEvents = {
  heartsChanged: 'hearts:changed', // (current: number, max: number)
  playerRespawned: 'player:respawned', // (reason: 'pit' | 'water' | 'hazard')
  checkpointActivated: 'checkpoint:activated', // (id: number)
  levelReady: 'level:ready', // (levelId: string)
  feathersChanged: 'feathers:changed', // (current: number, max: number)
  luzArasyChanged: 'luz_arasy:changed', // (active: boolean, fraction: number) fraction 1→0
} as const;
