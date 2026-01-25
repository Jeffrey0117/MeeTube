<template>
  <div class="player-wrapper">
    <div
      ref="container"
      class="ftVideoPlayer shaka-video-container"
      :class="{
        fullWindow: fullWindowEnabled,
        sixteenByNine: forceAspectRatio && !fullWindowEnabled,
        'bilingual-mode': bilingualMode
      }"
    >
      <!-- eslint-disable-next-line vuejs-accessibility/media-has-caption -->
      <video
        ref="video"
        class="player"
        preload="auto"
        crossorigin="anonymous"
        playsinline
        webkit-playsinline
        x5-playsinline
        :autoplay="(autoplayVideos || forceAutoplay) ? true : null"
        :muted="forceAutoplay ? true : null"
        :poster="thumbnail"
        @play="handlePlay"
        @pause="handlePause"
        @ended="handleEnded"
        @canplay="handleCanPlay"
        @volumechange="updateVolume"
        @timeupdate="handleTimeupdate"
        @loadeddata="handleLoadedData"
      />
      <!--
        VR playback is only possible for VR videos with "EQUIRECTANGULAR" projection
        This intentionally doesn't use the "useVrMode" computed prop,
        as that changes depending on the active format,
        but as we initialize the shaka-player UI once per watch page,
        the canvas has to exist even in audio-only mode, because the user may switch to DASH later.
      -->
      <canvas
        v-if="vrProjection === 'EQUIRECTANGULAR'"
        ref="vrCanvas"
        class="vrCanvas"
      />
      <div
        v-if="showStats"
        class="stats"
      >
        <span>{{ $t('Video.Player.Stats.Video ID', { videoId }) }}</span>
        <br>
        <span>{{ $t('Video.Player.Stats.Media Formats', { formats: format }) }}</span>
        <br>
        <span>{{ $t('Video.Player.Stats.Bitrate', { bitrate: stats.bitrate }) }}</span>
        <br>
        <span>{{ $t('Video.Player.Stats.Volume', { volumePercentage: stats.volume }) }}</span>
        <br>
        <template
          v-if="format !== 'legacy'"
        >
          <span>{{ $t('Video.Player.Stats.Bandwidth', { bandwidth: stats.bandwidth }) }}</span>
          <br>
        </template>
        <span>{{ $t('Video.Player.Stats.Buffered', { bufferedPercentage: stats.buffered }) }}</span>
        <br>
        <span
          v-if="format === 'audio'"
        >{{ $t('Video.Player.Stats.CodecAudio', stats.codecs) }}</span>
        <span
          v-else-if="stats.codecs.audioItag && stats.codecs.videoItag"
        >{{ $t('Video.Player.Stats.CodecsVideoAudio', stats.codecs) }}</span>
        <span
          v-else
        >{{ $t('Video.Player.Stats.CodecsVideoAudioNoItags', stats.codecs) }}</span>
        <br>
        <span>{{ $t('Video.Player.Stats.Player Dimensions', stats.playerDimensions) }}</span>
        <br>
        <template
          v-if="format !== 'audio'"
        >
          <span>{{ $t('Video.Player.Stats.Resolution', stats.resolution) }}</span>
          <br>
          <span>{{ $t('Video.Player.Stats.Dropped Frames / Total Frames', stats.frames) }}</span>
        </template>
      </div>
      <Transition name="fade">
        <div
          v-if="showValueChangePopup"
          class="valueChangePopup"
          :class="{ 'invert-content-order': invertValueChangeContentOrder }"
        >
          <font-awesome-icon
            v-if="valueChangeIcon"
            :icon="['fas', valueChangeIcon]"
          />
          <span>{{ valueChangeMessage }}</span>
        </div>
      </Transition>
      <div
        v-if="showOfflineMessage"
        class="offlineWrapper"
      >
        <font-awesome-layers
          class="offlineIcon"
          aria-hidden="true"
        >
          <font-awesome-icon :icon="['fas', 'wifi']" />
          <font-awesome-icon :icon="['fas', 'slash']" />
        </font-awesome-layers>
        <p class="offlineMessage">
          <span>
            {{ $t('Video.Player.You appear to be offline') }}
          </span>
          <br>
          <span class="offlineMessageSubtitle">
            {{ $t('Video.Player.Playback will resume automatically when your connection comes back') }}
          </span>
        </p>
      </div>
      <div
        v-if="sponsorBlockShowSkippedToast && skippedSponsorBlockSegments.length > 0"
        class="skippedSegmentsWrapper"
      >
        <p
          v-for="{ uuid, translatedCategory } in skippedSponsorBlockSegments"
          :key="uuid"
          class="skippedSegment"
        >
          {{ $t('Video.Player.Skipped segment', { segmentCategory: translatedCategory }) }}
        </p>
      </div>
      <!-- iOS 自動播放失敗時顯示的點擊播放按鈕 -->
      <Transition name="fade">
        <div
          v-if="showTapToPlay"
          class="tapToPlayOverlay"
          @click="handleTapToPlay"
        >
          <div class="tapToPlayButton">
            <font-awesome-icon :icon="['fas', 'play']" class="tapToPlayIcon" />
            <span class="tapToPlayText">Tap to Play</span>
          </div>
        </div>
      </Transition>
      <!-- Bilingual Subtitle Overlay (normal mode) -->
      <BilingualSubtitle
        v-if="bilingualMode && !isIOSVideoFullscreen"
        :current-subtitle="currentBilingualSubtitle"
        :display-mode="bilingualDisplayMode"
        :visible="bilingualVisible"
        :container-ref="container"
        :font-size="20"
        :background-opacity="75"
      />
    </div>

    <!-- iOS Fullscreen Subtitle (teleported to body) -->
    <Teleport to="body">
      <div
        v-if="bilingualMode && isIOSVideoFullscreen && currentBilingualSubtitle"
        class="ios-fullscreen-subtitle"
      >
        <div class="ios-subtitle-content">
          <div
            v-if="bilingualDisplayMode !== 'originalOnly' && currentBilingualSubtitle.translation"
            class="ios-subtitle-translation"
          >
            {{ currentBilingualSubtitle.translation }}
          </div>
          <div
            v-if="bilingualDisplayMode !== 'translationOnly'"
            class="ios-subtitle-original"
          >
            {{ currentBilingualSubtitle.text }}
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script src="./ft-shaka-video-player.js" />

