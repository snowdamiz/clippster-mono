import type { CheckReport, VideoWorkspace } from '../../../client/src/ai-video/runtime/workspace'
import type { HyperframesBridge } from './hyperframesBridge'

type RequestOptions = { signal?: AbortSignal; onProgress?: (progress: number, stage?: string) => void }

/** Node renderer adapter for the same workspace contract used by desktop. */
export class WebHyperframesWorkspace implements VideoWorkspace {
  private constructor(
    private readonly bridge: HyperframesBridge,
    readonly projectDir: string,
    readonly gsapSrc: string,
    readonly fonts: string[],
  ) {}

  static async open(bridge: HyperframesBridge, projectDir: string): Promise<WebHyperframesWorkspace> {
    const setup = await bridge.request<{ gsapSrc: string; fonts: string[] }>('initWorkspace', { projectDir })
    return new WebHyperframesWorkspace(bridge, projectDir, setup.gsapSrc, setup.fonts)
  }

  linkMedia(items: Array<{ id: string; path: string }>) {
    return this.bridge.request<{ linked: Array<{ id: string; src: string }> }>('linkMedia', { projectDir: this.projectDir, items })
  }

  writeFile(path: string, content: string) {
    return this.bridge.request<{ path: string; bytes: number }>('writeFile', { projectDir: this.projectDir, path, content })
  }

  async readFile(path: string): Promise<string> {
    return (await this.bridge.request<{ content: string }>('readFile', { projectDir: this.projectDir, path })).content
  }

  deleteFile(path: string) {
    return this.bridge.request('deleteFile', { projectDir: this.projectDir, path })
  }

  async listFiles(): Promise<string[]> {
    return (await this.bridge.request<{ files: string[] }>('listFiles', { projectDir: this.projectDir })).files
  }

  check(options: RequestOptions = {}) {
    return this.bridge.request<CheckReport>('check', { projectDir: this.projectDir, samples: 9 }, options)
  }

  snapshot(times: number[], outDir: string, against?: string, options: RequestOptions = {}) {
    return this.bridge.request<{ outDir: string; files: string[] }>('snapshot', { projectDir: this.projectDir, times, outDir, against }, options)
  }

  render(outputPath: string, options: RequestOptions & { fps?: number; crf?: number; files?: Record<string, string> } = {}) {
    const { fps, crf, files, ...request } = options
    return this.bridge.request<{ outputPath: string; bytes: number; duration: number | null; warnings: string[] }>(
      'render', { projectDir: this.projectDir, outputPath, fps, crf, files }, request,
    )
  }

  ensureBrowser(options: RequestOptions = {}) {
    return this.bridge.request<{ path: string }>('ensureBrowser', {}, options)
  }
}
