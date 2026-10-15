# 🍟 麦麦人格研究所

5 道题找到你的麦当劳人格。原创 8bit 像素食物角色、移动端适配、可关闭的 Web Audio 音效、1080 × 1440 PNG 分享卡和结果二维码。

在线地址：https://doki0921z.github.io/mcd-personality/

## 使用与部署

纯 HTML / CSS / JavaScript，无需构建、后端、数据库或 API Key。运行 `python -m http.server 8765 --bind 127.0.0.1` 后，通过 `http://dev.mihoyo.com:8765` 预览。该域名需解析到 127.0.0.1。

GitHub Pages：Settings → Pages → Deploy from a branch → main → / (root)。仓库包含 `.nojekyll`。

## 分享到微信

完成答题后点击“打包我的快乐卡”，保存图片后发送给微信好友或朋友圈。在微信内置浏览器中可长按图片保存；浏览器支持 Web Share 文件分享时会出现系统分享按钮，是否提供微信目标由设备决定。未接入微信公众平台 JS-SDK，不承诺自定义微信链接卡片或一键发朋友圈。

结果链接 `?r=fries` 只包含人格标识，打开会展示朋友的人格卡，并提供重新测试入口。答题数据仅在当前页面内存中计算，无账号、无埋点、无上传。

## 验证

`npm test` 或 `node --test tests/*.test.js`，覆盖全部 1,024 种答题组合、结果可达性、确定性与输入验证。

## 资源与授权

食物像素插画由本项目代码绘制。二维码使用 qrcode-generator 1.4.4（MIT）。像素字体为 Fusion Pixel 的网页文案子集（SIL Open Font License），随附原始授权；子集名称为 Happy Pixel Subset。

这是非官方的娱乐创作，与麦当劳品牌无关联。测评不构成科学或心理诊断。GitHub Pages 在中国大陆的可达性取决于当地网络，本项目未宣称完成三网或微信真机验收。
