/**
 * TranslationCatalog: Strictly OOP bilingual dictionary (ZH / EN) for Name Tag.
 * Follows DSH global language selection via ctx.locale and <html lang>.
 */
export class TranslationCatalog {
  static ZH = {
    // Common & Tab
    'tab.label': 'Name Tag',
    'common.close': '关闭',

    // Workspace & Split Pane
    'workspace.title': 'Name Tag · 实时物件分割工作台',
    'workspace.subtitle': 'FastSAM-s 端侧无类别实例分割 + 实时颗粒度抑制',
    'split.handleTitle': '拖动调整左右分栏比例（双击重置 50 / 50）',
    'workspace.enterFullscreen': '全屏显示',
    'workspace.exitFullscreen': '退出全屏 (Esc)',
    'workspace.escToast': '按 ESC 退出全屏',
    'panel.header': '功能区',

    // Camera Viewport & Controls
    'camera.title': '实时摄像头视窗',
    'camera.start': '开启摄像头',
    'camera.stop': '停止摄像头',
    'camera.mirror': '镜像',
    'camera.devicePlaceholder': '选择摄像头设备',
    'camera.idleTitle': '摄像头未开启',
    'camera.idleHint': '点击上方「开启摄像头」启动实时画面；首次开启将自动检查本地缓存并同步懒加载 FastSAM-s 与 EmbeddingGemma 2。',
    'camera.permissionDenied': '无法访问摄像头权限：{message}',
    'camera.resolution': '{w}×{h}',
    'camera.clickHint': '点击任意分割块可打开「目标标记」',

    // Camera Scope Editable Dropdown
    'scope.all': '所有',
    'scope.humanFace': '人脸',
    'scope.dropdownAria': '镜头类别筛选下拉框',
    'scope.inputPlaceholder': '输入内容并按回车添加...',
    'scope.addBtnTitle': '添加到下拉列表 (Enter)',
    'scope.editItemTitle': '编辑此项',
    'scope.deleteItemTitle': '删除此项',
    'scope.lockedHint': '默认项，不可编辑或删除',
    'scope.duplicateHint': '该选项已存在',
    'scope.reservedBuiltInHint': '该项为默认内置固定项',
    'scope.tipsBadge': 'Tips',
    'scope.tipsText': '可切换「所有 / 人脸」或输入自定义项按回车添加',
    'scope.thresholdLabel': '筛选置信度阈值',
    'scope.thresholdReset': '默认',
    'scope.hudLoading': '等待嵌入模型 · 筛选：{scope}',
    'scope.hudScanning': '正在筛选：{scope}...',
    'scope.hudMatched': '已筛选：{scope} · {count} 个 ({pct}%)',
    'scope.hudNotFound': '未发现：{scope}',

    // FastSAM-s & EmbeddingGemma 2 Models & Storage
    'model.label': 'FastSAM-s 模型',
    'model.idle': '未加载（按需懒加载）',
    'model.missingAlert': '本地未发现 FastSAM-s 模型，点击可按需懒加载',
    'model.checking': '正在检查本地缓存...',
    'model.downloading': '本地未命中，正在懒加载 {pct}% ({loaded}/{total} MB)...',
    'model.initializing': '正在初始化推理引擎 ({ep})...',
    'model.ready': '就绪 · {ep} ({source})',
    'model.error': '加载失败：{message}',
    'model.source.indexeddb': '浏览器本地缓存',
    'model.source.local-disk': '宿主机本地缓存',
    'model.source.remote-lazyload': '远程懒加载并已缓存',
    'model.source.local-file': '本地上传文件',
    'model.loadBtn': '预加载模型',
    'model.uploadBtn': '导入 .onnx',
    'model.clearCacheBtn': '清缓存',
    'db.clearBtn': '清空向量库',
    'db.clearBtnTitle': '仅清空当前浏览器中的向量数据库，保留已缓存的模型与颗粒度预设',
    'embed.label': 'EmbeddingGemma 2 模型',
    'embed.idle': '未加载（开启摄像头时自动懒加载）',
    'embed.loading': '正在懒加载 EmbeddingGemma 2 ({pct}%)...',
    'embed.ready': '就绪 · {ep} (768d 图像+文本)',
    'embed.error': '嵌入模型加载失败：{message}',
    'storage.pathsTitle': '客户端本地存储与缓存位置',
    'storage.vectorDb': '浏览器向量数据库 (LangChain IndexedDB)',
    'storage.vectorDbValue': 'IndexedDB (dsh-name-tag-vectors)',
    'storage.faissStats': '已存目标：{targets} 个 · 向量索引：{vectors} 条',
    'storage.prefsBrowser': '浏览器偏好与预设存储',
    'storage.prefsBrowserValue': 'localStorage (dsh-name-tag:preferences:v1)',
    'storage.browserCache': '浏览器模型缓存',
    'storage.browserValue': 'IndexedDB (dsh-name-tag-models) · Cache (transformers-cache)',
    'storage.modelPath': '宿主机只读模型镜像（无用户数据）',
    'storage.loading': '正在检测只读镜像...',

    // Auto-Capture Matching & Pocket
    'match.thresholdLabel': '捕捉匹配相似度阈值',
    'match.thresholdHint': '自动捕捉分割物件并与向量库比对，余弦相似度 ≥ 该阈值即收入“口袋”',
    'match.iouLabel': '识别框去重 IoU 阈值',
    'match.iouHint': '抑制重叠的识别边界框：同类目标按包含重叠度 max(IoU, IoM) ≥ 阈值自动剔除外层背景大框、只留紧凑内层目标；不同目标按标准 IoU 去重（往左更严格，1.00 关闭）',
    'match.topKLabel': '匹配候选 Top-K',
    'match.topKHint': '非「所有」筛选时向量库返回前 K 个达标不同目标（默认 Top 30，最高 500），在竞争间隔（≤0.08）内择优匹配当前筛选目标，避免被其他高分局部物体（如眼镜）遮挡',
    'match.resetDefault': '默认',
    'pocket.openBtn': '打开口袋',
    'pocket.title': '口袋',
    'pocket.empty': '暂未捕捉到匹配物品',
    'pocket.dragTitle': '按住拖动口袋窗口',
    'pocket.close': '收起口袋',

    // Granularity Panel
    'granularity.cardTitle': '“颗粒度”实时调控面板',
    'granularity.collapse': '折叠面板',
    'granularity.expand': '展开面板',
    'granularity.showProbLabel': '概率标签',
    'granularity.showProbLabelTitle': '在摄像头区域显示或隐藏置信度概率标签（不随预设保存）',
    'granularity.savePreset': '保存',
    'granularity.savePresetTitle': '保存当前颗粒度参数组合',
    'granularity.savedDropdownPlaceholder': '已保存 ({count})',
    'granularity.savedDropdownAria': '选择已保存的颗粒度设置',
    'granularity.savedItemPrefix': '预设 #{index}',
    'granularity.selectPresetTitle': '应用该预设',
    'granularity.editPresetTitle': '点击编辑名称（不影响选中状态）',
    'granularity.deletePresetTitle': '删除预设',
    'granularity.presetsLabel': '快速预设',
    'granularity.preset.coarse': '偏粗 (整物优先)',
    'granularity.preset.balanced': '均衡 (常规物体)',
    'granularity.preset.fine': '偏细 (含小件/部分零件)',
    'granularity.masterLabel': '综合颗粒度',
    'granularity.masterBadge.coarse': '{val} · 偏粗 (整物优先)',
    'granularity.masterBadge.balanced': '{val} · 均衡 (常规物体)',
    'granularity.masterBadge.fine': '{val} · 偏细 (含小件/部分零件)',
    'granularity.containLabel': '嵌套包含阈值 τ_nest',
    'granularity.containHint': '控制“大物体吞并内部小零件”的松紧度（例如用整张脸盖掉眼镜/嘴巴，用整车盖掉门把手）。往左调低：更容易合并内部细节，只留完整大物体；往右调高：保留更多物体内部的局部结构。',
    'granularity.minAreaLabel': '最小相对面积占比',
    'granularity.minAreaHint': '过滤掉在画面中占太小面积的零碎杂物。例如设为 2.0%，表示面积不到整个摄像头画面 2% 的小物件会被忽略。往右调大只看大件物体，往左调小可检出更远或更小的物体。',
    'granularity.confLabel': '置信度阈值 (Objectness)',
    'granularity.confHint': '模型对“这里确实是一个物体”的把握程度。往右调高可减少误检、只留最确定的主体；往左调低可检出更多模糊或不太起眼的物体。',
    'granularity.showSuppressed': '显示被抑制的子部件掩码（淡色轮廓）',
    'stats.kept': '保留分割数',
    'stats.suppressed': '已抑制子块',
    'stats.filterMs': '过滤耗时',
    'stats.inferMs': '推理耗时',
    'stats.fps': '实时帧率',

    // Target Tagging Modal
    'modal.title': '目标标记',
    'modal.subtitle': '透明背景前景抠图：原图 + 5 项经典增强（2×3 预览）',
    'modal.field.title': '标题',
    'modal.field.titlePlaceholder': '输入目标名称或标签...',
    'modal.field.description': '介绍',
    'modal.field.descriptionPlaceholder': '输入该物体的描述信息、特征或备注...',
    'modal.save': '保存',
    'modal.saving': '正在编码 6 组向量并存入浏览器向量库...',
    'modal.error.required': '「标题」和「介绍」均为必填项，请填写完整后再保存。',
    'modal.error.saveFailed': '保存失败：{message}',
    'modal.aug.original': '原图 (Original)',
    'modal.aug.flip': '水平翻转 (H-Flip)',
    'modal.aug.scale': '尺度缩放 (Scale)',
    'modal.aug.color': '色彩抖动 (Color Jitter)',
    'modal.aug.rotate': '轻微旋转 (+8°)',
    'modal.aug.blur': '轻微高斯模糊 (Blur)',

    // Vector Database Modal
    'db.openBtn': '数据库',
    'db.modalTitle': '向量数据库内容',
    'db.modalSubtitle': '共 {targets} 个目标 · {vectors} 条向量索引（可拖拽 title / description 右边界调节列宽）',
    'db.col.index': '索引 (index)',
    'db.col.augmentation': '增强 (augmentation)',
    'db.col.title': '标题 (title)',
    'db.col.description': '介绍 (description)',
    'db.col.timestamp': '存入时间 (timestamp)',
    'db.sortTimestampTitle': '点击切换时间排序（当前：{order}）',
    'db.sort.desc': '降序 DESC',
    'db.sort.asc': '升序 ASC',
    'db.empty': '浏览器向量库暂无数据，点击任意分割块并在「目标标记」中保存后即可在此查看。',
    'db.loading': '正在读取向量数据库...',
    'db.refresh': '刷新',
    'db.resizeHandleTitle': '左右拖拽调整列宽',
  }

