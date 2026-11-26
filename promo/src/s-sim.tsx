import {makeScene2D, Txt, Rect, Layout} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, easeOutCubic, waitFor} from '@motion-canvas/core';
import {backdrop, scrim, chapter, notes, tag, chapters, brand, blackMask} from './parts';

export default makeScene2D(function* (view) {
  const bg = createRef<Layout>();
  const col = createRef<Layout>();
  const mask = createRef<Rect>();
  const badge = createRef<Layout>();
  const chrome = createRef<Layout>();

  view.add(
    <>
      <Layout ref={bg} scale={1.04}>
        {backdrop('/game-209.png')}
      </Layout>
      {scrim()}
      <Layout ref={col} x={-480} y={-40} width={780} layout direction={"column"} alignItems={"flex-start"} gap={48} opacity={0}>
        {chapter('01', '模拟器', '完整对局，离线可打')}
        {notes(['人机对战 / 机机观战', '摆盘器改局面，一键开局', '对局日志逐帧回放'])}
      </Layout>

      <Layout ref={badge} opacity={0}>
        {tag('零联网 · 全部资源内置')}
      </Layout>
      <Layout ref={chrome} opacity={0}>
        {brand()}
        {chapters(5, 0)}
      </Layout>
      <Rect ref={mask} width={1920} height={1080} fill={'#000000'} opacity={1} />
    </>,
  );

  yield* all(mask().opacity(0, 0.4, easeOutCubic), bg().scale(1.02, 1.0, easeInOutCubic));
  yield* all(col().opacity(1, 0.7, easeOutCubic), col().x(-440, 0.8, easeOutCubic));
  yield* all(badge().opacity(1, 0.5, easeOutCubic), chrome().opacity(1, 0.5, easeOutCubic));
  yield* bg().scale(1.07, 2.2, easeInOutCubic);
  yield* mask().opacity(1, 0.35, easeInOutCubic);
});
