// 全局变量
let currentStream = null;
let allCameras = [];
let currentCameraIndex = 0;

// DOM元素
const videoPreview = document.getElementById('videoPreview');
const loadingOverlay = document.getElementById('loadingOverlay');
const cameraType = document.getElementById('cameraType');
const resolution = document.getElementById('resolution');
const deviceLabel = document.getElementById('deviceLabel');
const zoomRange = document.getElementById('zoomRange');
const cameraCount = document.getElementById('cameraCount');
const cameraButtons = document.getElementById('cameraButtons');
const captureBtn = document.getElementById('captureBtn');
const refreshBtn = document.getElementById('refreshBtn');
const photoPreview = document.getElementById('photoPreview');
const photoCanvas = document.getElementById('photoCanvas');
const downloadBtn = document.getElementById('downloadBtn');
const closePhotoBtn = document.getElementById('closePhotoBtn');
const errorMessage = document. getElementById('errorMessage');
const detailsContent = document. getElementById('detailsContent');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    init();
    setupEventListeners();
});

// 事件监听
function setupEventListeners() {
    captureBtn.addEventListener('click', capturePhoto);
    refreshBtn.addEventListener('click', init);
    downloadBtn.addEventListener('click', downloadPhoto);
    closePhotoBtn. addEventListener('click', () => {
        photoPreview.classList. add('hidden');
    });
}

// 初始化摄像头
async function init() {
    try {
        showLoading(true);
        hideError();
        
        // 检查浏览器支持
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('您的浏览器不支持摄像头访问！请使用现代浏览器（Chrome、Safari等）');
        }

        // 首先请求权限
        await navigator.mediaDevices.getUserMedia({ video: true });
        
        // 获取所有摄像头
        await detectAllCameras();
        
        // 启动第一个摄像头
        if (allCameras.length > 0) {
            await switchCamera(0);
        } else {
            throw new Error('未检测到可用的摄像头');
        }
        
    } catch (error) {
        console.error('初始化失败:', error);
        showError(error.message);
        showLoading(false);
    }
}

// 检测所有摄像头
async function detectAllCameras() {
    try {
        const devices = await navigator.mediaDevices. enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        allCameras = [];
        
        for (const device of videoDevices) {
            try {
                // 获取摄像头流以获取能力信息
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { deviceId: { exact: device.deviceId } }
                });
                
                const track = stream.getVideoTracks()[0];
                const capabilities = track.getCapabilities();
                const settings = track.getSettings();
                
                // 分析摄像头类型
                const cameraInfo = analyzeCameraType(device, capabilities, settings);
                allCameras.push(cameraInfo);
                
                // 停止临时流
                track.stop();
                
            } catch (error) {
                console.error(`获取设备 ${device.label} 信息失败:`, error);
            }
        }
        
        // 更新UI
        updateCameraList();
        cameraCount.textContent = allCameras.length;
        
    } catch (error) {
        console.error('检测摄像头失败:', error);
        throw error;
    }
}

// 分析摄像头类型
function analyzeCameraType(device, capabilities, settings) {
    const label = device.label. toLowerCase();
    let type = '标准';
    let icon = '📷';
    
    // 判断前置/后置
    if (label.includes('front') || label.includes('前') || settings.facingMode === 'user') {
        type = '前置摄像头';
        icon = '🤳';
    } else if (label.includes('back') || label.includes('rear') || label.includes('后') || settings.facingMode === 'environment') {
        type = '后置摄像头';
        icon = '📷';
        
        // 进一步判断后置摄像头类型
        if (label.includes('ultra') || label.includes('wide') || label.includes('超广角') || label.includes('广角')) {
            type = '超广角/广角';
            icon = '🌄';
        } else if (label.includes('telephoto') || label.includes('tele') || label.includes('zoom') || label.includes('长焦')) {
            type = '长焦';
            icon = '🔭';
        } else if (label.includes('macro') || label.includes('微距')) {
            type = '微距';
            icon = '🔬';
        }
    }
    
    return {
        deviceId: device.deviceId,
        label: device.label,
        type: type,
        icon: icon,
        capabilities: capabilities,
        settings: settings,
        facingMode: settings.facingMode || '未知'
    };
}

