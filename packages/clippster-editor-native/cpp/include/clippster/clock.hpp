#pragma once

#include "clippster/types.hpp"

#include <chrono>
#include <cstdint>
#include <mutex>

namespace clippster {

enum class SeekMode { Interactive, Precise };

// Audio is authoritative. Preview clients may drop video frames to catch this
// clock; deterministic export must instead evaluate every requested tick.
class AudioMasterClock {
 public:
  explicit AudioMasterClock(std::uint32_t sampleRate = 48'000);

  void play();
  void pause();
  void seek(Tick tick, SeekMode mode = SeekMode::Precise);
  void onAudioFramesRendered(std::uint64_t frameCount);

  [[nodiscard]] Tick currentTick() const;
  [[nodiscard]] std::uint32_t sampleRate() const noexcept;
  [[nodiscard]] bool isPlaying() const;
  [[nodiscard]] SeekMode lastSeekMode() const;

 private:
  mutable std::mutex mutex_;
  std::uint32_t sampleRate_;
  Tick baseTick_ = 0;
  std::uint64_t renderedFrames_ = 0;
  bool playing_ = false;
  SeekMode lastSeekMode_ = SeekMode::Precise;
};

}  // namespace clippster
