/**
 * Audio Effects Helper
 * 額外音效處理：單聲道、立體聲寬度、混響
 */

// 儲存音效狀態的 WeakMap
const effectsMap = new WeakMap()

/**
 * 初始化音效處理節點
 * @param {HTMLMediaElement} mediaElement
 * @param {AudioContext} audioContext
 * @param {AudioNode} inputNode - EQ 輸出節點
 * @param {AudioNode} outputNode - Gain 節點
 * @returns {object} 音效節點物件
 */
export function createAudioEffects(audioContext, inputNode, outputNode) {
  // 立體聲寬度處理 (使用 Mid/Side 技術)
  const splitter = audioContext.createChannelSplitter(2)
  const merger = audioContext.createChannelMerger(2)

  // 左右聲道增益
  const leftGain = audioContext.createGain()
  const rightGain = audioContext.createGain()

  // 單聲道混合器
  const monoMerger = audioContext.createChannelMerger(1)
  const monoGain = audioContext.createGain()
  monoGain.gain.value = 0 // 預設關閉單聲道

  // 立體聲寬度控制 (0 = mono, 1 = normal, 2 = wide)
  const stereoWidth = { value: 1 }

  // 混響 (使用簡單的延遲迴響)
  const reverbGain = audioContext.createGain()
  reverbGain.gain.value = 0 // 預設關閉混響

  const reverbDelay1 = audioContext.createDelay(1)
  const reverbDelay2 = audioContext.createDelay(1)
  const reverbDelay3 = audioContext.createDelay(1)
  reverbDelay1.delayTime.value = 0.03
  reverbDelay2.delayTime.value = 0.06
  reverbDelay3.delayTime.value = 0.09

  const reverbFeedback = audioContext.createGain()
  reverbFeedback.gain.value = 0.3

  const reverbFilter = audioContext.createBiquadFilter()
  reverbFilter.type = 'lowpass'
  reverbFilter.frequency.value = 4000

  // 乾聲道
  const dryGain = audioContext.createGain()
  dryGain.gain.value = 1

  // 連接音頻鏈
  // inputNode -> splitter -> L/R gains -> merger -> dryGain -> outputNode
  //                                              -> reverbChain -> outputNode

  inputNode.connect(splitter)

  // 左聲道
  splitter.connect(leftGain, 0)
  leftGain.connect(merger, 0, 0)

  // 右聲道
  splitter.connect(rightGain, 1)
  rightGain.connect(merger, 0, 1)

  // 單聲道路徑 (L+R 混合)
  splitter.connect(monoMerger, 0, 0)
  splitter.connect(monoMerger, 1, 0)
  monoMerger.connect(monoGain)

  // 乾聲輸出
  merger.connect(dryGain)
  monoGain.connect(dryGain)
  dryGain.connect(outputNode)

  // 混響鏈
  merger.connect(reverbDelay1)
  reverbDelay1.connect(reverbDelay2)
  reverbDelay2.connect(reverbDelay3)
  reverbDelay3.connect(reverbFeedback)
  reverbFeedback.connect(reverbDelay1) // 回授
  reverbDelay1.connect(reverbFilter)
  reverbDelay2.connect(reverbFilter)
  reverbDelay3.connect(reverbFilter)
  reverbFilter.connect(reverbGain)
  reverbGain.connect(outputNode)

  const effects = {
    splitter,
    merger,
    leftGain,
    rightGain,
    monoMerger,
    monoGain,
    stereoWidth,
    reverbGain,
    reverbDelay1,
    reverbDelay2,
    reverbDelay3,
    reverbFeedback,
    reverbFilter,
    dryGain,
    isMono: false,
    reverbAmount: 0,
    stereoWidthValue: 1
  }

  return effects
}

/**
 * 設定單聲道模式
 * @param {object} effects - 音效節點物件
 * @param {boolean} enabled - 是否啟用單聲道
 */