// 更新摄像头列表
function updateCameraList() {
    cameraButtons.innerHTML = '';
    
    allCameras.forEach((camera, index) => {
        const button = document.createElement('button');
        button.className = 'camera-btn';
        button.innerHTML = `
            <div class="camera-icon">${camera.icon}</div>
            <div class="camera-btn-content">
                <div class="camera-btn-title">${camera.type}</div>
                <div class="camera-btn-label">${camera.label}</div>
            </div>
        `;
        button.addEventListener('click', () => switchCamera(index));
        cameraButtons.appendChild(button);
    });
}

// 切换摄像头
async function switchCamera(index) {
    try {
        showLoading(true);
        
        // 停止当前流
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        
        currentCameraIndex = index;
        const camera = allCameras[index];
        
        // 启动新的流
        currentStream = await navigator.mediaDevices.getUserMedia({
            video: {
                deviceId: { exact: camera.deviceId },
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        });
        
        videoPreview.srcObject = currentStream;
        
        // 更新当前摄像头信息
        updateCurrentCameraInfo(camera);
        
        // 更新按钮状态
        document.querySelectorAll('.camera-btn').forEach((btn, i) => {
            btn.classList.toggle('active', i === index);
        });
        
        showLoading(false);
        
    } catch (error) {
        console.error('切换摄像头失败:', error);
        showError('切换摄像头失败:  ' + error.message);
        showLoading(false);
    }
}

// 更新当前摄像头信息
function updateCurrentCameraInfo(camera) {
    const track = currentStream.getVideoTracks()[0];
    const settings = track.getSettings();
    
    cameraType.textContent = camera.type;
    deviceLabel.textContent = camera.label;
    resolution.textContent = `${settings.width} × ${settings.height}`;
    
    if (camera.capabilities.zoom) {
        zoomRange. textContent = `${camera.capabilities.zoom.min}x - ${camera.capabilities.zoom.max}x`;
    } else {
        zoomRange. textContent = '不支持';
    }
    
    // 更新详细信息
    updateDetailsPanel(camera, settings);
}

// 更新详细参数面板
function updateDetailsPanel(camera, settings) {
    const details = [
        { label: '设备ID', value: camera.deviceId. substring(0, 20) + '...' },
        { label: '朝向', value: camera.facingMode },
        { label: '宽度', value: settings.width + 'px' },
        { label: '高度', value:  settings.height + 'px' },
        { label: '宽高比', value: settings.aspectRatio?. toFixed(2) || '-' },
        { label: '帧率', value: settings.frameRate ?  settings.frameRate + ' fps' : '-' },
    ];
    
    if (camera.capabilities.focusDistance) {
        details.push({
            label: '焦距范围',
            value: `${camera.capabilities.focusDistance.min} - ${camera.capabilities.focusDistance.max}`
        });
    }
    
    if (camera.capabilities. exposureCompensation) {
        details.push({
            label: '曝光补偿',
            value: `${camera.capabilities.exposureCompensation.min} - ${camera. capabilities.exposureCompensation. max}`
        });
    }
    
    detailsContent.innerHTML = details. map(item => `
        <div class="detail-item">
            <span class="detail-label">${item.label}:</span>
            <span class="detail-value">${item. value}</span>
        </div>
    `).join('');
}

// 拍照
function capturePhoto() {
    if (!currentStream) {
        showError('请先启动摄像头');
        return;
    }
    
    const track = currentStream.getVideoTracks()[0];
    const settings = track.getSettings();
    
    photoCanvas.width = settings.width;
    photoCanvas.height = settings.height;
    
    const context = photoCanvas.getContext('2d');
    context.drawImage(videoPreview, 0, 0, photoCanvas.width, photoCanvas.height);
    
    photoPreview.classList.remove('hidden');
}

// 下载照片
function downloadPhoto() {
    const link = document.createElement('a');
    link.download = `camera-photo-${Date.now()}.png`;
    link.href = photoCanvas.toDataURL();
    link.click();
}

// 显示/隐藏加载状态
function showLoading(show) {
    if (show) {
        loadingOverlay.classList.remove('hidden');
    } else {
        loadingOverlay.classList.add('hidden');
    }
}

// 显示错误
function showError(message) {
    errorMessage.textContent = '❌ ' + message;
    errorMessage.classList.remove('hidden');
}

// 隐藏错误
function hideError() {
    errorMessage. classList.add('hidden');
}

// 页面卸载时停止流
window.addEventListener('beforeunload', () => {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track. stop());
    }
});