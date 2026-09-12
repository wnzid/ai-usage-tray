const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('usageTray', {
  getState: () => ipcRenderer.invoke('state:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  refresh: () => ipcRenderer.invoke('usage:refresh'),
  signIn: () => ipcRenderer.invoke('account:login'),
  openSettings: () => ipcRenderer.invoke('window:openSettings'),
  openDetails: () => ipcRenderer.invoke('window:openDetails'),
  hideDetails: () => ipcRenderer.invoke('window:hideDetails'),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('state:changed', listener);
    return () => ipcRenderer.removeListener('state:changed', listener);
  },
});
