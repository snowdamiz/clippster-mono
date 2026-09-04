#include "clippster/json_lite.hpp"

#include <cctype>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <limits>
#include <string_view>

namespace clippster::json {
namespace {

[[noreturn]] void typeError(const char* expected) {
  throw ParseError(std::string("JSON value is not ") + expected);
}

class Parser {
 public:
  explicit Parser(std::string_view source) : source_(source) {}

  Value parseDocument() {
    Value result = parseValue(0);
    whitespace();
    if (position_ != source_.size()) fail("unexpected trailing input");
    return result;
  }

 private:
  [[noreturn]] void fail(const char* message) const {
    throw ParseError(std::string(message) + " at byte " +
                     std::to_string(position_));
  }

  void whitespace() {
    while (position_ < source_.size() &&
           std::isspace(static_cast<unsigned char>(source_[position_])))
      ++position_;
  }

  bool consume(char value) {
    whitespace();
    if (position_ < source_.size() && source_[position_] == value) {
      ++position_;
      return true;
    }
    return false;
  }

  Value parseValue(unsigned depth) {
    if (depth > 128) fail("maximum nesting depth exceeded");
    whitespace();
    if (position_ >= source_.size()) fail("expected value");
    switch (source_[position_]) {
      case 'n': return literal("null", Value{});
      case 't': return literal("true", Value{Value::Storage{true}});
      case 'f': return literal("false", Value{Value::Storage{false}});
      case '"': return Value{Value::Storage{parseString()}};
      case '[': return parseArray(depth + 1);
      case '{': return parseObject(depth + 1);
      default:
        if (source_[position_] == '-' ||
            std::isdigit(static_cast<unsigned char>(source_[position_])))
          return Value{Value::Storage{parseNumber()}};
        fail("invalid value");
    }
  }

  Value literal(std::string_view token, Value value) {
    if (source_.substr(position_, token.size()) != token)
      fail("invalid literal");
    position_ += token.size();
    return value;
  }

  static int hex(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
  }

  std::uint32_t unicodeEscape() {
    if (position_ + 4 > source_.size()) fail("truncated unicode escape");
    std::uint32_t code = 0;
    for (int i = 0; i < 4; ++i) {
      const int digit = hex(source_[position_++]);
      if (digit < 0) fail("invalid unicode escape");
      code = code * 16U + static_cast<std::uint32_t>(digit);
    }
    return code;
  }

  static void appendUtf8(std::string& output, std::uint32_t code) {
    if (code <= 0x7F) {
      output.push_back(static_cast<char>(code));
    } else if (code <= 0x7FF) {
      output.push_back(static_cast<char>(0xC0U | (code >> 6U)));
      output.push_back(static_cast<char>(0x80U | (code & 0x3FU)));
    } else if (code <= 0xFFFF) {
      output.push_back(static_cast<char>(0xE0U | (code >> 12U)));
      output.push_back(static_cast<char>(0x80U | ((code >> 6U) & 0x3FU)));
      output.push_back(static_cast<char>(0x80U | (code & 0x3FU)));
    } else {
      output.push_back(static_cast<char>(0xF0U | (code >> 18U)));
      output.push_back(static_cast<char>(0x80U | ((code >> 12U) & 0x3FU)));
      output.push_back(static_cast<char>(0x80U | ((code >> 6U) & 0x3FU)));
      output.push_back(static_cast<char>(0x80U | (code & 0x3FU)));
    }
  }

  std::string parseString() {
    if (!consume('"')) fail("expected string");
    std::string output;
    while (position_ < source_.size()) {
      const unsigned char c = static_cast<unsigned char>(source_[position_++]);
      if (c == '"') return output;
      if (c < 0x20) fail("control character in string");
      if (c != '\\') {
        output.push_back(static_cast<char>(c));
        continue;
      }
      if (position_ >= source_.size()) fail("truncated escape");
      switch (source_[position_++]) {
        case '"': output.push_back('"'); break;
        case '\\': output.push_back('\\'); break;
        case '/': output.push_back('/'); break;
        case 'b': output.push_back('\b'); break;
        case 'f': output.push_back('\f'); break;
        case 'n': output.push_back('\n'); break;
        case 'r': output.push_back('\r'); break;
        case 't': output.push_back('\t'); break;
        case 'u': {
          std::uint32_t code = unicodeEscape();
          if (code >= 0xD800 && code <= 0xDBFF) {
            if (position_ + 2 > source_.size() || source_[position_] != '\\' ||
                source_[position_ + 1] != 'u')
              fail("missing low surrogate");
            position_ += 2;
            const std::uint32_t low = unicodeEscape();
            if (low < 0xDC00 || low > 0xDFFF) fail("invalid low surrogate");
            code = 0x10000U + ((code - 0xD800U) << 10U) + (low - 0xDC00U);
          } else if (code >= 0xDC00 && code <= 0xDFFF) {
            fail("unexpected low surrogate");
          }
          appendUtf8(output, code);
          break;
        }
        default: fail("invalid escape");
      }
    }
    fail("unterminated string");
  }

