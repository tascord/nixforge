import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { fileURLToPath } from 'url';
import os from 'os';
import { exec, spawn, execSync } from 'child_process';
import { promisify } from 'util';
import Store from 'electron-store';

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null;

const execAsync = promisify(exec);

// Initialize electron-store for persisting config
const store = new Store();

const PACKAGE_RENAMES: Record<string, string> = {
  'noto-fonts-cjk': 'noto-fonts-cjk-sans',
  'pkgs.noto-fonts-cjk': 'noto-fonts-cjk-sans',
  'noto-fonts-emoji': 'noto-fonts-color-emoji',
  'pkgs.noto-fonts-emoji': 'noto-fonts-color-emoji',
  'nerdfonts': 'nerd-fonts.symbols-only',
  'pkgs.nerdfonts': 'nerd-fonts.symbols-only',
  'nerd-fonts': 'nerd-fonts.symbols-only',
  'pkgs.nerd-fonts': 'nerd-fonts.symbols-only',
};

const mapPackageName = (name: string): string => {
  return PACKAGE_RENAMES[name] || name;
};

const createWindow = () => {
  console.log("Creating window...");
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    console.log("Loading URL:", process.env.VITE_DEV_SERVER_URL);
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // mainWindow.webContents.openDevTools();
  } else {
    console.log("Loading local file:", path.join(__dirname, '../dist/index.html'));
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
  
  // Force DevTools to be sure
  // mainWindow.webContents.openDevTools();

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load:', errorCode, errorDescription);
  });
};