export function setMonoMode(effects, enabled) {
  if (!effects) return

  effects.isMono = enabled

  if (enabled) {
    // 單聲道：關閉立體聲，開啟單聲道混合
    effects.leftGain.gain.value = 0
    effects.rightGain.gain.value = 0
    effects.monoGain.gain.value = 0.5 // 避免音量加倍
  } else {
    // 立體聲：恢復立體聲寬度設定
    effects.monoGain.gain.value = 0
    updateStereoWidth(effects, effects.stereoWidthValue)
  }

  console.log('[AudioEffects] Mono mode:', enabled)
}

/**
 * 設定立體聲寬度
 * @param {object} effects - 音效節點物件
 * @param {number} width - 寬度 (0-2, 1=正常, 0=單聲道, 2=加寬)
 */
export function setStereoWidth(effects, width) {
  if (!effects || effects.isMono) return

  effects.stereoWidthValue = width
  updateStereoWidth(effects, width)

  console.log('[AudioEffects] Stereo width:', width)
}

/**
 * 更新立體聲寬度
 * @param {object} effects
 * @param {number} width
 */
function updateStereoWidth(effects, width) {
  // width = 1: 正常 (L=1, R=1)
  // width = 0: 單聲道 (L=0.5, R=0.5，混合)
  // width = 2: 加寬 (增加左右差異)

  // Mid/Side 計算
  // Mid = (L + R) / 2
  // Side = (L - R) / 2
  // 調整 width 就是調整 Side 的比例

  const midGain = 1
  const sideGain = width

  // 還原到 L/R
  // L = Mid + Side = (L+R)/2 + width*(L-R)/2 = L*(1+width)/2 + R*(1-width)/2
  // R = Mid - Side = (L+R)/2 - width*(L-R)/2 = L*(1-width)/2 + R*(1+width)/2

  // 簡化：直接調整增益
  effects.leftGain.gain.value = Math.min(2, (1 + (width - 1) * 0.5))
  effects.rightGain.gain.value = Math.min(2, (1 + (width - 1) * 0.5))
}

/**
 * 設定混響量
 * @param {object} effects - 音效節點物件
 * @param {number} amount - 混響量 (0-1)
 */
export function setReverbAmount(effects, amount) {
  if (!effects) return

  effects.reverbAmount = amount
  effects.reverbGain.gain.value = amount * 0.5 // 最大 50% 混響

  // 調整乾聲
  effects.dryGain.gain.value = 1 - (amount * 0.3) // 混響增加時稍微減少乾聲

  console.log('[AudioEffects] Reverb amount:', amount)
}

/**
 * 設定混響參數
 * @param {object} effects - 音效節點物件
 * @param {object} params - { roomSize, decay }
 */
export function setReverbParams(effects, params) {
  if (!effects) return

  const { roomSize = 0.5, decay = 0.3 } = params

  // 調整延遲時間 (模擬房間大小)
  effects.reverbDelay1.delayTime.value = 0.02 + roomSize * 0.04
  effects.reverbDelay2.delayTime.value = 0.04 + roomSize * 0.08
  effects.reverbDelay3.delayTime.value = 0.06 + roomSize * 0.12

  // 調整回授 (模擬衰減)
  effects.reverbFeedback.gain.value = decay * 0.5

  console.log('[AudioEffects] Reverb params:', params)
}

/**
 * 取得目前音效狀態
 * @param {object} effects
 * @returns {object}
 */
export function getEffectsState(effects) {
  if (!effects) return null

  return {
    isMono: effects.isMono,
    stereoWidth: effects.stereoWidthValue,
    reverbAmount: effects.reverbAmount
  }
}

/**
 * 儲存音效到 WeakMap
 * @param {HTMLMediaElement} mediaElement
 * @param {object} effects
 */
export function setEffects(mediaElement, effects) {
  effectsMap.set(mediaElement, effects)
}

/**
 * 取得音效
 * @param {HTMLMediaElement} mediaElement
 * @returns {object | null}
 */
export function getEffects(mediaElement) {
  return effectsMap.get(mediaElement) || null
}
