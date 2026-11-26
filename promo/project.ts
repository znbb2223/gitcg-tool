import {makeProject} from '@motion-canvas/core';
import intro from './src/s-intro?scene';
import sim from './src/s-sim?scene';
import lib from './src/s-lib?scene';
import lab from './src/s-lab?scene';
import build from './src/s-build?scene';
import board from './src/s-board?scene';
import end from './src/s-end?scene';

export default makeProject({
  scenes: [intro, sim, lib, lab, build, board, end],
  settings: {
    shared: {size: {x: 1920, y: 1080}},
    preview: {fps: 60},
    rendering: {fps: 60},
  },
});
