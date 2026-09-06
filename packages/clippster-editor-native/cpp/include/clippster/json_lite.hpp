#pragma once

#include <map>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>
#include <variant>
#include <vector>

namespace clippster::json {

class ParseError final : public std::runtime_error {
 public:
  using std::runtime_error::runtime_error;
};

class Value {
 public:
  using Array = std::vector<Value>;
  using Object = std::map<std::string, Value, std::less<>>;
  using Storage =
      std::variant<std::nullptr_t, bool, double, std::string, Array, Object>;

  Value() : value_(nullptr) {}
  explicit Value(Storage value) : value_(std::move(value)) {}

  [[nodiscard]] bool isNull() const noexcept;
  [[nodiscard]] bool isBool() const noexcept;
  [[nodiscard]] bool isNumber() const noexcept;
  [[nodiscard]] bool isString() const noexcept;
  [[nodiscard]] bool isArray() const noexcept;
  [[nodiscard]] bool isObject() const noexcept;
  [[nodiscard]] bool asBool() const;
  [[nodiscard]] double asNumber() const;
  [[nodiscard]] const std::string& asString() const;
  [[nodiscard]] const Array& asArray() const;
  [[nodiscard]] const Object& asObject() const;
  [[nodiscard]] const Value* find(std::string_view key) const noexcept;

 private:
  Storage value_;
};

[[nodiscard]] Value parse(std::string_view source);

}  // namespace clippster::json
