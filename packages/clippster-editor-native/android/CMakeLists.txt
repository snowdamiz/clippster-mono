cmake_minimum_required(VERSION 3.22.1)
project(clippster_editor_jni LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

file(GLOB CLIPPSTER_CORE_SOURCES CONFIGURE_DEPENDS
  "${CMAKE_CURRENT_SOURCE_DIR}/../cpp/src/*.cpp"
)

add_library(clippster_editor_jni SHARED
  src/main/cpp/jni_bridge.cpp
  ${CLIPPSTER_CORE_SOURCES}
)

target_include_directories(clippster_editor_jni PRIVATE
  "${CMAKE_CURRENT_SOURCE_DIR}/../cpp/include"
)

find_library(android-log-lib log)
target_link_libraries(clippster_editor_jni PRIVATE ${android-log-lib})
