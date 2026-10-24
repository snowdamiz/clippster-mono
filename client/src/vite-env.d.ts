/// <reference types="vite/client" />

interface Window {
  autoscrollTimeout?: ReturnType<typeof setTimeout> | null;
}
