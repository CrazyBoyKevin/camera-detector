# 📸 手机摄像头检测器

一个用于检测和测试手机摄像头类型的H5项目，可以识别广角、长焦、超广角等不同类型的摄像头。

## ✨ 功能特性

- 🎥 **自动检测** - 自动检测手机上所有可用摄像头
- 🔍 **类型识别** - 识别摄像头类型（前置、后置、广角、长焦、超广角、微距等）
- 🔄 **实时切换** - 在不同摄像头间自由切换
- 📸 **拍照功能** - 支持拍照和下载照片
- 📊 **详细参数** - 显示分辨率、缩放范围、焦距等详细参数
- 🎨 **精美UI** - 现代化的移动端界面设计

## 🚀 使用方法

### 在线使用

1. 将项目部署到支持HTTPS的服务器（GitHub Pages、Vercel等）
2. 使用手机浏览器访问
3. 允许摄像头权限
4. 开始检测！

### 本地测试

```bash
# 使用任何支持HTTPS的本地服务器，例如：

# 方法1: 使用Python
python -m http.server 8000

# 方法2: 使用Node.js的http-server
npx http-server -p 8000

# 注意：本地测试可能需要配置HTTPS证书
```

## 📱 部署到 GitHub Pages

1. 创建新的GitHub仓库
2. 上传所有文件
3. 进入仓库设置 (Settings)
4. 找到 Pages 设置
5. 选择 main 分支作为源
6. 保存后即可通过 `https://你的用户名.github.io/仓库名` 访问

## 🔧 技术说明

### 核心API

- **MediaDevices.getUserMedia()** - 获取摄像头访问权限
- **MediaDevices.enumerateDevices()** - 枚举所有媒体设备
- **MediaStreamTrack.getCapabilities()** - 获取摄像头能力参数
- **MediaStreamTrack.getSettings()** - 获取当前设置

### 摄像头类型识别

通过以下方法识别摄像头类型：

1. **设备标签分析** - 分析设备名称中的关键词
   - `ultra`、`wide` → 超广角/广角
   - `telephoto`、`tele`、`zoom` → 长焦
   - `macro` → 微距
   - `front` → 前置
   - `back`、`rear` → 后置

2. **FacingMode** - 通过facingMode判断前后置
   - `user` → 前置
   - `environment` → 后置

3. **能力参数** - 通过zoom、focusDistance等参数辅助判断

## 📋 浏览器兼容性

| 浏览器 | 支持情况 | 说明 |
|--------|---------|------|
| Chrome (Android) | ✅ 完全支持 | 推荐使用 |
| Safari (iOS) | ✅ 支持 | iOS 14. 3+ |
| Firefox (Android) | ✅ 支持 | - |
| Edge (Android) | ✅ 支持 | - |
| 微信浏览器 | ⚠️ 部分支持 | 可能需要额外权限 |
| UC浏览器 | ⚠️ 部分支持 | 兼容性较差 |

## ⚠️ 注意事项

1. **HTTPS必需** - 摄像头API只能在HTTPS环境下使用（localhost除外）
2. **权限授予** - 首次使用需要用户授予摄像头权限
3. **设备差异** - 不同手机厂商的设备标签可能不同
4. **API支持** - 部分旧设备可能不支持所有API

## 🛠️ 文件结构

```
camera-detector/
├── index.html          # 主页面
├── css/
│   └── style. css      # 样式文件
├── js/
│   └── camera.js      # 核心逻辑
└── README.md          # 说明文档
```

## 📝 开发说明

项目使用纯原生JavaScript开发，无任何第三方依赖，易于学习和修改。

### 主要函数

- `init()` - 初始化应用
- `detectAllCameras()` - 检测所有摄像头
- `analyzeCameraType()` - 分析摄像头类型
- `switchCamera()` - 切换摄像头
- `capturePhoto()` - 拍照功能

## 📄 许可证

MIT License - 自由使用和修改

## 🤝 贡献

欢迎提交Issue和Pull Request！

---

💡 **提示**:  在现代手机上效果最佳，建议使用Chrome或Safari浏览器。