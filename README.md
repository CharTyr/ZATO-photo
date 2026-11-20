# ZATO 滤镜

将任意照片一键转换为 ZATO 风格的复古高反差像素颗粒背景工具，采用 Apple Liquid Glass 液态玻璃交互界面，纯浏览器本地运行（图片不会上传到任何服务器）。

## 在线体验

- **GitHub Pages**：https://chartyr.github.io/ZATO-photo/
- **Cloudflare Workers**：https://zato-bg-generator.ichar.workers.dev

## 功能特点

- **开箱即用**：内置 10 套风格预设，实时生成当前照片的缩略图预览，一键切换。
- **拖放与批量处理**：支持点击选图、拖放上传与 `Cmd/Ctrl + V` 粘贴；拖入多张图片自动进入批量转换模式。
- **实时动态环境光**：玻璃界面会根据当前画面色调柔和折射环境光；支持原图/成图分屏对比与拖拽裁切构图。
- **移动端适配**：手机端提供吸顶实时预览画布与底部液态玻璃抽屉（「风格 / 微调 / 专业」三分页）。
- **专业模式**：完整保留 7 步可开关处理管线——画布尺寸与裁切、6 种去色算法、CIE Lab / sRGB 调色板抖动、黑白阈值遮罩与染色、4 种上色模式（HSV 着色 / 二次调色板 / 渐变映射 / Grain Merge 渐变叠加）、交互式色调曲线与直方图、`.PAL / .GPL / .HEX` 色板导入导出、参考图色板提取、多通道叠加噪点、色调分离与 10 阶段分步预览。

## 本地开发与部署

```bash
npm install
npm run dev       # 启动本地开发服务器
npm test          # 运行核心图像管线单元测试
npm run build     # 构建单文件静态产物至 dist/index.html
npm run deploy    # 部署至 Cloudflare Workers
```

推送代码到 `main` 分支后，GitHub Actions（`.github/workflows/deploy-pages.yml`）会自动构建并部署到 GitHub Pages。