  double parseNumber() {
    const std::size_t start = position_;
    if (source_[position_] == '-') ++position_;
    if (position_ >= source_.size()) fail("invalid number");
    if (source_[position_] == '0') {
      ++position_;
      if (position_ < source_.size() &&
          std::isdigit(static_cast<unsigned char>(source_[position_])))
        fail("leading zero in number");
    } else {
      if (!std::isdigit(static_cast<unsigned char>(source_[position_])))
        fail("invalid number");
      while (position_ < source_.size() &&
             std::isdigit(static_cast<unsigned char>(source_[position_])))
        ++position_;
    }
    if (position_ < source_.size() && source_[position_] == '.') {
      ++position_;
      if (position_ >= source_.size() ||
          !std::isdigit(static_cast<unsigned char>(source_[position_])))
        fail("invalid fraction");
      while (position_ < source_.size() &&
             std::isdigit(static_cast<unsigned char>(source_[position_])))
        ++position_;
    }
    if (position_ < source_.size() &&
        (source_[position_] == 'e' || source_[position_] == 'E')) {
      ++position_;
      if (position_ < source_.size() &&
          (source_[position_] == '+' || source_[position_] == '-'))
        ++position_;
      if (position_ >= source_.size() ||
          !std::isdigit(static_cast<unsigned char>(source_[position_])))
        fail("invalid exponent");
      while (position_ < source_.size() &&
             std::isdigit(static_cast<unsigned char>(source_[position_])))
        ++position_;
    }
    const std::string token(source_.substr(start, position_ - start));
    char* end = nullptr;
    const double number = std::strtod(token.c_str(), &end);
    if (end != token.c_str() + token.size() || !std::isfinite(number))
      fail("number out of range");
    return number;
  }

  Value parseArray(unsigned depth) {
    consume('[');
    Value::Array values;
    if (consume(']')) return Value{Value::Storage{std::move(values)}};
    do {
      values.push_back(parseValue(depth));
    } while (consume(','));
    if (!consume(']')) fail("expected ']'");
    return Value{Value::Storage{std::move(values)}};
  }

  Value parseObject(unsigned depth) {
    consume('{');
    Value::Object values;
    if (consume('}')) return Value{Value::Storage{std::move(values)}};
    do {
      whitespace();
      if (position_ >= source_.size() || source_[position_] != '"')
        fail("expected object key");
      std::string key = parseString();
      if (!consume(':')) fail("expected ':'");
      if (!values.emplace(std::move(key), parseValue(depth)).second)
        fail("duplicate object key");
    } while (consume(','));
    if (!consume('}')) fail("expected '}'");
    return Value{Value::Storage{std::move(values)}};
  }

  std::string_view source_;
  std::size_t position_ = 0;
};

}  // namespace

bool Value::isNull() const noexcept { return std::holds_alternative<std::nullptr_t>(value_); }
bool Value::isBool() const noexcept { return std::holds_alternative<bool>(value_); }
bool Value::isNumber() const noexcept { return std::holds_alternative<double>(value_); }
bool Value::isString() const noexcept { return std::holds_alternative<std::string>(value_); }
bool Value::isArray() const noexcept { return std::holds_alternative<Array>(value_); }
bool Value::isObject() const noexcept { return std::holds_alternative<Object>(value_); }
bool Value::asBool() const { if (!isBool()) typeError("a boolean"); return std::get<bool>(value_); }
double Value::asNumber() const { if (!isNumber()) typeError("a number"); return std::get<double>(value_); }
const std::string& Value::asString() const { if (!isString()) typeError("a string"); return std::get<std::string>(value_); }
const Value::Array& Value::asArray() const { if (!isArray()) typeError("an array"); return std::get<Array>(value_); }
const Value::Object& Value::asObject() const { if (!isObject()) typeError("an object"); return std::get<Object>(value_); }
const Value* Value::find(std::string_view key) const noexcept {
  if (!isObject()) return nullptr;
  const auto& object = std::get<Object>(value_);
  const auto found = object.find(key);
  return found == object.end() ? nullptr : &found->second;
}

Value parse(std::string_view source) { return Parser(source).parseDocument(); }

}  // namespace clippster::json
