import Phaser from 'phaser';
import { DEBUG } from '../config/debug';
import { SaveManager } from '../systems/SaveManager';

// Lee los parámetros de URL, carga el guardado y espera la fuente antes de pasar a la carga.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.registry.set('debug', DEBUG);
    SaveManager.load();
    // Si la fuente tarda, seguimos igual: los textos usan el 'monospace' del sistema mientras carga.
    const fonts = typeof document !== 'undefined' ? document.fonts?.ready : undefined;
    if (fonts) fonts.then(() => this.scene.start('Preload')).catch(() => this.scene.start('Preload'));
    else this.scene.start('Preload');
  }
}
