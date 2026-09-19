/**
 * MCGI Production Monitoring System - Electron Main Process Controller
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "MCGI Attendance Monitoring System",
    backgroundColor: "#050507",
    autoHideMenuBar: true,
    show: false, // Prevents white/blank flash before showing
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.show();
  win.loadFile(path.join(__dirname, 'login.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
