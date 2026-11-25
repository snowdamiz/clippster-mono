// GNU tar on Linux cannot inspect ZIP archives. macOS and Windows ship libarchive tar.
export const zipArchiveTool = process.platform === 'linux' ? 'bsdtar' : 'tar'
