import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (content: string, filename: string) => ipcRenderer.invoke('save-file', { content, filename }),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('write-file', { filePath, content }),
  fetchExternal: (url: string, options?: any) => ipcRenderer.invoke('proxy-request', { url, ...options }),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', { filePath }),
  checkFileExists: (filePath: string) => ipcRenderer.invoke('check-file-exists', { filePath }),
  openFolder: (path: string) => ipcRenderer.invoke('open-folder', { path }),
  getAppPaths: () => ipcRenderer.invoke('get-app-paths'),
  generateHardwareConfig: () => ipcRenderer.invoke('generate-hardware-config'),
  runBuild: (args: any) => ipcRenderer.send('run-build', args),
  onBuildLog: (callback: (log: string) => void) => ipcRenderer.on('build-log', (_event, log) => callback(log)),
  onBuildExit: (callback: (code: number) => void) => ipcRenderer.on('build-exit', (_event, code) => callback(code)),
  generatePasswordHash: (password: string) => ipcRenderer.invoke('generate-password-hash', { password }),
  saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
  loadConfig: () => ipcRenderer.invoke('load-config'),
  searchPackages: (query: string) => ipcRenderer.invoke('search-packages', { query }),
});