<style src="shaka-player/dist/controls.css" />
<style scoped src="./ft-shaka-video-player.css" />

<!-- Unscoped mobile video fix - ensures no cropping regardless of Shaka manipulation -->
<style>
@media screen and (max-width: 639px) {
  .ftVideoPlayer {
    overflow: visible !important;
  }
  .ftVideoPlayer video.player,
  .ftVideoPlayer video,
  .shaka-video-container video {
    object-fit: contain !important;
    max-width: 100% !important;
    width: 100% !important;
  }
}

/* ==========================================
   FULLSCREEN SUBTITLE FIX (Unscoped)
   Scoped styles don't work with :fullscreen
   ========================================== */

/* Allow subtitle to show above Shaka controls in fullscreen */
.ftVideoPlayer:fullscreen,
.ftVideoPlayer:-webkit-full-screen,
.shaka-video-container:fullscreen,
.shaka-video-container:-webkit-full-screen {
  overflow: visible !important;
}

/* Ensure bilingual subtitle is visible in fullscreen */
.ftVideoPlayer:fullscreen .bilingual-subtitle-overlay,
.ftVideoPlayer:-webkit-full-screen .bilingual-subtitle-overlay,
.shaka-video-container:fullscreen .bilingual-subtitle-overlay,
.shaka-video-container:-webkit-full-screen .bilingual-subtitle-overlay {
  position: absolute !important;
  z-index: 2147483647 !important;
  display: flex !important;
  visibility: visible !important;
  opacity: 1 !important;
}

/* Mobile fullscreen subtitle positioning */
@media screen and (max-width: 900px) {
  .ftVideoPlayer:fullscreen .bilingual-subtitle-overlay,
  .ftVideoPlayer:-webkit-full-screen .bilingual-subtitle-overlay {
    top: auto !important;
    bottom: 12% !important;
  }

  .ftVideoPlayer:fullscreen .subtitle-content,
  .ftVideoPlayer:-webkit-full-screen .subtitle-content {
    max-width: 92% !important;
    padding: 6px 12px !important;
  }

  .ftVideoPlayer:fullscreen .subtitle-original,
  .ftVideoPlayer:-webkit-full-screen .subtitle-original {
    font-size: 14px !important;
    line-height: 1.3 !important;
  }

  .ftVideoPlayer:fullscreen .subtitle-translation,
  .ftVideoPlayer:-webkit-full-screen .subtitle-translation {
    font-size: 16px !important;
    line-height: 1.3 !important;
  }
}

/* Landscape mode fullscreen */
@media screen and (max-width: 900px) and (orientation: landscape) {
  .ftVideoPlayer:fullscreen .bilingual-subtitle-overlay,
  .ftVideoPlayer:-webkit-full-screen .bilingual-subtitle-overlay {
    bottom: 15% !important;
  }

  .ftVideoPlayer:fullscreen .subtitle-original,
  .ftVideoPlayer:-webkit-full-screen .subtitle-original {
    font-size: 16px !important;
  }

  .ftVideoPlayer:fullscreen .subtitle-translation,
  .ftVideoPlayer:-webkit-full-screen .subtitle-translation {
    font-size: 18px !important;
  }
}

/* ==========================================
   iOS VIDEO FULLSCREEN SUBTITLE
   When iOS Safari fullscreens only the video element,
   we teleport subtitle to body with fixed positioning
   ========================================== */
.ios-fullscreen-subtitle {
  position: fixed !important;
  left: 0;
  right: 0;
  bottom: 15%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 2147483647 !important;
  pointer-events: none;
}

.ios-subtitle-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 92%;
  padding: 8px 16px;
  border-radius: 4px;
  text-align: center;
  background-color: rgba(0, 0, 0, 0.75);
}

.ios-subtitle-original {
  color: #ffffff;
  font-size: 16px;
  font-weight: 400;
  line-height: 1.3;
  text-shadow:
    1px 1px 2px rgba(0, 0, 0, 0.9),
    -1px -1px 2px rgba(0, 0, 0, 0.9);
}

.ios-subtitle-translation {
  color: #ffeb3b;
  font-size: 18px;
  font-weight: 500;
  line-height: 1.3;
  text-shadow:
    1px 1px 2px rgba(0, 0, 0, 0.9),
    -1px -1px 2px rgba(0, 0, 0, 0.9);
}

/* Landscape mode - slightly larger */
@media screen and (orientation: landscape) {
  .ios-subtitle-original {
    font-size: 18px;
  }
  .ios-subtitle-translation {
    font-size: 20px;
  }
}
</style>
