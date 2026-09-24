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
  bossBarShow: 'boss:bar_show', // (nameKey: string, epithetKey: string)
  bossHpChanged: 'boss:hp_changed', // (fraction: number) 1 → 0
  bossBarHide: 'boss:bar_hide', // sin datos
  restartFromCheckpoint: 'level:restart_from_checkpoint', // sin datos: Pause pide reaparecer en el último fuego
} as const;
