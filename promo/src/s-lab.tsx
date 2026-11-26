import {makeScene2D, Txt, Rect, Layout} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, easeOutCubic, waitFor} from '@motion-canvas/core';
import {GOLD, CREAM, FONT} from './palette';
import {backdrop, scrim, chapter, notes, tag, chapters, brand, blackMask} from './parts';

export default makeScene2D(function* (view) {
  const bg = createRef<Layout>();
  const col = createRef<Layout>();
  const mask = createRef<Rect>();
  const badge = createRef<Layout>();
  const chrome = createRef<Layout>();
  const bar = createRef<Rect>();
  const barWrap = createRef<Layout>();
  const barLabel = createRef<Txt>();

  view.add(
    <>
      <Layout ref={bg} scale={1.05}>
        {backdrop('/lab-209.png', -420, 2300)}
      </Layout>
      {scrim()}
      <Layout ref={col} x={-480} y={-40} width={780} layout direction={"column"} alignItems={"flex-start"} gap={48} opacity={0}>
        {chapter('03', '实验室', 'AI 帮你找克制的牌')}
        {notes(['多线程穷举候选牌组', '每副对局数 2~30 可调', '结果直接落库'])}
      </Layout>

      <Layout ref={barWrap} layout direction={'column'} gap={14} x={-800} y={330} opacity={0} offset={[-1, 0]}>
        <Txt ref={barLabel} text={'已试 37 副 · 最佳克制率 62%'} fill={GOLD} fontFamily={FONT} fontSize={24} />
        <Rect width={560} height={6} radius={3} fill={'#2a2419'}>
          <Rect ref={bar} width={0} height={6} radius={3} fill={GOLD} />
        </Rect>
      </Layout>
      <Layout ref={badge} opacity={0}>
        {tag('12 线程并行')}
      </Layout>
      <Layout ref={chrome} opacity={0}>
        {brand()}
        {chapters(5, 2)}
      </Layout>
      <Rect ref={mask} width={1920} height={1080} fill={'#000000'} opacity={1} />
    </>,
  );

  yield* all(mask().opacity(0, 0.4, easeOutCubic), bg().scale(1.02, 1.0, easeInOutCubic));
  yield* all(col().opacity(1, 0.7, easeOutCubic), col().x(-440, 0.8, easeOutCubic));
  yield* all(barWrap().opacity(1, 0.4, easeOutCubic), badge().opacity(1, 0.5, easeOutCubic), chrome().opacity(1, 0.5, easeOutCubic));
  yield* bar().width(560, 2.6, easeOutCubic);
  yield* bg().scale(1.07, 2.2, easeInOutCubic);
  yield* mask().opacity(1, 0.35, easeInOutCubic);
});