  static EN = {
    // Common & Tab
    'tab.label': 'Name Tag',
    'common.close': 'Close',

    // Workspace & Split Pane
    'workspace.title': 'Name Tag · Live Object Segmentation Studio',
    'workspace.subtitle': 'Client-side FastSAM-s class-agnostic segmentation + real-time granularity filter',
    'split.handleTitle': 'Drag to resize split panes (double-click to reset 50 / 50)',
    'workspace.enterFullscreen': 'Enter fullscreen',
    'workspace.exitFullscreen': 'Exit fullscreen (Esc)',
    'workspace.escToast': 'Press ESC to exit fullscreen',
    'panel.header': 'Controls',

    // Camera Viewport & Controls
    'camera.title': 'Live Camera Viewport',
    'camera.start': 'Start Camera',
    'camera.stop': 'Stop Camera',
    'camera.mirror': 'Mirror',
    'camera.devicePlaceholder': 'Select camera device',
    'camera.idleTitle': 'Camera is Off',
    'camera.idleHint': 'Click "Start Camera" above to begin streaming. FastSAM-s and EmbeddingGemma 2 will check local cache first and lazy-load together.',
    'camera.permissionDenied': 'Camera access failed: {message}',
    'camera.resolution': '{w}×{h}',
    'camera.clickHint': 'Click any segment to open Target Tagging',

    // Camera Scope Editable Dropdown
    'scope.all': 'All',
    'scope.humanFace': 'Human Face',
    'scope.dropdownAria': 'Camera scope filter dropdown',
    'scope.inputPlaceholder': 'Type item and press Enter...',
    'scope.addBtnTitle': 'Add to dropdown list (Enter)',
    'scope.editItemTitle': 'Edit item',
    'scope.deleteItemTitle': 'Delete item',
    'scope.lockedHint': 'Built-in default (cannot edit or delete)',
    'scope.duplicateHint': 'Item already exists',
    'scope.reservedBuiltInHint': 'This is a built-in default item',
    'scope.tipsBadge': 'Tips',
    'scope.tipsText': 'Switch "All / Human Face" or type & press Enter to add',
    'scope.thresholdLabel': 'Filter Confidence',
    'scope.thresholdReset': 'Default',
    'scope.hudLoading': 'Waiting for Embedding · Scope: {scope}',
    'scope.hudScanning': 'Filtering: {scope}...',
    'scope.hudMatched': 'Filtered: {scope} · {count} ({pct}%)',
    'scope.hudNotFound': 'Not found: {scope}',

    // FastSAM-s & EmbeddingGemma 2 Models & Storage
    'model.label': 'FastSAM-s Model',
    'model.idle': 'Not loaded (Lazy-load)',
    'model.missingAlert': 'No local FastSAM-s model found; click to lazy-load',
    'model.checking': 'Checking local cache...',
    'model.downloading': 'Cache miss, lazy-loading {pct}% ({loaded}/{total} MB)...',
    'model.initializing': 'Initializing runtime ({ep})...',
    'model.ready': 'Ready · {ep} ({source})',
    'model.error': 'Load failed: {message}',
    'model.source.indexeddb': 'IndexedDB Cache',
    'model.source.local-disk': 'Host Disk Cache',
    'model.source.remote-lazyload': 'Lazy-loaded & Cached',
    'model.source.local-file': 'Local ONNX File',
    'model.loadBtn': 'Preload Model',
    'model.uploadBtn': 'Load .onnx',
    'model.clearCacheBtn': 'Clear Cache',
    'db.clearBtn': 'Clear Vector DB',
    'db.clearBtnTitle': 'Clear only the browser-local vector database (keeps models and presets)',
    'embed.label': 'EmbeddingGemma 2 Model',
    'embed.idle': 'Not loaded (Lazy-loads on camera start)',
    'embed.loading': 'Lazy-loading EmbeddingGemma 2 ({pct}%)...',
    'embed.ready': 'Ready · {ep} (768d Vision+Text)',
    'embed.error': 'Embedding load failed: {message}',
    'storage.pathsTitle': 'Client-Side Local Storage & Caches',
    'storage.vectorDb': 'Browser Vector DB (LangChain IndexedDB)',
    'storage.vectorDbValue': 'IndexedDB (dsh-name-tag-vectors)',
    'storage.faissStats': 'Targets: {targets} · Vector Indices: {vectors}',
    'storage.prefsBrowser': 'Browser Preferences & Presets',
    'storage.prefsBrowserValue': 'localStorage (dsh-name-tag:preferences:v1)',
    'storage.browserCache': 'Browser Model Caches',
    'storage.browserValue': 'IndexedDB (dsh-name-tag-models) · Cache (transformers-cache)',
    'storage.modelPath': 'Host Read-Only Model Mirror (No User Data)',
    'storage.loading': 'Checking read-only mirror...',

    // Auto-Capture Matching & Pocket
    'match.thresholdLabel': 'Capture Match Similarity',
    'match.thresholdHint': 'Auto-captured segments with cosine similarity ≥ this threshold enter the Pocket',
    'match.iouLabel': 'Recognition Dedup IoU',
    'match.iouHint': 'Suppresses overlapping recognized boxes: same-target uses max(IoU, IoM) to drop enclosing background walls at any distance while keeping the tighter inner object; different targets use standard IoU (lower = stricter, 1.00 = off)',
    'match.topKLabel': 'Match Candidates Top-K',
    'match.topKHint': 'Returns up to Top-K distinct vector DB targets (default Top 30, max 500) when filtering non-All scopes, selecting the best matching target within a 0.08 competitive margin of Top-1',
    'match.resetDefault': 'Default',
    'pocket.openBtn': 'Open Pocket',
    'pocket.title': 'Pocket',
    'pocket.empty': 'No matched objects yet',
    'pocket.dragTitle': 'Drag to move pocket window',
    'pocket.close': 'Close pocket',

    // Granularity Panel
    'granularity.cardTitle': '"Granularity" Real-Time Control Panel',
    'granularity.collapse': 'Collapse panel',
    'granularity.expand': 'Expand panel',
    'granularity.showProbLabel': 'Prob. Tags',
    'granularity.showProbLabelTitle': 'Show or hide confidence probability labels on camera overlay (not persisted)',
    'granularity.savePreset': 'Save',
    'granularity.savePresetTitle': 'Save current granularity settings',
    'granularity.savedDropdownPlaceholder': 'Saved ({count})',
    'granularity.savedDropdownAria': 'Select saved granularity preset',
    'granularity.savedItemPrefix': 'Preset #{index}',
    'granularity.selectPresetTitle': 'Apply this preset',
    'granularity.editPresetTitle': 'Click to edit name (keeps selection state)',
    'granularity.deletePresetTitle': 'Delete preset',
    'granularity.presetsLabel': 'Quick Presets',
    'granularity.preset.coarse': 'Coarse (Whole)',
    'granularity.preset.balanced': 'Balanced',
    'granularity.preset.fine': 'Fine (Parts)',
    'granularity.masterLabel': 'Master Granularity',
    'granularity.masterBadge.coarse': '{val} · Coarse (Whole Objects)',
    'granularity.masterBadge.balanced': '{val} · Balanced (General)',
    'granularity.masterBadge.fine': '{val} · Fine (With Sub-parts)',
    'granularity.containLabel': 'Containment Threshold τ_nest',
    'granularity.containHint': 'Controls how aggressively a large object absorbs inner parts (e.g., whole face hides glasses/mouth; whole car hides door handles). Lower (left): cleaner whole objects; Higher (right): keeps more inner sub-parts.',
    'granularity.minAreaLabel': 'Min Relative Area (%)',
    'granularity.minAreaHint': 'Ignores small fragments below this percentage of the camera frame (e.g., 2.0% drops objects covering less than 2% of the view). Higher (right): big subjects only; Lower (left): detects smaller/distant items.',
    'granularity.confLabel': 'Objectness Confidence',
    'granularity.confHint': 'Minimum certainty that a region is a real object. Higher (right): fewer false positives, main subjects only; Lower (left): catches fainter or less obvious objects.',
    'granularity.showSuppressed': 'Show suppressed sub-part masks (faint contour)',
    'stats.kept': 'Kept Masks',
    'stats.suppressed': 'Suppressed',
    'stats.filterMs': 'Filter Time',
    'stats.inferMs': 'Inference',
    'stats.fps': 'Detect FPS',

    // Target Tagging Modal
    'modal.title': 'Target Tagging',
    'modal.subtitle': 'Transparent foreground cutout: Original + 5 augmentations (2×3 grid)',
    'modal.field.title': 'Title',
    'modal.field.titlePlaceholder': 'Enter object name or tag...',
    'modal.field.description': 'Description',
    'modal.field.descriptionPlaceholder': 'Enter description, attributes, or notes...',
    'modal.save': 'Save',
    'modal.saving': 'Encoding 6 vectors & saving to Browser IndexedDB...',
    'modal.error.required': 'Both Title and Description are required before saving.',
    'modal.error.saveFailed': 'Save failed: {message}',
    'modal.aug.original': 'Original',
    'modal.aug.flip': 'Horizontal Flip',
    'modal.aug.scale': 'Scale Crop',
    'modal.aug.color': 'Color Jitter',
    'modal.aug.rotate': 'Slight Rotate (+8°)',
    'modal.aug.blur': 'Gaussian Blur',

    // Vector Database Modal
    'db.openBtn': 'Database',
    'db.modalTitle': 'Vector Database Contents',
    'db.modalSubtitle': '{targets} targets · {vectors} vector entries (drag right border of title / description to resize)',
    'db.col.index': 'Index',
    'db.col.augmentation': 'Augmentation',
    'db.col.title': 'Title',
    'db.col.description': 'Description',
    'db.col.timestamp': 'Timestamp',
    'db.sortTimestampTitle': 'Click to toggle timestamp sort ({order})',
    'db.sort.desc': 'DESC',
    'db.sort.asc': 'ASC',
    'db.empty': 'No vectors stored yet in browser IndexedDB. Click any segment and save in Target Tagging.',
    'db.loading': 'Loading vector database...',
    'db.refresh': 'Refresh',
    'db.resizeHandleTitle': 'Drag horizontally to resize column',
  }

  static getDictionaries() {
    return { zh: TranslationCatalog.ZH, en: TranslationCatalog.EN }
  }

  static detectEnglish() {
    if (typeof document === 'undefined') return false
    return Boolean(document.documentElement.lang && document.documentElement.lang.toLowerCase().startsWith('en'))
  }

  static interpolate(template, params) {
    if (!params) return template
    return template.replace(/\{(\w+)\}/g, function (_, key) {
      const value = params[key]
      return value === undefined ? '{' + key + '}' : String(value)
    })
  }

  static translate(key, boundTranslate, params) {
    if (typeof boundTranslate === 'function') {
      const localized = boundTranslate(key, params)
      if (localized && localized !== key) {
        return localized
      }
    }
    const dict = TranslationCatalog.detectEnglish() ? TranslationCatalog.EN : TranslationCatalog.ZH
    const raw = dict[key] || TranslationCatalog.ZH[key] || key
    return TranslationCatalog.interpolate(raw, params)
  }
}
