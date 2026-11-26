import {Img, Rect, Txt, Layout, Gradient} from '@motion-canvas/2d';
import {CREAM, GOLD, GOLD_SOFT, GREY, FONT} from './palette';

/** 全幅界面背景（20:9 拉伸到 2400×1080，比例一致不变形） */
export function backdrop(src: string, x = 150, width = 1980) {
  return <Img src={src} width={width} height={(width * 864) / 1920} x={x} y={0} />;
}

/** 左侧暗幕：把背景压暗，突出文字 */
export function scrim() {
  return (
    <Rect
      width={1920}
      height={1080}
      fill={
        new Gradient({
          type: 'linear',
          from: [-960, 0],
          to: [700, 0],
          stops: [
            {offset: 0, color: '#08070af5'},
            {offset: 0.4, color: '#08070aec'},
            {offset: 0.62, color: '#08070a95'},
            {offset: 0.82, color: '#08070a2a'},
            {offset: 1, color: '#08070a00'},
          ],
        })
      }
    />
  );
}

/** 章节号 + 金色细线 + 标题 + 副题 */
export function chapter(index: string, kicker: string, title: string) {
  return (
    <Layout layout direction={'column'} gap={18} alignItems={'flex-start'}>
      <Layout layout direction={'row'} alignItems={'center'} gap={18}>
        <Txt text={index} fill={GOLD} fontFamily={FONT} fontSize={26} fontWeight={800} opacity={0.9} />
        <Rect width={64} height={1} fill={GOLD_SOFT} />
        <Txt text={kicker} fill={GREY} fontFamily={FONT} fontSize={24} />
      </Layout>
      <Txt text={title} fill={CREAM} fontFamily={FONT} fontSize={78} fontWeight={900} />
      <Rect width={120} height={3} fill={GOLD} radius={2} />
    </Layout>
  );
}

/** 三条说明，左侧金色竖条 */
export function notes(lines: string[]) {
  return (
    <Layout layout direction={'column'} gap={22} alignItems={'flex-start'}>
      {lines.map((line) => (
        <Layout layout direction={'row'} alignItems={'center'} gap={18}>
          <Rect width={3} height={34} fill={GOLD_SOFT} radius={2} />
          <Txt text={line} fill={CREAM} fontFamily={FONT} fontSize={30} opacity={0.92} />
        </Layout>
      ))}
    </Layout>
  );
}

/** 右下角小标签 */
export function tag(text: string, x = 772, y = 436) {
  return (
    <Layout
      x={x}
      y={y}
      padding={[10, 22]}
      fill={'#08070acc'}
      radius={8}
      stroke={GOLD_SOFT}
      strokeWidth={1}
    >
      <Txt text={text} fill={GOLD} fontFamily={FONT} fontSize={22} />
    </Layout>
  );
}

/** 底部章节进度 */
export function chapters(total: number, active: number) {
  const cells: any[] = [];
  for (let i = 0; i < total; i++) {
    cells.push(
      <Rect width={i === active ? 46 : 16} height={4} radius={2} fill={i === active ? GOLD : '#4a4232'} />,
    );
  }
  return (
    <Layout layout direction={'row'} gap={12} x={0} y={500} alignItems={'center'}>
      {cells}
    </Layout>
  );
}

/** 左上角品牌 */
export function brand() {
  return (
    <Layout layout direction={'row'} alignItems={'center'} gap={10} x={-840} y={-486}>
      <Rect width={9} height={9} fill={GOLD} rotation={45} />
      <Txt text={'七圣召唤工具'} fill={GREY} fontFamily={FONT} fontSize={20} opacity={0.8} />
    </Layout>
  );
}

/** 转场黑幕 */
export function blackMask() {
  return <Rect width={1920} height={1080} fill={'#000000'} opacity={1} />;
}
