#include "clippster/clock.hpp"

#include <algorithm>
#include <stdexcept>

namespace clippster {

AudioMasterClock::AudioMasterClock(std::uint32_t sampleRate)
    : sampleRate_(sampleRate) {
  if (sampleRate == 0) throw std::invalid_argument("sample rate must be positive");
}

void AudioMasterClock::play() {
  std::lock_guard<std::mutex> lock(mutex_);
  playing_ = true;
}

void AudioMasterClock::pause() {
  std::lock_guard<std::mutex> lock(mutex_);
  baseTick_ += static_cast<Tick>(
      (static_cast<long double>(renderedFrames_) * TICKS_PER_SECOND) /
      sampleRate_);
  renderedFrames_ = 0;
  playing_ = false;
}

void AudioMasterClock::seek(Tick tick, SeekMode mode) {
  std::lock_guard<std::mutex> lock(mutex_);
  baseTick_ = std::clamp<Tick>(tick, 0, MAX_TICKS);
  renderedFrames_ = 0;
  lastSeekMode_ = mode;
}

void AudioMasterClock::onAudioFramesRendered(std::uint64_t frameCount) {
  std::lock_guard<std::mutex> lock(mutex_);
  if (playing_) renderedFrames_ += frameCount;
}

Tick AudioMasterClock::currentTick() const {
  std::lock_guard<std::mutex> lock(mutex_);
  const Tick elapsed = static_cast<Tick>(
      (static_cast<long double>(renderedFrames_) * TICKS_PER_SECOND) /
      sampleRate_);
  return std::clamp<Tick>(baseTick_ + elapsed, 0, MAX_TICKS);
}

std::uint32_t AudioMasterClock::sampleRate() const noexcept {
  return sampleRate_;
}

bool AudioMasterClock::isPlaying() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return playing_;
}

SeekMode AudioMasterClock::lastSeekMode() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return lastSeekMode_;
}

}  // namespace clippster
