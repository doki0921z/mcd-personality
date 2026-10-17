# 🍟 麦麦人格研究所

5 道题找到你的麦当劳人格，现有 9 种结果，包含麦辣鸡翅与菠萝派。原创 8bit 像素食物角色、移动端适配、可关闭的 Web Audio 音效、1080 × 1440 PNG 分享卡和结果二维码。

在线地址：https://doki0921z.github.io/mcd-personality/

## 使用与部署

纯 HTML / CSS / JavaScript，网页运行无需构建、后端或数据库，访客无需提供 API Key。运行 `python -m http.server 8765 --bind 127.0.0.1` 后，通过 `http://dev.mihoyo.com:8765` 预览。该域名需解析到 127.0.0.1。

GitHub Pages：Settings → Pages → Deploy from a branch → main → / (root)。仓库包含 `.nojekyll`。

## 分享到微信

完成答题后点击“打包我的快乐卡”，长按图片保存，再从微信相册发送给好友或发朋友圈。分享图为预生成的 1080×1440 PNG，使用固定 HTTPS 地址，微信内不调用 Blob 下载或 Web Share；提供“打开原图”备用入口。普通浏览器支持 Web Share 文件分享时才显示系统分享按钮，是否提供微信目标由设备决定。

每种人格都有 `share/<id>.html` 独立结果页，包含对应的静态标题、描述和 HTTPS 分享图元信息。答题结束后同步浏览器结果地址。通用网页元信息不代表已获微信自定义分享权限；本项目未接入微信公众号 JS-SDK、公众号安全域名或签名服务，微信菜单能否转发还取决于客户端和域名状态。

结果链接 `share/fries.html` 只包含人格标识，打开会展示朋友的人格卡，并提供重新测试入口；兼容旧链接 `?r=fries`。答题数据仅在当前页面内存中计算，无账号、无埋点、无上传。

## 麦当劳公开资料与点餐

结果页的“快乐加餐站”展示对应餐品的营养参考值，以及麦麦活动日历。资料由维护者通过麦当劳官方 MCP 的 `list-nutrition-foods` 和 `campaign-calendar` 工具本地同步至 `assets/mcd-public-data.json`，页面标注更新时间。这是同步时的记录，不是实时接口；跨月后标为活动回顾。

更新资料时，在本地环境变量中提供 `MCD_MCP_TOKEN`，运行 `python scripts/sync-mcd-data.py`。脚本只允许上述两个只读工具，仅发布筛选后的公共营养和日历字段，不发布订阅状态、优惠券码、账户信息或原始响应。任一查询失败时保留上次资料。令牌不保存到网页源码、浏览器或仓库；不要把令牌写进命令示例或配置文件后提交。

“立刻下单”跳转到 `https://mcd.cn/` 麦当劳官方点餐，访客在那里登录、选择门店和餐品、确认订单并付款。本站不代下单，也不收集登录信息。此入口不向官方页面预填购物车。营养资料、日历及点餐入口均不进入原有分享海报。

## 麦当劳股价

结果页用原生 SVG 绘制 `NYSE:MCD` 美元股价，支持近1个月、3个月、6个月、1年切换，以及触摸、鼠标和键盘滑块查看每日价格。图表、样式与数据均从本站加载，不依赖 TradingView、外部图表脚本、字体 CDN 或访客浏览器跨域请求行情 API，不需要付费图表库、账号或 API Key，也不进入分享海报。

`assets/mcd-stock-data.json` 保存腾讯财经公开行情中的前复权日收盘参考值（最近320个交易日），来源链接为 https://gu.qq.com/usMCD.N 。页面标注最近交易日、美东日期、同步日期和“非实时”；超过7天未更新时提示数据更新较慢。上游公开接口没有稳定性承诺，接口访问不代表取得商业数据转售授权。

运行 `python scripts/sync-stock-data.py` 更新快照；验证失败时保留上次文件，数据未变化时不改写同步日期。`.github/workflows/refresh-stock.yml` 在北京时间周二至周六09:37尝试刷新，更新成功后提交数据并请求 Pages 重建；也支持手动触发。GitHub 的定时任务可能延迟，数据不是实时行情。这里的图表展示取决于本站可达性，不再依赖访客访问海外行情域名；未宣称完成中国大陆三网测试。

## 验证

分享图片和 HTML 可用 `scripts/build-share-assets.py` 重新生成；需要 Node.js、Python，以及 `scripts/requirements-build.txt` 列出的构建包。可将这些包安装到 `.build/vendor`，不会作为网页运行依赖发布。修改 `data.js`、`art.js`、`index.html` 或部署域名后应重新生成；生成器的 `PUBLIC` 为部署根地址。

`npm test` 或 `node --test tests/*.test.js`，覆盖全部 1,024 种答题组合、结果可达性、确定性与输入验证。

## 资源与授权

食物像素插画由本项目代码绘制。二维码使用 qrcode-generator 1.4.4（MIT）。像素字体为 Fusion Pixel 的网页文案子集（SIL Open Font License），随附原始授权；子集名称为 Happy Pixel Subset。

这是非官方的娱乐创作，与麦当劳品牌无关联。测评不构成科学或心理诊断。GitHub Pages 在中国大陆的可达性取决于当地网络，本项目未宣称完成三网或微信真机验收。
