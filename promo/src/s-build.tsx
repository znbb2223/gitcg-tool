import {makeScene2D, Rect, Layout} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, easeOutCubic, easyOutCubic, waitFor} from '@motion-canvas/core';
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
        {backdrop('/deckbuild-209.png', 260, 2050)}
      </Layout>
      {scrim()}
      <Layout ref={col} x={-480} y={-40} width={780} layout direction={"column"} alignItems={"flex-start"} gap={48} opacity={0}>
        {chapter('04', '组牌器', '从零组一套能打的')}
        {notes(['按费用 / 元素 / 类型筛选', '实时合法性检查', '一键牌组码与牌组图'])}
      </Layout>

      <Layout ref={badge} opacity={0}>
        {tag('3 角色 · 30 张行动牌')}
      </Layout>
      <Layout ref={chrome} opacity={0}>
        {brand()}
        {chapters(5, 3)}
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
