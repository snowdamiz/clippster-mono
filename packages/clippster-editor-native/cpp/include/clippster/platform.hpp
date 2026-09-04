#pragma once

#include "clippster/types.hpp"

#include <cstddef>
#include <cstdint>
#include <string_view>

namespace clippster {

class IMediaDecoder {
 public:
  virtual ~IMediaDecoder() = default;
  virtual bool open(std::string_view uri) = 0;
  virtual bool decodeVideoFrame(Tick sourceTick) = 0;
};

class ITextureUploader {
 public:
  virtual ~ITextureUploader() = default;
  virtual bool uploadRgba(const std::uint8_t* pixels, int width, int height,
                          std::size_t strideBytes) = 0;
};

class IAudioRenderer {
 public:
  virtual ~IAudioRenderer() = default;
  virtual void play() = 0;
  virtual void pause() = 0;
  virtual void seek(Tick tick) = 0;
};

class IHardwareEncoder {
 public:
  virtual ~IHardwareEncoder() = default;
  virtual bool begin(int width, int height, int fps) = 0;
  virtual bool encodeFrame(Tick presentationTick) = 0;
  virtual bool finish() = 0;
};

class IMuxer {
 public:
  virtual ~IMuxer() = default;
  virtual bool begin(std::string_view outputUri) = 0;
  virtual bool writeVideoPacket(const std::uint8_t* data, std::size_t size,
                                Tick presentationTick, bool keyFrame) = 0;
  virtual bool writeAudioPacket(const std::uint8_t* data, std::size_t size,
                                Tick presentationTick) = 0;
  virtual bool finish() = 0;
};

}  // namespace clippster