app.whenReady().then(() => {
  console.log("App Ready");
  createWindow();

  ipcMain.handle('save-file', async (event, { content, filename }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: filename,
    });

    if (!canceled && filePath) {
      fs.writeFileSync(filePath, content);
      return { success: true, filePath };
    }
    return { canceled: true };
  });
  
  ipcMain.handle('select-directory', async () => {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory']
      });
      if (!canceled && filePaths.length > 0) {
        return { success: true, path: filePaths[0] };
      }
      return { canceled: true };
    });

    ipcMain.handle('write-file', async (event, { filePath, content }) => {
        try {
             // Create parent directories if they don't exist
             const dir = path.dirname(filePath);
             if (!fs.existsSync(dir)) {
                 fs.mkdirSync(dir, { recursive: true });
             }
             fs.writeFileSync(filePath, content);
             return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('proxy-request', async (event, { url, method = 'GET', body = null, headers = {} }) => {
        return new Promise((resolve, reject) => {
            const options = {
                method,
                headers: {
                    'User-Agent': 'NixForge-Electron',
                    'Content-Type': 'application/json',
                    ...headers
                },
                timeout: 30000 // 30 second timeout
            };

            const req = https.request(url, options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        resolve(data ? JSON.parse(data) : {});
                    } catch (e) {
                         // Fallback for non-JSON responses
                        resolve(data);
                    }
                });
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timed out'));
            });

            req.on('error', (err) => {
                reject(err);
            });

            if (body) {
                req.write(typeof body === 'string' ? body : JSON.stringify(body));
            }
            req.end();
        });
    });

    ipcMain.handle('read-file', async (event, { filePath }) => {
        try {
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                return { success: true, content };
            } else {
                return { success: false, error: 'File not found' };
            }
        } catch (e: any) {
             return { success: false, error: e.message };
        }
    });

    ipcMain.handle('check-file-exists', async (event, { filePath }) => {
        try {
            return { exists: fs.existsSync(filePath) };
        } catch (e) {
            return { exists: false };
        }
    });

    ipcMain.handle('open-folder', async (event, { path: folderPath }) => {
        try {
             const shell = (await import('electron')).shell;
             await shell.openPath(folderPath);
             return { success: true };
        } catch (e: any) {
             return { success: false, error: e.message };
        }
    });

    ipcMain.handle('get-app-paths', () => {
        return {
            home: os.homedir(),
            documents: app.getPath('documents'),
            userData: app.getPath('userData'),
            hostname: os.hostname(),
            username: os.userInfo().username
        };
    });

    ipcMain.on('run-build', async (event, { directory, action, flakeURI }) => {
     if (!mainWindow) return;

     // Ensure hardware-configuration.nix exists in the target directory
     // NixOS flakes require all imported files to be present in the flake directory
     const targetHardwarePath = path.join(directory, 'hardware-configuration.nix');
     if (!fs.existsSync(targetHardwarePath)) {
         try {
             const etcHardwarePath = '/etc/nixos/hardware-configuration.nix';
             if (fs.existsSync(etcHardwarePath)) {
                 console.log(`Copying ${etcHardwarePath} to ${targetHardwarePath}`);
                 fs.copyFileSync(etcHardwarePath, targetHardwarePath);
                 mainWindow.webContents.send('build-log', `> Copied /etc/nixos/hardware-configuration.nix to build directory\n`);
             } else {
                 // Generate it since it doesn't exist in /etc/nixos
                 console.log(`Generating hardware configuration...`);
                 mainWindow.webContents.send('build-log', `> /etc/nixos/hardware-configuration.nix not found. Generating fresh hardware config...\n`);
                 try {
                     // Using execAsync instead of execSync to avoid blocking the main process
                     const { stdout } = await execAsync('nixos-generate-config --show-hardware-config');
                     fs.writeFileSync(targetHardwarePath, stdout);
                     mainWindow.webContents.send('build-log', `> Hardware configuration generated successfully.\n`);
                 } catch (genErr: any) {
                     console.error('Failed to generate hardware config:', genErr);
                     // Try to detect the root device as a better fallback than a hardcoded /dev/sda1
                     try {
                         const { stdout: rootDev } = await execAsync("findmnt -n -o SOURCE /");
                         const { stdout: rootFs } = await execAsync("findmnt -n -o FSTYPE /");
                         const { stdout: rootUuid } = await execAsync(`lsblk -no UUID ${rootDev.trim()}`);
                         
                         let fileSystemEntry = "";
                         if (rootUuid.trim()) {
                             fileSystemEntry = `fileSystems."/" = { device = "/dev/disk/by-uuid/${rootUuid.trim()}"; fsType = "${rootFs.trim()}"; };`;
                         } else {
                             fileSystemEntry = `fileSystems."/" = { device = "${rootDev.trim()}"; fsType = "${rootFs.trim()}"; };`;
                         }

                         fs.writeFileSync(targetHardwarePath, `# Generated fallback via detection\n{ ... }:\n{\n  imports = [ ];\n  ${fileSystemEntry}\n}\n`);
                         mainWindow.webContents.send('build-log', `> Warning: nixos-generate-config failed. Used detected root: ${rootDev.trim()}\n`);
                     } catch (fallbackErr) {
                         // Last resort fallback - don't use /dev/sda1 as it's often wrong
                         fs.writeFileSync(targetHardwarePath, '# Generated fallback\n# WARNING: Root partition could not be detected. This system may not boot.\n{ ... }:\n{\n  imports = [ ];\n  fileSystems."/" = { device = "/dev/disk/by-label/nixos"; }; \n}\n');
                         mainWindow.webContents.send('build-log', `> Warning: Could not generate hardware config or detect root. Using default label "nixos".\n`);
                     }
                 }
             }
         } catch (e: any) {
             console.error('Failed to prepare hardware-configuration.nix:', e);
             mainWindow.webContents.send('build-log', `> Error preparing hardware-configuration.nix: ${e.message}\n`);
         }
     }
     
     // Build command - use nixos-rebuild with fallback to nh if available
     // If it's a git repo, add files first so flakes can see them
     // We extract the hostname from the flakeURI if possible (e.g. /path/to#hostname)
     const hostnameMatch = flakeURI?.match(/#([^#]+)$/);
     const hostnamePart = hostnameMatch ? `-H ${hostnameMatch[1]}` : "";
     
     // Use pkexec to trigger a GUI password prompt via Polkit. 
     // We set SHELL=/bin/sh to ensure pkexec finds a valid shell in /etc/shells.
     // Many users keep their user shell in the nix store, which pkexec might reject if not in /etc/shells.
     // Using /bin/sh is safer for the elevation wrapper.
     const shellCmd = `cd "${directory}" && (test -d .git && git add . || true) && if command -v nh >/dev/null 2>&1; then env SHELL=/bin/sh pkexec nh os ${action} ${hostnamePart} .; else env SHELL=/bin/sh pkexec nixos-rebuild ${action} --flake "${flakeURI || directory}"; fi`;
     
     console.log(`Running build: ${shellCmd}`);
     mainWindow.webContents.send('build-log', `> ${shellCmd}\n`);

     const child = spawn(shellCmd, {
         shell: true,
         env: { ...process.env, FORCE_COLOR: '1', TERM: 'xterm-256color' } 
     });
     
     child.stdout?.on('data', (data) => {
         const str = data.toString();
         console.log(str);
         mainWindow?.webContents.send('build-log', str);
     });

     child.stderr?.on('data', (data) => {
        const str = data.toString();
        console.error(str);
        mainWindow?.webContents.send('build-log', str);
    });

    child.on('close', (code) => {
        mainWindow?.webContents.send('build-exit', code);
    });
    
    child.on('error', (err) => {
        mainWindow?.webContents.send('build-log', `\nError launching process: ${err.message}\n`);
        mainWindow?.webContents.send('build-exit', 1);
    });
  });

    ipcMain.handle('generate-hardware-config', async () => {
        try {
            // Include file systems by default as it's required for a bootable system
            const { stdout } = await execAsync('nixos-generate-config --show-hardware-config');
            return { success: true, content: stdout };
        } catch (e: any) {
            console.error('Failed to generate hardware config:', e);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('generate-password-hash', async (event, { password }) => {
        try {
            const { stdout } = await execAsync(`mkpasswd -m sha-512 "${password.replace(/"/g, '\\"')}"`);
            return { success: true, hash: stdout.trim() };
        } catch (error: any) {
            try {
                const { stdout } = await execAsync(`python3 -c 'import crypt; print(crypt.crypt("${password.replace(/"/g, '\\"')}", crypt.mksalt(crypt.METHOD_SHA512)))'`);
                return { success: true, hash: stdout.trim() };
            } catch (pyError: any) {
                return { success: false, error: 'mkpasswd not found and Python fallback failed' };
            }
        }
    });

    // Config persistence handlers
    ipcMain.handle('save-config', async (event, config) => {
        try {
            store.set('appConfig', config);
            return { success: true };
        } catch (e: any) {
            console.error('Failed to save config:', e);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('load-config', async () => {
        try {
            const config = store.get('appConfig');
            return { success: true, config };
        } catch (e: any) {
            console.error('Failed to load config:', e);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('search-packages', async (event, { query }) => {
        try {
            const sanitizedQuery = query.replace(/[^a-zA-Z0-9-_ ]/g, '');
            if (sanitizedQuery.length < 2) return { success: true, packages: [] };

            // Super fast search using nix-env -qa with grep
            // We use 'nice' to prevent UI lag
            // We limit results to 50 for speed
            // We search for package names containing the query string (case insensitive)
            
            // NOTE: This assumes channels are set up. If using strictly flakes, we might have to fallback.
            // But nix-env is typically available even on flake systems for ad-hoc queries if NIX_PATH is set or channels exist.
            // If this returns nothing, we try the 'nix search' approach.

            try {
                // Command Explanation:
                // nix-env -qaP: Query Available packages, print Attribute path (P)
                // | grep -i: Case insensitive search
                // | head -n 50: Limit results early
                // awk: Formatting to JSON-like structure or just string parsing
                
                const { stdout } = await execAsync(
                    `nix-env -qaP 2>/dev/null | grep -i "${sanitizedQuery}" | head -n 50`, 
                    { timeout: 5000 }
                );

                if (stdout.trim()) {
                    const lines = stdout.trim().split('\n');
                    const packages = lines.map(line => {
                        // Line format: nixpkgs.package  package-version
                        // varying whitespace
                        const parts = line.split(/\s+/);
                        const attrPath = parts[0];
                        // Remove nixpkgs. prefix
                        const name = attrPath.replace(/^nixos\.|^nixpkgs\./, '');
                        
                        return { 
                            name: mapPackageName(name),
                            description: 'Nix Package' // nix-env -qaP doesn't give description easily without slow json export
                        };
                    });
                    return { success: true, packages };
                }
            } catch (ignore) {
                 // nix-env might fail or find nothing
            }
            
            // Fallback to nix search if nix-env failed (approx 2s-5s if cached)
             try {
                 const { stdout } = await execAsync(
                     `nix search nixpkgs "${sanitizedQuery}" --json 2>/dev/null`, 
                     { timeout: 10000 }
                 );
                 if (stdout.trim()) {
                     const data = JSON.parse(stdout);
                     const packages = Object.entries(data).map(([key, info]: [string, any]) => {
                         const parts = key.split('.');
                         const name = parts[parts.length - 1]; 
                         return {
                             name: mapPackageName(name),
                             description: info.description || 'No description available'
                         };
                     }).slice(0, 50);
                     if (packages.length > 0) return { success: true, packages };
                 }
            } catch (e) {}

            return { success: true, packages: [] };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
