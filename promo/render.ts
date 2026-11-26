import {Player, Stage} from '@motion-canvas/core';
import project from './project.ts?project';

(async () => {
  const settings = (project as any).meta.getFullRenderingSettings();
  const stage = new Stage();
  stage.configure(settings);
  document.getElementById('app')!.appendChild(stage.finalBuffer);

  const player = new Player(project as any, settings);
  player.deactivate(); // 不用 Player 自带的 rAF 循环
  const playback = player.playback;

  await playback.recalculate();
  (window as any).totalFrames = playback.duration;
  (window as any).fps = playback.fps;

  (window as any).renderFrame = async (frame: number) => {
    await playback.seek(frame);
    await stage.render(playback.currentScene, playback.previousScene);
    return playback.frame;
  };

  (window as any).ready = true;
  (window as any).frameSize = [settings.size.width, settings.size.height, settings.fps];
})().catch((e) => {
  (window as any).bootError = String(e && e.stack ? e.stack : e);
  console.error(e);
});
