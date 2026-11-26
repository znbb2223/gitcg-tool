import {makeScene2D, Txt, Rect, Layout, Circle} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, easeOutBack, easeOutCubic, waitFor} from '@motion-canvas/core';
import {INK, GOLD, CREAM, GREY, FONT} from './palette';

export default makeScene2D(function* (view) {
  const diamond = createRef<Rect>();
  const lineA = createRef<Rect>();
  const lineB = createRef<Rect>();
  const titleTop = createRef<Txt>();
  const titleBottom = createRef<Txt>();
  const sub = createRef<Txt>();
  const foot = createRef<Txt>();
  const mask = createRef<Rect>();

  view.add(
    <>
      <Rect width={1920} height={1080} fill={INK} />
      <Circle size={1500} fill={'#1a150e'} y={-380} opacity={0.55} />
      <Rect ref={diamond} width={16} height={16} fill={GOLD} rotation={45} y={-300} scale={0} />
      <Rect ref={lineA} width={0} height={1} fill={'#8b7a58'} x={-320} y={-250} />
      <Rect ref={lineB} width={0} height={1} fill={'#8b7a58'} x={320} y={-250} />
      <Txt
        ref={titleTop}
        text={'七圣召唤'}
        fill={CREAM}
        fontFamily={FONT}
        fontSize={150}
        fontWeight={900}
        y={-60}
        opacity={0}
        letterSpacing={12}
      />
      <Txt
        ref={titleBottom}
        text={'工具'}
        fill={GOLD}
        fontFamily={FONT}
        fontSize={150}
        fontWeight={900}
        y={120}
        opacity={0}
        letterSpacing={26}
      />
      <Txt
        ref={sub}
        text={'离线 · 零权限 · 自带 AI'}
        fill={GREY}
        fontFamily={FONT}
        fontSize={34}
        y={290}
        opacity={0}
        letterSpacing={4}
      />
      <Txt
        ref={foot}
        text={'数据版本 7.2.0   |   不联网   |   不上传任何数据'}
        fill={'#6f6552'}
        fontFamily={FONT}
        fontSize={22}
        y={430}
        opacity={0}
      />
      <Rect ref={mask} width={1920} height={1080} fill={'#000000'} opacity={1} />
    </>,
  );

  yield* mask().opacity(0, 0.45, easeOutCubic);
  yield* diamond().scale(1, 0.5, easeOutBack);
  yield* all(
    lineA().width(230, 0.6, easeOutCubic),
    lineB().width(230, 0.6, easeOutCubic),
  );
  yield* all(
    titleTop().opacity(1, 0.7, easeOutCubic),
    titleTop().y(-80, 1.0, easeOutCubic),
  );
  yield* all(
    titleBottom().opacity(1, 0.6, easeOutCubic),
    titleBottom().y(100, 0.8, easeOutCubic),
  );
  yield* all(sub().opacity(1, 0.6, easeOutCubic), foot().opacity(1, 0.6, easeOutCubic));
  yield* waitFor(1.6);
  yield* mask().opacity(1, 0.35, easeInOutCubic);
});
