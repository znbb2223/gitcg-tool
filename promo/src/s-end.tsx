import {makeScene2D, Txt, Rect, Layout, Circle} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, easeOutBack, easeOutCubic, waitFor} from '@motion-canvas/core';
import {INK, GOLD, CREAM, GREY, FONT} from './palette';

export default makeScene2D(function* (view) {
  const line = createRef<Rect>();
  const slogan = createRef<Txt>();
  const subline = createRef<Txt>();
  const tags = createRef<Layout>();
  const foot = createRef<Txt>();
  const mask = createRef<Rect>();

  const chip = (text: string) => (
    <Layout padding={[12, 26]} fill={'#15120c'} radius={8} stroke={'#5d5138'} strokeWidth={1}>
      <Txt text={text} fill={CREAM} fontFamily={FONT} fontSize={26} />
    </Layout>
  );

  view.add(
    <>
      <Rect width={1920} height={1080} fill={INK} />
      <Circle size={1500} fill={'#1a150e'} y={-380} opacity={0.5} />
      <Rect ref={line} width={0} height={2} fill={GOLD} y={-250} />
      <Txt
        ref={slogan}
        text={'练得越久，越懂你的打法'}
        fill={CREAM}
        fontFamily={FONT}
        fontSize={84}
        fontWeight={900}
        y={-100}
        opacity={0}
        scale={0.94}
      />
      <Txt
        ref={subline}
        text={'离线 · 零权限 · 手机与电脑同源'}
        fill={GREY}
        fontFamily={FONT}
        fontSize={32}
        y={20}
        opacity={0}
      />
      <Layout ref={tags} layout direction={'row'} gap={18} y={140} alignItems={'center'} opacity={0}>
        {chip('完全离线')}
        {chip('零权限')}
        {chip('20:9 手游布局')}
        {chip('AGPL-3.0')}
      </Layout>
      <Txt ref={foot} text={'七圣召唤工具 · 数据版本 7.2.0'} fill={'#6f6552'} fontFamily={FONT} fontSize={22} y={400} opacity={0} />
      <Rect ref={mask} width={1920} height={1080} fill={'#000000'} opacity={0} />
    </>,
  );

  yield* line().width(420, 0.6, easeOutCubic);
  yield* all(slogan().opacity(1, 0.8, easeOutCubic), slogan().scale(1, 0.8, easeOutBack));
  yield* subline().opacity(1, 0.6, easeOutCubic);
  yield* tags().opacity(1, 0.6, easeOutCubic);
  yield* foot().opacity(1, 0.5, easeOutCubic);
  yield* waitFor(1.8);
  yield* mask().opacity(1, 0.9, easeInOutCubic);
});
