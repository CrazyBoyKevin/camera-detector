// 全局变量
let allCameras = [];
let currentStream = null;
let currentCameraIndex = 0;
let currentFacingMode = 'environment'; // 默认后置

// 检测微信浏览器和iOS
const isWeChat = /MicroMessenger/i.test(navigator.userAgent);
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isWeChatIOS = isWeChat && isIOS;

// DOM元素
const cameraCount = document.getElementById('cameraCount');
const refreshBtn = document.getElementById('refreshBtn');
const errorMessage = document.getElementById('errorMessage');
const loadingCard = document.getElementById('loadingCard');
const cameraList = document.getElementById('cameraList');
const previewModal = document.getElementById('previewModal');
const previewVideo = document.getElementById('previewVideo');
const closePreview = document.getElementById('closePreview');
const switchCamera = document.getElementById('switchCamera');
const cameraSelect = document.getElementById('cameraSelect');
const currentCameraName = document.getElementById('currentCameraName');
const currentResolution = document.getElementById('currentResolution');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 显示微信浏览器提示
    if (isWeChatIOS) {
        showWeChatTips();
    }

    init();
    refreshBtn.addEventListener('click', init);
    closePreview.addEventListener('click', closePreviewModal);
    switchCamera.addEventListener('click', handleSwitchCamera);
    cameraSelect.addEventListener('change', handleCameraSelect);

    // 微信iOS：点击视频区域尝试播放（解决自动播放限制）
    if (isWeChatIOS) {
        previewVideo.addEventListener('click', async () => {
            try {
                await previewVideo.play();
            } catch (e) {
                console.warn('手动播放失败', e);
            }
        });
    }
});

// 初始化检测
async function init() {
    try {
        showLoading(true);
        hideError();
        cameraList.innerHTML = '';

        // 检查浏览器支持
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('您的浏览器不支持摄像头访问！请使用现代浏览器（Chrome、Safari等）');
        }

        // 首先请求权限
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach(track => track.stop());

        // 检测所有摄像头
        await detectAllCameras();

        // 显示结果
        displayCameras();

        showLoading(false);

    } catch (error) {
        console.error('初始化失败:', error);
        showError(error.message || '无法访问摄像头，请检查权限设置');
        showLoading(false);
    }
}

