import Phaser from 'phaser';
import { DEBUG } from './config/debug';
import { GAMEPLAY } from './config/gameplay';
import { BootScene } from './scenes/BootScene';
import { CreditsScene } from './scenes/CreditsScene';
import { LevelCompleteScene } from './scenes/LevelCompleteScene';
import { LevelScene } from './scenes/LevelScene';
import { OptionsScene } from './scenes/OptionsScene';
import { PauseScene } from './scenes/PauseScene';
import { PreloadScene } from './scenes/PreloadScene';
import { StoryScene } from './scenes/StoryScene';
import { TitleScene } from './scenes/TitleScene';
import { UIScene } from './scenes/UIScene';
import { WorldMapScene } from './scenes/WorldMapScene';

// Configuración de Phaser (GDD §11.3).
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 640,
  height: 360,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#1B1A2E',
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: GAMEPLAY.gravity }, debug: DEBUG.debug },
  },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { gamepad: true },
  scene: [
    BootScene,
    PreloadScene,
    TitleScene,
    StoryScene,
    WorldMapScene,
    LevelScene,
    LevelCompleteScene,
    PauseScene,
    OptionsScene,
    CreditsScene,
    UIScene,
  ],
};

const game = new Phaser.Game(config);
// Para depuración y la prueba de humo (tools/smoke.mjs): qué escena está activa ahora mismo.
if (typeof window !== 'undefined') window.__KERANA_GAME__ = game;
