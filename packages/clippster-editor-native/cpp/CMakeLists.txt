cmake_minimum_required(VERSION 3.16)
project(clippster_editor_core LANGUAGES CXX)

add_library(clippster_editor_core
  src/capabilities.cpp
  src/clock.cpp
  src/graph_evaluator.cpp
  src/json_lite.cpp
  src/reference_renderer.cpp
  src/scene_graph.cpp
)

target_include_directories(clippster_editor_core
  PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/include"
)
target_compile_features(clippster_editor_core PUBLIC cxx_std_17)
set_target_properties(clippster_editor_core PROPERTIES
  CXX_EXTENSIONS OFF
  POSITION_INDEPENDENT_CODE ON
)

if(MSVC)
  target_compile_options(clippster_editor_core PRIVATE /W4 /permissive-)
else()
  target_compile_options(clippster_editor_core PRIVATE
    -Wall -Wextra -Wpedantic
  )
endif()

add_executable(clippster_editor_core_tests tests/core_tests.cpp)
target_link_libraries(clippster_editor_core_tests PRIVATE clippster_editor_core)
if(MSVC)
  target_compile_options(clippster_editor_core_tests PRIVATE /UNDEBUG)
else()
  target_compile_options(clippster_editor_core_tests PRIVATE -UNDEBUG)
endif()

enable_testing()
add_test(NAME clippster_editor_core_tests
         COMMAND clippster_editor_core_tests)