// 检测所有摄像头
async function detectAllCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        // 去重：部分设备/浏览器会为同一物理摄像头暴露多个输入
        // 依据 groupId + 归一化 label 去重，以避免列表重复显示
        const seen = new Set();
        const uniqueVideoDevices = [];
        for (const d of videoDevices) {
            const key = `${d.groupId || ''}|${(d.label || '').toLowerCase()}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueVideoDevices.push(d);
            }
        }

        allCameras = [];

        for (let i = 0; i < uniqueVideoDevices.length; i++) {
            const device = uniqueVideoDevices[i];

            try {
                console.log(`正在检测摄像头 ${i + 1}/${uniqueVideoDevices.length}... `);

                // 获取摄像头流
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        deviceId: { exact: device.deviceId },
                        width: { ideal: 4096 },
                        height: { ideal: 2160 }
                    }
                });

                const track = stream.getVideoTracks()[0];
                const capabilities = track.getCapabilities();
                const settings = track.getSettings();

                // 分析摄像头类型
                const cameraInfo = {
                    index: i + 1,
                    deviceId: device.deviceId,
                    label: device.label || `摄像头 ${i + 1}`,
                    ...analyzeCameraType(device, capabilities, settings),
                    capabilities: capabilities,
                    settings: settings
                };

                allCameras.push(cameraInfo);

                // 停止流
                track.stop();

            } catch (error) {
                console.error(`获取设备 ${device.label} 信息失败: `, error);
            }
        }

        // 根据类型和朝向进行二次去重
        allCameras = dedupeCameras(allCameras);

        cameraCount.textContent = allCameras.length;

    } catch (error) {
        console.error('检测摄像头失败:', error);
        throw error;
    }
}

// 分析摄像头类型
function analyzeCameraType(device, capabilities, settings) {
    const label = device.label.toLowerCase();
    let type = '标准摄像头';
    let icon = '📷';
    let description = '';
    let orientation = '未知';
    let isExternal = false;

    // 检测外接摄像头的特征
    // 外接摄像头通常包含这些关键词：usb, external, webcam, obs, virtual, droidcam, iruin, capture等
    const externalKeywords = [
        'usb', 'external', 'webcam', 'obs', 'virtual', 'droidcam',
        'iruin', 'capture', 'iriun', 'epoccam', 'camo', 'logitech',
        'microsoft', 'creative', 'razer', 'elgato', 'hd pro'
    ];

    isExternal = externalKeywords.some(keyword => label.includes(keyword)) ||
        // 外接摄像头通常没有facingMode，或者label很长包含品牌信息
        (!settings.facingMode && label.length > 20);

    // 如果是外接摄像头
    if (isExternal) {
        type = '外接摄像头';
        icon = '🎥';
        description = '外接USB摄像头或虚拟摄像头';
        orientation = 'external';

        // 进一步判断是否为虚拟摄像头
        if (label.includes('virtual') || label.includes('obs') || label.includes('snap')) {
            type = '虚拟摄像头';
            icon = '💻';
            description = '软件虚拟摄像头（如OBS、Snap Camera等）';
        }
    }
    // 判断前置/后置
    else if (label.includes('front') || label.includes('前') || settings.facingMode === 'user') {
        type = '前置摄像头';
        icon = '🤳';
        description = '用于自拍和视频通话';
        orientation = 'front';
    } else if (label.includes('back') || label.includes('rear') || label.includes('后') || settings.facingMode === 'environment') {
        icon = '📷';
        orientation = 'back';

        // 进一步判断后置摄像头类型（优先匹配超广角，再匹配广角）
        if (label.includes('ultra') || label.includes('超广角')) {
            type = '超广角';
            icon = '🌄';
            description = '更宽的视野，适合风景和团体照';
        } else if (label.includes('wide') || label.includes('广角')) {
            type = '广角';
            icon = '🌄';
            description = '常规广角视野，适合日常拍摄';
        } else if (label.includes('telephoto') || label.includes('tele') || label.includes('zoom') || label.includes('长焦')) {
            type = '长焦摄像头';
            icon = '🔭';
            description = '拉近远处景物，适合人像和远景';
        } else if (label.includes('macro') || label.includes('微距')) {
            type = '微距摄像头';
            icon = '🔬';
            description = '超近距离拍摄细节';
        } else {
            // 默认把未明确标注的后置镜头归为广角（主摄）
            type = '广角';
            icon = '🌄';
            description = '常规广角视野，适合日常拍摄';
        }
    }

    return {
        type: type,
        icon: icon,
        description: description,
        facingMode: settings.facingMode || '未知',
        orientation: orientation,
        isExternal: isExternal
    };
}

// 按类型与朝向去重，保留更高分辨率的一个
function dedupeCameras(cameras) {
    const pickBetter = (a, b) => {
        const pa = (a.settings?.width || 0) * (a.settings?.height || 0);
        const pb = (b.settings?.width || 0) * (b.settings?.height || 0);
        return pa >= pb ? a : b;
    };
    const map = new Map();
    for (const cam of cameras) {
        // 外接摄像头不参与去重，保留所有
        if (cam.isExternal) {
            // 使用唯一的deviceId作为key
            map.set(`external_${cam.deviceId}`, cam);
            continue;
        }

        const orient = cam.orientation && cam.orientation !== '未知'
            ? cam.orientation
            : (cam.facingMode === 'environment' ? 'back' : (cam.facingMode === 'user' ? 'front' : 'unknown'));
        const key = `${cam.type}|${orient}`;
        if (!map.has(key)) {
            map.set(key, cam);
        } else {
            const current = map.get(key);
            map.set(key, pickBetter(current, cam));
        }
    }
    return Array.from(map.values());
}

// 显示摄像头信息
function displayCameras() {
    if (allCameras.length === 0) {
        cameraList.innerHTML = '<div class="camera-card"><p style="text-align: center;color:#999;">未检测到摄像头</p></div>';
        return;
    }

    cameraList.innerHTML = allCameras.map(camera => createCameraCard(camera)).join('');
}

// 创建摄像头卡片
function createCameraCard(camera) {
    const { settings, capabilities } = camera;

    return `
        <div class="camera-card">
            <div class="camera-header">
                <div class="camera-icon">${camera.icon}</div>
                <div class="camera-title-group">
                    <div class="camera-type">${camera.type}</div>
                    <div class="camera-label">${camera.label}</div>
                    ${camera.description ? `<div class="camera-label">${camera.description}</div>` : ''}
                </div>
                <button class="btn btn-preview" onclick="openPreview('${camera.deviceId}')">
                    📹 预览
                </button>
            </div>
            
            <!-- 基本参数 -->
            <div class="params-grid">
                <div class="param-item">
                    <div class="param-label">分辨率</div>
                    <div class="param-value">${settings.width} × ${settings.height}</div>
                </div>
                <div class="param-item">
                    <div class="param-label">宽高比</div>
                    <div class="param-value">${settings.aspectRatio ? settings.aspectRatio.toFixed(2) : '-'}</div>
                </div>
                <div class="param-item">
                    <div class="param-label">帧率</div>
                    <div class="param-value">${settings.frameRate ? settings.frameRate + ' fps' : '-'}</div>
                </div>
                <div class="param-item">
                    <div class="param-label">朝向</div>
                    <div class="param-value">${camera.facingMode === 'user' ? '前置' : camera.facingMode === 'environment' ? '后置' : camera.facingMode}</div>
                </div>
            </div>
            
            <!-- 详细参数 -->
            <div class="detailed-params">
                <div class="detailed-params-title">🔧 详细参数</div>
                
                ${createParamRow('设备ID', camera.deviceId.substring(0, 30) + '.. .')}
                
                ${capabilities.zoom ? createParamRow('缩放范围', `${capabilities.zoom.min}x - ${capabilities.zoom.max}x (步进: ${capabilities.zoom.step || 0.1})`) : ''}
                
                ${capabilities.focusDistance ? createParamRow('焦距范围', `${capabilities.focusDistance.min} - ${capabilities.focusDistance.max}`) : ''}
                
                ${capabilities.focusMode ? createParamRow('对焦模式', Array.isArray(capabilities.focusMode) ? capabilities.focusMode.join(', ') : capabilities.focusMode) : ''}
                
                ${capabilities.exposureMode ? createParamRow('曝光模式', Array.isArray(capabilities.exposureMode) ? capabilities.exposureMode.join(', ') : capabilities.exposureMode) : ''}
                
                ${capabilities.exposureCompensation ? createParamRow('曝光补偿', `${capabilities.exposureCompensation.min} - ${capabilities.exposureCompensation.max}`) : ''}
                
                ${capabilities.whiteBalanceMode ? createParamRow('白平衡模式', Array.isArray(capabilities.whiteBalanceMode) ? capabilities.whiteBalanceMode.join(', ') : capabilities.whiteBalanceMode) : ''}
                
                ${capabilities.colorTemperature ? createParamRow('色温范围', `${capabilities.colorTemperature.min}K - ${capabilities.colorTemperature.max}K`) : ''}
                
                ${capabilities.iso ? createParamRow('ISO范围', `${capabilities.iso.min} - ${capabilities.iso.max}`) : ''}
                
                ${capabilities.brightness ? createParamRow('亮度范围', `${capabilities.brightness.min} - ${capabilities.brightness.max}`) : ''}
                
                ${capabilities.contrast ? createParamRow('对比度范围', `${capabilities.contrast.min} - ${capabilities.contrast.max}`) : ''}
                
                ${capabilities.saturation ? createParamRow('饱和度范围', `${capabilities.saturation.min} - ${capabilities.saturation.max}`) : ''}
                
                ${capabilities.sharpness ? createParamRow('锐度范围', `${capabilities.sharpness.min} - ${capabilities.sharpness.max}`) : ''}
                
                ${capabilities.torch ? createParamRow('闪光灯', capabilities.torch ? '支持' : '不支持') : ''}
                
                ${capabilities.width ? createParamRow('支持最大宽度', `${capabilities.width.max} px`) : ''}
                
                ${capabilities.height ? createParamRow('支持最大高度', `${capabilities.height.max} px`) : ''}
                
                ${capabilities.frameRate ? createParamRow('帧率范围', `${capabilities.frameRate.min} - ${capabilities.frameRate.max} fps`) : ''}
                
                ${capabilities.aspectRatio ? createParamRow('宽高比范围', `${capabilities.aspectRatio.min?.toFixed(2)} - ${capabilities.aspectRatio.max?.toFixed(2)}`) : ''}
                
                ${capabilities.facingMode ? createParamRow('支持朝向', Array.isArray(capabilities.facingMode) ? capabilities.facingMode.join(', ') : capabilities.facingMode) : ''}
                
                ${capabilities.resizeMode ? createParamRow('调整模式', Array.isArray(capabilities.resizeMode) ? capabilities.resizeMode.join(', ') : capabilities.resizeMode) : ''}
            </div>
        </div>
    `;
}

// 创建参数行
function createParamRow(label, value) {
    if (!value || value === 'undefined - undefined') return '';
    return `
        <div class="param-row">
            <span class="param-row-label">${label}:</span>
            <span class="param-row-value">${value}</span>
        </div>
    `;
}

// 显示/隐藏加载状态
function showLoading(show) {
    if (show) {
        loadingCard.classList.remove('hidden');
    } else {
        loadingCard.classList.add('hidden');
    }
}

// 显示错误
function showError(message) {
    errorMessage.textContent = '❌ ' + message;
    errorMessage.classList.remove('hidden');
}

// 隐藏错误
function hideError() {
    errorMessage.classList.add('hidden');
}

// ========== 相机预览功能 ==========

// 打开预览（通过设备ID）
async function openPreview(deviceId = null) {
    try {
        previewModal.classList.remove('hidden');

        // 显示加载提示
        showVideoLoading(true);

        // 填充相机选择下拉框
        populateCameraSelect();

        if (deviceId) {
            // 使用指定的设备ID
            await startPreviewWithDeviceId(deviceId);
        } else {
            // 使用facingMode（前置或后置）
            await startPreviewWithFacingMode(currentFacingMode);
        }

        // 隐藏加载提示
        showVideoLoading(false);
    } catch (error) {
        console.error('打开预览失败:', error);
        showVideoLoading(false);
        alert('无法打开相机预览：' + error.message);
        closePreviewModal();
    }
}

// 使用设备ID启动预览
async function startPreviewWithDeviceId(deviceId) {
    stopCurrentStream();

    // 微信iOS优化：降低初始分辨率，避免加载失败
    const constraints = {
        video: {
            deviceId: { exact: deviceId },
            width: { ideal: isWeChatIOS ? 1280 : 1920 },
            height: { ideal: isWeChatIOS ? 720 : 1080 }
        },
        audio: false
    };

    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    previewVideo.srcObject = currentStream;

    // iOS/微信需要手动调用play
    if (isIOS || isWeChat) {
        try {
            await previewVideo.play();
        } catch (e) {
            console.warn('自动播放失败，等待用户交互', e);
        }
    }

    // 更新当前相机信息
    const camera = allCameras.find(c => c.deviceId === deviceId);
    updatePreviewInfo(camera);

    // 更新下拉框选中项
    cameraSelect.value = deviceId;
}

// 使用facingMode启动预览
async function startPreviewWithFacingMode(facingMode) {
    stopCurrentStream();

    // 微信iOS优化：降低初始分辨率，避免加载失败
    const constraints = {
        video: {
            facingMode: facingMode,
            width: { ideal: isWeChatIOS ? 1280 : 1920 },
            height: { ideal: isWeChatIOS ? 720 : 1080 }
        },
        audio: false
    };

    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    previewVideo.srcObject = currentStream;

    // iOS/微信需要手动调用play
    if (isIOS || isWeChat) {
        try {
            await previewVideo.play();
        } catch (e) {
            console.warn('自动播放失败，等待用户交互', e);
        }
    }

    // 获取实际使用的设备ID
    const track = currentStream.getVideoTracks()[0];
    const settings = track.getSettings();
    const deviceId = settings.deviceId;

    // 更新当前相机信息
    const camera = allCameras.find(c => c.deviceId === deviceId);
    updatePreviewInfo(camera);

    // 更新下拉框选中项
    if (deviceId) {
        cameraSelect.value = deviceId;
    }
}

// 填充相机选择下拉框
function populateCameraSelect() {
    cameraSelect.innerHTML = '<option value="">选择相机...</option>';

    allCameras.forEach(camera => {
        const option = document.createElement('option');
        option.value = camera.deviceId;
        option.textContent = `${camera.icon} ${camera.type} - ${camera.label}`;
        cameraSelect.appendChild(option);
    });
}

// 切换相机（前置/后置）
async function handleSwitchCamera() {
    try {
        // 切换facingMode
        currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
        await startPreviewWithFacingMode(currentFacingMode);
    } catch (error) {
        console.error('切换相机失败:', error);
        alert('切换相机失败：' + error.message);
    }
}

// 处理相机选择
async function handleCameraSelect(event) {
    const deviceId = event.target.value;
    if (!deviceId) return;

    try {
        await startPreviewWithDeviceId(deviceId);
    } catch (error) {
        console.error('选择相机失败:', error);
        alert('选择相机失败：' + error.message);
    }
}

// 更新预览信息
function updatePreviewInfo(camera) {
    if (camera) {
        currentCameraName.textContent = `${camera.icon} ${camera.type}`;

        // 等待视频元数据加载后获取实际分辨率
        previewVideo.addEventListener('loadedmetadata', () => {
            currentResolution.textContent = `${previewVideo.videoWidth} × ${previewVideo.videoHeight}`;
        }, { once: true });
    } else {
        currentCameraName.textContent = '-';
        currentResolution.textContent = '-';
    }
}

// 停止当前流
function stopCurrentStream() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}

// 关闭预览窗口
function closePreviewModal() {
    stopCurrentStream();
    previewModal.classList.add('hidden');
    previewVideo.srcObject = null;
    currentCameraName.textContent = '-';
    currentResolution.textContent = '-';
    cameraSelect.value = '';
}

// 显示微信浏览器提示
function showWeChatTips() {
    const tipsDiv = document.createElement('div');
    tipsDiv.className = 'wechat-tips';
    tipsDiv.innerHTML = `
        <div class="tips-content">
            <span class="tips-icon">💡</span>
            <div class="tips-text">
                <strong>微信浏览器提示</strong>
                <p>检测到您正在使用iOS微信浏览器。为获得最佳体验：</p>
                <ul>
                    <li>首次使用请允许相机权限</li>
                    <li>如预览黑屏，请点击视频区域激活</li>
                    <li>部分高级功能可能受限</li>
                </ul>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="tips-close">知道了</button>
        </div>
    `;
    document.body.insertBefore(tipsDiv, document.querySelector('.container'));
}

// 显示/隐藏视频加载提示
function showVideoLoading(show) {
    const container = document.querySelector('.preview-container');
    let loadingDiv = container.querySelector('.video-loading');

    if (show) {
        if (!loadingDiv) {
            loadingDiv = document.createElement('div');
            loadingDiv.className = 'video-loading';
            loadingDiv.innerHTML = `
                <div class="spinner"></div>
                <p>正在启动相机...</p>
            `;
            container.appendChild(loadingDiv);
        }
    } else {
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }
}
