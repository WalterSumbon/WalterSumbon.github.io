# 项目约定

- 重建 WalterSumbon.github.io，站点为无构建步骤的 HTML/CSS/JavaScript；浏览器加载并渲染 Markdown。禁止重新引入 Hexo、站点 HTML 编译产物或假数据。
- 仓库路径 ~/work/WalterSumbon.github.io；使用 main 分支发布，用户已授权推送并上线。旧站可在 Git 历史中恢复。
- 每篇文章只维护 content/posts/ 下一个 .md 文件；元数据写在 YAML front matter。图片独立放 assets/posts/ 下。文章列表仅列文件路径，由工具扫描生成，不重复维护文章元数据。
- 已从旧 Hexo HTML 恢复 4 篇文章、17 张资源图片和 39 个代码块。保留原作者、日期、标签和 legacyPath。原稿不可获得，恢复不等于字节级还原。修复了两处括号图片路径和公式下标渲染损坏；不改写原文中的知识结论。
- 文章集和游戏集独立维护有序成员列表；允许多对多。成员只在集合文件维护。
- 游戏 G001 为 SVG Flappy Bird，G002 为带 AI 的五子棋，G003 为合成大西瓜。初始 gameVersion 和 saveVersion 为 1.0.0。
- 每游戏有独立榜，总榜为各游戏个人最高分乘可配置系数后相加，初始系数均为 1。使用稳定游戏 ID 关联存档与成绩；游戏版本、存档格式版本、计分版本分开管理。
- 用户允许免费托管服务，无需自己维护服务器。Giscus 承载 GitHub 登录评论与反应，旧 Issues 保留为迁移来源。共享排行榜使用 Supabase 项目 etcpqxthiobgrkomyfae，数据库和 OAuth 待配置；不能把本机高分冒充全球榜。
- 存档由每个游戏页面的存档服务负责写入，按游戏 ID 命名，使用 IndexedDB 事务；多标签页需明确互斥写入所有权。旧格式不兼容时保留原数据，显式提示导出或新建，禁止静默覆盖。
- 游戏逻辑、存档、远程成绩、UI 分离；测试统一放 tests/；注释和文档字符串使用中文。
- 视觉采用简洁的编辑式布局、克制配色；游戏卡片保留，文章列表不用堆叠卡片、渐变大标题或营销文案。

## 开发与验证

- `npm ci` 安装本地工具；`npm run dev` 在 http://127.0.0.1:4173 启动预览。浏览器所需依赖已锁定并保存到 vendor/，普通访问不依赖外部 CDN。
- `npm run check` 校验 YAML 元数据、公式、图片、游戏版本及集合引用；`npm test` 运行 tests/ 中的核心规则与存档测试。`npm run index` 仅生成文章文件列表，不编译文章。开发服务器读取列表时自动扫描，GitHub Actions 发布时自动扫描。
- 文本内容以 Markdown 为唯一来源。旧站恢复基线为 1dfb776537220bcb36d3dda539ee621695b4fc0d；保留 39 个代码块、表格、上下标、图片。另修复 LC-3 测试数据中乘号误解析为斜体的问题。旧文章网址由 404.html 转到新阅读页面。
- 本地完成：博客、全文检索、标签、文章集、游戏集、3 个游戏、版本化自动存档、导入导出、游戏榜和总榜界面。9 项核心测试通过；实际 Chrome 检查了正文搜索、公式、Flappy 游戏结束、AI 落子、五子棋刷新恢复、西瓜合并计分和刷新恢复、旧文章跳转、390px 游戏列表布局。
- 本地预览状态与线上发布区分：2026-10-29 已推送 main，Actions 运行 40731150278 发布成功，公网文章目录可访问；Supabase 正在引导配置。不得虚称全球榜、登录、统计或评论已完成线上验证。

## 服务配置待办

- src/config.js 仅保存公开连接配置。Supabase 使用公开 publishable/anon key，绝不能放 service_role key 或 GitHub OAuth secret。
- Supabase 中启用 GitHub Provider 并配置 OAuth 回调，允许站点及本地开发的 redirect URL；应用登录和 Giscus 登录是两套授权流程。
- `node scripts/service-sql.mjs` 输出数据库初始化 SQL；在新 Supabase 项目执行。前端不能直接写表，只能经 submit_score 函数，用户 ID 从登录会话取得，原子 upsert 只保留最高分。get_ranking 返回当前计分版本的前 100 名。
- 系数和计分版本的唯一编辑入口是 content/games.json。修改后用 `node scripts/service-sql.mjs --rules-only` 输出同步 SQL，在数据库中执行后生效；服务器负责全站总分计算。所有分数由客户端上报，目前属于休闲排行榜，不具备服务端对局回放验真。
- Giscus 已开启 Discussions、安装 App，使用 Announcements 分类，公开连接配置已填入。旧 Issue #1/#2/#3 尚未转换，转换时保持标题；新代码保留旧 Issue 入口。Giscus 支持一级评论与回复，不能承诺无限树状嵌套。
- GoatCounter 站点 waltersumbon 已接入并保存启用公开计数，账号邮箱待用户验证。页面访问与实际开局分开记录；封面预览不计入游玩。
- 发布流程在 .github/workflows/pages.yml：校验和测试后打包静态源文件，经 GitHub Pages Actions 发布。没有生成文章 HTML，也不需要源码/产物双分支。
