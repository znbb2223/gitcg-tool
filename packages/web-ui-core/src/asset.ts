// 资源基址：默认走官方 CDN，打包时可被 index.html 里的全局变量覆盖到本地目录
export const uiAssetBase = (): string =>
  (globalThis as { __UI_ASSET_BASE__?: string }).__UI_ASSET_BASE__ ??
  "https://ui-assets.piovium.org/";
