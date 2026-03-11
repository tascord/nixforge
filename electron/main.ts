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
    mainWindow.webContents.openDevTools();
  } else {
    console.log("Loading local file:", path.join(__dirname, '../dist/index.html'));
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
  
  // Handle deep links when window is ready
  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingDeepLink) {
      mainWindow?.webContents.send('deep-link', pendingDeepLink);
      pendingDeepLink = null;
    }
  });

  // Force DevTools to be sure
  // mainWindow.webContents.openDevTools();

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load:', errorCode, errorDescription);
  });
};

let pendingDeepLink: string | null = null;

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('nixforge', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('nixforge');
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    
    // The commandLine is an array of strings in which the last element is the deep link url
    const url = commandLine.pop();
    if (url && url.startsWith('nixforge://')) {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('deep-link', url);
      } else {
        pendingDeepLink = url;
      }
    }
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('deep-link', url);
    } else {
      pendingDeepLink = url;
    }
  });
}

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
  ipcMain.on('run-flake-update', async (event, { directory }) => {
    if (!mainWindow) return;

    const cmd = `nix flake update`;
    mainWindow.webContents.send('build-log', `> Running: ${cmd} in ${directory}\n`);

    const child = spawn('nix', ['flake', 'update'], {
        cwd: directory,
        env: { ...process.env, PATH: '/run/current-system/sw/bin:/usr/bin:/bin' }
    });

    child.stdout.on('data', (data) => {
        mainWindow?.webContents.send('build-log', data.toString());
    });

    child.stderr.on('data', (data) => {
        mainWindow?.webContents.send('build-log', data.toString());
    });

    child.on('close', (code) => {
        mainWindow?.webContents.send('build-exit', code || 0);
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

let searchAuthCache: { user: string; pass: string; version: string } | null = null;

async function getSearchAuth() {
    if (searchAuthCache) return searchAuthCache;
    return new Promise((resolve, reject) => {
        https.get('https://search.nixos.org/bundle.js', (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const userMatch = data.match(/elasticsearchUsername:"([^"]+)"/);
                const passMatch = data.match(/elasticsearchPassword:"([^"]+)"/);
                const versionMatch = data.match(/aVersion:parseInt\("([^"]+)"\)/);
                if (userMatch && passMatch && versionMatch) {
                    searchAuthCache = { user: userMatch[1], pass: passMatch[1], version: versionMatch[1] };
                    resolve(searchAuthCache);
                } else {
                    reject(new Error("Failed to parse bundle.js"));
                }
            });
        }).on('error', reject);
    });
}

    ipcMain.handle('search-packages', async (event, { query }) => {
        try {
            const sanitizedQuery = query.replace(/[^a-zA-Z0-9-_ ]/g, '');
            if (sanitizedQuery.length < 2) return { success: true, packages: [] };

            // 1. Try fast online search via search.nixos.org API
            try {
                const auth: any = await getSearchAuth();
                const authHeader = 'Basic ' + Buffer.from(`${auth.user}:${auth.pass}`).toString('base64');
                const index = `latest-${auth.version}-nixos-unstable`;
                const searchBody = JSON.stringify({
                    query: {
                        bool: {
                            must: [
                                {
                                    multi_match: {
                                        query: sanitizedQuery,
                                        type: "best_fields",
                                        fields: [
                                            "package_attr_name^4", 
                                            "package_pname^3", 
                                            "package_programs^3", 
                                            "package_description^1"
                                        ],
                                        fuzziness: "AUTO"
                                    }
                                }
                            ],
                            filter: [
                                { term: { type: "package" } }
                            ]
                        }
                    },
                    size: 50
                });

                const packages = await new Promise((resolve, reject) => {
                    const req = https.request(`https://search.nixos.org/backend/${index}/_search`, {
                        method: 'POST',
                        headers: {
                            'Authorization': authHeader,
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(searchBody)
                        }
                    }, (res) => {
                        let data = '';
                        res.on('data', chunk => data += chunk);
                        res.on('end', () => {
                            if (res.statusCode !== 200) {
                                reject(new Error(`Status ${res.statusCode}: ${data}`));
                                return;
                            }
                            try {
                                const parsed = JSON.parse(data);
                                const hits = parsed.hits?.hits || [];
                                const pkgList = hits
                                  .filter((hit: any) => hit._source.type === 'package')
                                  .map((hit: any) => ({
                                      name: mapPackageName(hit._source.package_attr_name),
                                      description: hit._source.package_description || 'No description available'
                                  }));
                                resolve(pkgList);
                            } catch (e) {
                                reject(e);
                            }
                        });
                    });
                    req.on('error', reject);
                    req.write(searchBody);
                    req.end();
                });
                
                if (Array.isArray(packages) && packages.length > 0) {
                    return { success: true, packages };
                }
            } catch (e: any) {
                console.error("Online search failed, falling back to local nix search", e.message);
            }

            // 2. Fallback to `nix search nixpkgs [thing]`
            try {
                 const { stdout } = await execAsync(
                     `nix search nixpkgs "${sanitizedQuery}" --json 2>/dev/null`, // Ensure --json output
                     { timeout: 15000 }
                 );
                 if (stdout.trim()) {
                     const data = JSON.parse(stdout);
                     const packages = Object.entries(data).map(([key, info]: [string, any]) => {
                         // key is usually "legacyPackages.x86_64-linux.packageName"
                         const parts = key.split('.');
                         const name = parts[parts.length - 1]; 
                         return {
                             name: mapPackageName(name),
                             description: info.description || 'No description available'
                         };
                     }).slice(0, 50);
                     return { success: true, packages };
                 }
            } catch (e) {
                console.error("nix search failed", e);
            }

            return { success: true, packages: [] };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('git-commit', async (event, { directory, message }) => {
        try {
            await execAsync('git init', { cwd: directory });
            await execAsync('git add .', { cwd: directory });
            await execAsync(`git commit -m "${message}"`, { cwd: directory }).catch(() => {});
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });
    ipcMain.handle('git-status', async (event, { directory }) => {
        try {
            const { stdout } = await execAsync('git status --porcelain', { cwd: directory });
            return { success: true, status: stdout };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });
    ipcMain.handle('git-log', async (event, { directory }) => {
        try {
            const { stdout } = await execAsync('git log --pretty=format:"%h|%s|%ad" --date=iso', { cwd: directory });
            const log = stdout.split("\n").filter(Boolean).map(line => {
                const [hash, message, date] = line.split('|');
                return { hash, message, date };
            });
            return { success: true, log };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });
    ipcMain.handle('git-checkout', async (event, { directory, hash }) => {
        try {
            // restore everything to that hash, we can use git checkout hash -- .
            await execAsync(`git checkout ${hash} -- .`, { cwd: directory });
            await execAsync(`git commit -m "Reverted to ${hash}"`, { cwd: directory });
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('search-options', async (event, { query }) => {
        try {
            const sanitizedQuery = query.replace(/[^a-zA-Z0-9-_\. ]/g, '');
            if (sanitizedQuery.length < 2) return { success: true, services: [] };

            // 1. Try fast online search via search.nixos.org API
            try {
                const auth: any = await getSearchAuth();
                const authHeader = 'Basic ' + Buffer.from(`${auth.user}:${auth.pass}`).toString('base64');
                const index = `latest-${auth.version}-nixos-unstable`;
                const searchBody = JSON.stringify({
                    query: {
                        bool: {
                            must: [
                                {
                                    multi_match: {
                                        query: sanitizedQuery,
                                        fields: ["option_name^4", "option_description^1"],
                                        fuzziness: "AUTO"
                                    }
                                }
                            ],
                            filter: [
                                { term: { type: "option" } }
                            ]
                        }
                    },
                    size: 50
                });

                const servicesList = await new Promise((resolve, reject) => {
                    const req = https.request(`https://search.nixos.org/backend/${index}/_search`, {
                        method: 'POST',
                        headers: {
                            'Authorization': authHeader,
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(searchBody)
                        }
                    }, (res) => {
                        let data = '';
                        res.on('data', chunk => data += chunk);
                        res.on('end', () => {
                            if (res.statusCode !== 200) {
                                reject(new Error(`Status ${res.statusCode}`));
                                return;
                            }
                            try {
                                const parsed = JSON.parse(data);
                                const hits = parsed.hits?.hits || [];
                                
                                const uniqueResults = new Set<string>();
                                const services: any[] = [];
                                
                                for (const hit of hits) {
                                    if (hit._source.type !== 'option') continue;
                                    let optionName = hit._source.option_name;
                                    
                                    let displayName = optionName;
                                    if (displayName.endsWith('.enable')) displayName = displayName.slice(0, -7);
                                    
                                    // Make sure it doesn't just return generic top-level namespaces
                                    if (displayName.includes('.') && !uniqueResults.has(displayName)) {
                                        uniqueResults.add(displayName);
                                        services.push({
                                            name: displayName,
                                            description: (hit._source.option_description || '').replace(/<[^>]+>/g, '').substring(0, 150),
                                            options: {}
                                        });
                                    }
                                    if (services.length >= 30) break;
                                }
                                resolve(services);
                            } catch (e) {
                                reject(e);
                            }
                        });
                    });
                    req.on('error', reject);
                    req.write(searchBody);
                    req.end();
                });
                
                if (Array.isArray(servicesList) && servicesList.length > 0) {
                    return { success: true, services: servicesList };
                }
            } catch (e) {
                console.error("Online options search failed, falling back to local man page search", e);
            }

            // 2. Fallback to `man configuration.nix` search
            try {
                const { stdout } = await execAsync(`man -P cat configuration.nix | col -b`, { maxBuffer: 10 * 1024 * 1024 });
                
                const lines = stdout.split('\n');
                const uniqueResults = new Set<string>();
                const services: any[] = [];

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line.toLowerCase().includes(sanitizedQuery.toLowerCase())) {
                        const match = line.match(/\b(services|programs|networking|boot|security|hardware|environment|users|virtualisation|systemd|console|fonts|i18n|location|nix|nixpkgs|powerManagement|qt|security|services|sound|time|xdg)\.[a-zA-Z0-9\.]+\b/);
                        
                        if (match) {
                            const optionName = match[0];
                            if (!uniqueResults.has(optionName) && optionName.includes('.')) {
                                uniqueResults.add(optionName);
                                
                                let displayName = optionName;
                                if (displayName.endsWith('.enable')) displayName = displayName.slice(0, -7);
                                
                                if (displayName.includes('/') || displayName.includes('://')) continue;

                                services.push({
                                    name: displayName,
                                    options: {} 
                                });
                            }
                        }
                    }
                    if (services.length >= 30) break;
                }

                return { success: true, services };

            } catch (e) {
                 console.error("man search failed", e);
                 return { success: false, error: "Man page search failed" };
            }
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
