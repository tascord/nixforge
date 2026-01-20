import React, { useState, useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { Navigation } from './components/Navigation';
import { PackageSelector } from './components/PackageSelector';
import { ServiceSelector } from './components/ServiceSelector';
import { CodeEditor } from './components/CodeEditor';
import { ImportModal } from './components/ImportModal';
import { BuildModal } from './components/BuildModal';
import { INITIAL_CONFIG, COMMON_GROUPS, HARDWARE_PRESETS, NIX_VERSIONS } from './constants';
import { PACKAGE_GROUPS } from './packageGroups';
import { AppConfig, Tab, NixPackage, NixService, GeneratedFile, PackageGroup } from './types';
import { generateFlake, generateSystemConfig, generateHomeConfig, mergeWithExisting } from './utils/nixGenerator';
import { parseExistingConfig, parseHomeConfig, parseFlakeConfig } from './utils/nixImporter';
import { Monitor, HardDrive, AlertTriangle, Globe, Layout, Disc, Layers, GitBranch, Download, Import, Play, Power, Hammer, FolderOpen, Loader2, LayoutTemplate, Code, Gamepad2, Package, Plus, Trash2, Link } from 'lucide-react';


export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.GENERAL);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Build State
  const [isBuildOpen, setIsBuildOpen] = useState(false);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [buildStatus, setBuildStatus] = useState<'idle' | 'building' | 'success' | 'error'>('idle');
  const [buildCmd, setBuildCmd] = useState('');
  const [isGeneratingHardware, setIsGeneratingHardware] = useState(false);
  const [showHardwareWarning, setShowHardwareWarning] = useState(false);
  const [pendingBuildAction, setPendingBuildAction] = useState<'switch' | 'boot' | null>(null);
  
  // Flake Input State
  const [newInputName, setNewInputName] = useState('');
  const [newInputUrl, setNewInputUrl] = useState('');
  
  // We now force ~/.nixforge
  const PROJECT_DIR_NAME = '.nixforge';
  const [homeDir, setHomeDir] = useState<string | null>(null);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  React.useEffect(() => {
    // Load persisted state if available
    const loadState = async () => {
        if (!window.electronAPI) {
            setConfig(INITIAL_CONFIG);
            setIsLoading(false);
            return;
        }

        try {
            const { userData, home } = await window.electronAPI.getAppPaths();
            setHomeDir(home);
            
            // 1. Try to load internal state (UI preferences, full object graph)
            // Use system hostname/username as default if available
            let loadedConfig = JSON.parse(JSON.stringify(INITIAL_CONFIG)) as AppConfig;
            
            // Hostname/Username injection removed as API does not provide them anymore

            let loadedFromState = false;

            const statePath = `${userData}/nixforge-state.json`;
            const { exists: stateExists } = await window.electronAPI.checkFileExists(statePath);
            
            if (stateExists) {
                const { success, content } = await window.electronAPI.readFile(statePath);
                if (success && content) {
                    try {
                        loadedConfig = JSON.parse(content);
                        loadedFromState = true;
                        console.log("State loaded from disk.");
                    } catch (err) {
                        console.error("Failed to parse saved state", err);
                    }
                }
            }

            // 2. Try to sync with actual files in ~/.nixforge
            // User requested: "read everything between the marker tags"
            const configPath = `${home}/.nixforge`;
            const metadataPath = `${configPath}/metadata.json`;
            const sysPath = `${configPath}/configuration.nix`;
            const homePath = `${configPath}/home.nix`;
            const flakePath = `${configPath}/flake.nix`;
            const hardwarePath = `${configPath}/hardware-configuration.nix`;
            
            // Check if folders/files exist
            const { exists: hasMetadata } = await window.electronAPI.checkFileExists(metadataPath);
            const { exists: hasSys } = await window.electronAPI.checkFileExists(sysPath);
            const { exists: hasHome } = await window.electronAPI.checkFileExists(homePath);
            const { exists: hasFlake } = await window.electronAPI.checkFileExists(flakePath);
            const { exists: hasHardware } = await window.electronAPI.checkFileExists(hardwarePath);

            // Prefer loading from metadata.json as it contains the full UI state (descriptions, specific selections)
            // We only fall back to parsing raw Nix files if metadata is missing.
            let loadedFromMetadata = false;
            if (hasMetadata) {
                console.log("Found metadata.json, loading state...");
                const { content: metaContent } = await window.electronAPI.readFile(metadataPath);
                if (metaContent) {
                    try {
                        const parsedMeta = JSON.parse(metaContent);
                        // Ensure we strictly type check or merge with defaults to avoid missing keys
                        // But for now, assuming metadata matches AppConfig
                        loadedConfig = { ...INITIAL_CONFIG, ...parsedMeta };
                        loadedFromMetadata = true;
                    } catch (e) {
                         console.error("Failed to parse metadata.json", e);
                    }
                }
            }

            if (!loadedFromMetadata && hasSys && hasHome) {
                console.log("Reading existing configuration from disk (Parsing Nix Files)...");
                
                const { content: sysContent } = await window.electronAPI.readFile(sysPath);
                const { content: homeContent } = await window.electronAPI.readFile(homePath);
                
                if (sysContent) {
                    loadedConfig = parseExistingConfig(sysContent, loadedConfig);
                }
                if (homeContent) {
                    loadedConfig = parseHomeConfig(homeContent, loadedConfig, 0); // Assume first user
                }
                if (hasHardware) {
                    const { content: hardwareContent } = await window.electronAPI.readFile(hardwarePath);
                    if (hardwareContent) {
                        loadedConfig.system.hardwareConfigContent = hardwareContent;
                    }
                }
                if (hasFlake) {
                    const { content: flakeContent } = await window.electronAPI.readFile(flakePath);
                    if (flakeContent) {
                        loadedConfig = parseFlakeConfig(flakeContent, loadedConfig);
                    }
                }
            } else if (loadedFromMetadata) {
                // If we loaded from metadata, strictly check if we need to sync hardware/flake content 
                // that might be newer on disk? Usually metadata is single source of truth for the APP.
                // But hardware-configuration.nix is NOT managed in metadata fully (re-read it just in case).
                if (hasHardware) {
                     const { content: hardwareContent } = await window.electronAPI.readFile(hardwarePath);
                     if (hardwareContent) {
                         loadedConfig.system.hardwareConfigContent = hardwareContent;
                     }
                }
            }
            
            setConfig(loadedConfig);

        } catch (e) {
            console.error("Failed to load state", e);
            setConfig(INITIAL_CONFIG);
        } finally {
            // Fake delay for effect? Or just small timeout to prevent jumpiness
            setTimeout(() => setIsLoading(false), 500);
        }
    };
    loadState();
  }, []);
  
  React.useEffect(() => {
    // Listen for build logs
    if (window.electronAPI) {
        window.electronAPI.onBuildLog((log: string) => {
            setBuildLogs(prev => {
                // If the log contains carriage return or erase sequences, 
                // it often means we should replace the last line instead of appending.
                // nh uses these for the timer and progress updates.
                if (log.includes('\r') || log.includes('\u001b[2K') || log.includes('\u001b[1G')) {
                    // Try to see if this is just a progress update
                    // We remove the last entry and add the new one
                    const newLogs = [...prev];
                    // Strip the control codes from the start to see if it's just a refresh
                    const cleanLog = log.replace(/^[\r\u001b\[\?[0-9;]*[a-zA-Z]]*/, '').trim();
                    
                    if (prev.length > 0 && (log.includes('⏱') || cleanLog.length > 0)) {
                        // If it's a timer or starts with a rewrite code, replace last line
                        newLogs[newLogs.length - 1] = log;
                        return newLogs;
                    }
                }
                return [...prev, log];
            });
        });
        
        window.electronAPI.onBuildExit((code: number) => {
             setBuildStatus(code === 0 ? 'success' : 'error');
             setBuildLogs(prev => [...prev, `\nProcess exited with code ${code}`]);
        });
    }
  }, []);

  React.useEffect(() => {
    // Save config to disk whenever it changes, with debouncing
    const timer = setTimeout(() => {
      if (config && window.electronAPI) {
          console.log("Saving config:", config);
          window.electronAPI.saveConfig(config).then(result => {
              if (!result.success) {
                  console.error("Failed to save config:", result.error);
              } else {
                  console.log("Config saved successfully");
              }
          }).catch(err => {
              console.error("Failed to save config:", err);
          });
      }
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timer);
  }, [config]);

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <Loader2 className="animate-spin h-10 w-10" />
      </div>
    );
  }

  const getProjectPath = () => {
      if (!homeDir) return null;
      return `${homeDir}/${PROJECT_DIR_NAME}`;
  };

  const ensureProjectDir = async () => {
      if (!window.electronAPI || !homeDir) return null;
      const path = getProjectPath();
      if (!path) return null;

      // Check if exists? We can just try to write.
      // Or we can use selectDirectory to pick it? No, we force it now.
      // we assume the electronAPI handles creating dirs when writing files?
      // Usually writeFile logic handles dirname, but let's check.
      // Ideally we'd have a mkdir check. Use runCommand 'mkdir -p' via main?
      // For now, let's assume standard fs.writeFile (in node usually doesn't create recursive dirs).
      // We need to check if we can run command.
      
      // Let's assume the user has created it or we'll rely on the build system failure if not.
      // Better: Use checkFileExists on the dir.
      return path;
  };

  const handleOpenConfigFolder = async () => {
       const path = getProjectPath();
       if (!path) {
           alert("Configuration folder path not determined yet. Please restart the app.");
           return;
       }
       if (path && window.electronAPI) {
           await window.electronAPI.openFolder(path);
       }
  };

  // Deprecated manual export
  const handleExport = async () => {
      alert("This setup is now managed automatically in ~/.nixforge");
  };

  const handleRunBuild = async (action: 'switch' | 'boot', bypassWarning = false) => {
      // If we're booting and hardware config hasn't been explicitly set or detected, warn the user.
      // This helps avoid the "stuck at /dev/sda1" issue if environmental detection fails.
      if (!bypassWarning && action === 'boot' && !config.system.hardwareConfigContent) {
          setPendingBuildAction(action);
          setShowHardwareWarning(true);
          return;
      }

      const projectPath = getProjectPath();
      if (!window.electronAPI) {
          alert("Electron API not found. This feature requires the desktop application.");
          return;
      }
      if (!projectPath) {
          alert("System paths not loaded. Please restart the application to initialize the environment.");
          return;
      }

      setBuildStatus('building');
      setBuildLogs(['Starting build process...', `Target: ${projectPath}`, 'Generating configuration...']);
      setIsBuildOpen(true);
      
      try {
        // 1. Generate new content
        const flakeContent = generateFlake(config);
        const systemConfigNew = generateSystemConfig(config);
        const homeConfigNew = generateHomeConfig(config.users[0], config.nixVersion);

        // 2. Read existing content for merging
        // We only care about configuration.nix and home.nix for merging. Flake is usually fully managed or static.
        
        let finalSystemConfig = systemConfigNew;
        let finalHomeConfig = homeConfigNew;

        const sysPath = `${projectPath}/configuration.nix`;
        const { exists: sysExists } = await window.electronAPI.checkFileExists(sysPath);
        if (sysExists) {
             const { content } = await window.electronAPI.readFile(sysPath);
             if (content) {
                 finalSystemConfig = mergeWithExisting(content, systemConfigNew);
                 setBuildLogs(prev => [...prev, 'Merged with existing configuration.nix']);
             }
        }

        const homePath = `${projectPath}/home.nix`;
        const { exists: homeExists } = await window.electronAPI.checkFileExists(homePath);
        if (homeExists) {
             const { content } = await window.electronAPI.readFile(homePath);
             if (content) {
                 finalHomeConfig = mergeWithExisting(content, homeConfigNew);
                 setBuildLogs(prev => [...prev, 'Merged with existing home.nix']);
             }
        }
        
        // 3. Write files
        // Ensure directory exists by piggybacking on a command or trying to write.
        // If write fails, we might need a mkdir tool.
        // Let's try writing.
        await window.electronAPI.writeFile(`${projectPath}/flake.nix`, flakeContent);
        await window.electronAPI.writeFile(sysPath, finalSystemConfig);
        await window.electronAPI.writeFile(homePath, finalHomeConfig);
        await window.electronAPI.writeFile(`${projectPath}/metadata.json`, JSON.stringify(config, null, 2));
        
        // Hardware config: only write if redundant or missing? 
        // Best to only write if we actually have one from the generator tool.
        if (config.system.hardwareConfigContent) {
            await window.electronAPI.writeFile(`${projectPath}/hardware-configuration.nix`, config.system.hardwareConfigContent);
        }

        setBuildLogs(prev => [...prev, 'Files written to disk.', 'Invoking build command...']);

        const isNh = true; 
        const cmd = isNh 
            ? `nh os ${action} ${projectPath}` 
            : `nixos-rebuild ${action} --flake ${projectPath}#${config.system.hostname} --use-remote-sudo`;
        
        setBuildCmd(cmd);
        
        window.electronAPI.runBuild({
            directory: projectPath,
            action: action,
            flakeURI: `${projectPath}#${config.system.hostname}`
        });

      } catch (e: any) {
          console.error(e);
          setBuildStatus('error');
          setBuildLogs(prev => [...prev, `Error: ${e.message}`]);
      }
  };


  const updateSystem = (updates: Partial<typeof config.system>) => {
    setConfig(prev => ({ ...prev, system: { ...prev.system, ...updates } }));
  };

  const handleGenerateHardware = async () => {
    if (!window.electronAPI) return;
    setIsGeneratingHardware(true);
    try {
        const result = await window.electronAPI.generateHardwareConfig();
        if (result.success && result.content) {
            updateSystem({ hardwareConfigContent: result.content });
        } else {
            console.error("Failed to generate hardware config:", result.error);
            alert("Could not generate hardware configuration automatically. Make sure you are on a NixOS system or manually paste your config.");
        }
    } catch (e) {
        console.error(e);
    } finally {
        setIsGeneratingHardware(false);
    }
  };

  const updateUser = (index: number, updates: Partial<typeof config.users[0]>) => {
    const newUsers = [...config.users];
    const user = newUsers[index];

    // Auto-populate description if it's generic and username changes
    if (updates.username && (user.description === 'Primary User' || user.description === '')) {
       updates.description = updates.username.charAt(0).toUpperCase() + updates.username.slice(1);
    }

    newUsers[index] = { ...user, ...updates };
    setConfig(prev => ({ ...prev, users: newUsers }));
  };

  const handleAddSystemPackage = (pkg: NixPackage) => {
    if (!config.system.systemPackages.find(p => p.name === pkg.name)) {
      updateSystem({ systemPackages: [...config.system.systemPackages, pkg] });
    }
  };

  const handleRemoveSystemPackage = (pkgName: string) => {
    updateSystem({ systemPackages: config.system.systemPackages.filter(p => p.name !== pkgName) });
  };

  const handleAddUserPackage = (userIndex: number, pkg: NixPackage) => {
     const user = config.users[userIndex];
     if (!user.packages.find(p => p.name === pkg.name)) {
         updateUser(userIndex, { packages: [...user.packages, pkg] });
     }
  };

  const handleRemoveUserPackage = (userIndex: number, pkgName: string) => {
    const user = config.users[userIndex];
    updateUser(userIndex, { packages: user.packages.filter(p => p.name !== pkgName) });
  };

  const handleToggleService = (service: NixService) => {
    const existingIndex = config.system.services.findIndex(s => s.name === service.name);
    let newServices = [...config.system.services];

    if (existingIndex > -1) {
        // Toggle
        newServices[existingIndex] = { 
            ...newServices[existingIndex], 
            enabled: !newServices[existingIndex].enabled 
        };
    } else {
        // Add
        newServices.push({ ...service, enabled: true });
    }
    updateSystem({ services: newServices });
  };

  const handleUpdateService = (updatedService: NixService) => {
    const newServices = config.system.services.map(s => 
        s.name === updatedService.name ? updatedService : s
    );
    updateSystem({ services: newServices });
  }

  const handleAddFlakeInput = () => {
    if (!newInputName || !newInputUrl) {
        alert("Please provide both a name and a URL.");
        return;
    }
    const currentInputs = config?.flakeInputs || [];
    if (currentInputs.find(i => i.name === newInputName)) {
        alert("Input with this name already exists");
        return;
    }
    setConfig(prev => prev ? ({
        ...prev,
        flakeInputs: [...(prev.flakeInputs || []), { name: newInputName, url: newInputUrl }]
    }) : null);
    setNewInputName('');
    setNewInputUrl('');
  };

  const handleRemoveFlakeInput = (name: string) => {
    setConfig(prev => prev ? ({
        ...prev,
        flakeInputs: (prev.flakeInputs || []).filter(i => i.name !== name)
    }) : null);
  };

  const renderContent = () => {
    switch (activeTab) {
      case Tab.GENERAL:
        return (
          <div className="space-y-8 max-w-5xl animate-fade-in">
            {/* Top Row: Identity & Locale */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-5 bg-card p-6 rounded-lg border border-border shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                    <Globe size={18} className="text-muted-foreground" />
                    <h2 className="text-lg font-semibold tracking-tight">System Identity</h2>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase">Hostname</label>
                    <input
                        type="text"
                        value={config.system.hostname}
                        onChange={(e) => updateSystem({ hostname: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase">Timezone</label>
                    <input
                        type="text"
                        value={config.system.timezone}
                        onChange={(e) => updateSystem({ timezone: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="space-y-1 pt-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1">
                        <GitBranch size={12}/> Nix Version
                    </label>
                    <select
                        value={config.nixVersion}
                        onChange={(e) => setConfig(prev => ({ ...prev, nixVersion: e.target.value }))}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                        {NIX_VERSIONS.map(v => (
                            <option key={v.id} value={v.id}>{v.label}</option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-5 bg-card p-6 rounded-lg border border-border shadow-sm">
                 <div className="flex items-center gap-2 mb-2">
                    <Layout size={18} className="text-muted-foreground" />
                    <h2 className="text-lg font-semibold tracking-tight">Locale & Input</h2>
                 </div>
                 <div className="space-y-3">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground uppercase">Default Locale</label>
                        <input
                            type="text"
                            value={config.system.locale}
                            onChange={(e) => updateSystem({ locale: e.target.value })}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground uppercase">Keyboard Layout</label>
                        <input
                            type="text"
                            value={config.system.keyboardLayout}
                            onChange={(e) => updateSystem({ keyboardLayout: e.target.value })}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                    </div>
                </div>
              </div>
            </div>
          </div>
        );

      case Tab.HARDWARE:
        return (
          <div className="space-y-8 max-w-4xl">
             <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-md flex gap-3 items-start">
                <AlertTriangle className="text-yellow-500 shrink-0 mt-0.5" size={20}/>
                <div>
                    <h4 className="text-yellow-500 font-medium text-sm">Config Generator Note</h4>
                    <p className="text-xs text-yellow-500/70 mt-1">This tool generates generic config. You must still generate <code>hardware-configuration.nix</code> on the target machine.</p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-5">
                    <h2 className="text-lg font-semibold tracking-tight">Bootloader</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => updateSystem({ bootloader: 'systemd-boot' })}
                            className={`p-4 rounded-md border flex flex-col items-center gap-2 transition-all ${config.system.bootloader === 'systemd-boot' ? 'bg-secondary border-primary text-foreground' : 'bg-card border-border text-muted-foreground hover:bg-secondary/50'}`}
                        >
                            <Monitor size={24} />
                            <span className="font-semibold text-sm">systemd-boot</span>
                            <span className="text-xs opacity-70">Modern, EFI</span>
                        </button>
                        <button
                            onClick={() => updateSystem({ bootloader: 'grub' })}
                            className={`p-4 rounded-md border flex flex-col items-center gap-2 transition-all ${config.system.bootloader === 'grub' ? 'bg-secondary border-primary text-foreground' : 'bg-card border-border text-muted-foreground hover:bg-secondary/50'}`}
                        >
                            <HardDrive size={24} />
                            <span className="font-semibold text-sm">GRUB</span>
                            <span className="text-xs opacity-70">Legacy & EFI</span>
                        </button>
                    </div>
                </div>

                <div className="space-y-5">
                    <h2 className="text-lg font-semibold tracking-tight">System Resources</h2>
                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none">Swap Size (GB)</label>
                        <div className="flex items-center gap-2">
                            <Disc className="text-muted-foreground" size={16}/>
                            <input
                                type="number"
                                min="0"
                                value={config.system.swapSize}
                                onChange={(e) => updateSystem({ swapSize: Number(e.target.value) })}
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">Set to 0 to disable swap file generation.</p>
                    </div>

                     <div className="space-y-2">
                        <label className="text-sm font-medium leading-none">Hardware Profile (nixos-hardware)</label>
                        <select 
                            value={config.system.hardwareProfile}
                            onChange={(e) => updateSystem({ hardwareProfile: e.target.value })}
                            className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                            {HARDWARE_PRESETS.map(p => (
                                <option key={p.id} value={p.id}>{p.label}</option>
                            ))}
                        </select>
                         <p className="text-xs text-muted-foreground">Select a preset to include <code>nixos-hardware</code> modules.</p>
                    </div>
                </div>
             </div>

             <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold tracking-tight">File Systems & Hardware</h2>
                        <p className="text-sm text-muted-foreground">The contents of <code>hardware-configuration.nix</code>. If left blank, it will be auto-generated during build.</p>
                    </div>
                    <button 
                        onClick={handleGenerateHardware}
                        disabled={isGeneratingHardware}
                        className="flex items-center gap-2 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground rounded-md text-xs font-medium transition-colors"
                    >
                        {isGeneratingHardware ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
                        Detect Current Hardware
                    </button>
                </div>
                <div className="border rounded-md overflow-hidden bg-[#0d1117]">
                    <textarea
                        value={config.system.hardwareConfigContent || ''}
                        onChange={(e) => updateSystem({ hardwareConfigContent: e.target.value })}
                        placeholder="# Paste your hardware-configuration.nix here or click 'Detect Hardware'"
                        className="w-full h-64 p-4 font-mono text-sm bg-transparent text-gray-300 focus:outline-none resize-none"
                    />
                </div>
                {(!config.system.hardwareConfigContent) && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md flex gap-2 items-start">
                        <AlertTriangle className="text-blue-500 shrink-0 mt-0.5" size={16}/>
                        <p className="text-xs text-blue-500/70">If left empty, we will try to detect your current root partition during build. Providing a explicit config is safer.</p>
                    </div>
                )}
             </div>
          </div>
        );

      case Tab.USERS:
        return (
          <div className="space-y-6 h-full flex flex-col">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight">User Configuration</h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full min-h-0">
                {/* User Details */}
                <div className="space-y-6 bg-card p-6 rounded-md border border-border shadow-sm overflow-auto">
                    <div className="flex items-center gap-3 pb-4 border-b border-border">
                        <div className="w-10 h-10 rounded-full bg-secondary text-foreground flex items-center justify-center font-bold shadow-inner">
                            {config.users[0].username && config.users[0].username.length > 0 ? config.users[0].username[0].toUpperCase() : '?'}
                        </div>
                        <div>
                            <h3 className="font-semibold">{config.users[0].username}</h3>
                            <p className="text-xs text-muted-foreground">Primary User</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                         <div className="space-y-2">
                            <label className="text-sm font-medium leading-none">Username</label>
                            <input
                                type="text"
                                value={config.users[0].username}
                                onChange={(e) => updateUser(0, { username: e.target.value })}
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none">Full Name (Description)</label>
                            <input
                                type="text"
                                value={config.users[0].description}
                                onChange={(e) => updateUser(0, { description: e.target.value })}
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none">Shell</label>
                            <select 
                                value={config.users[0].shell}
                                onChange={(e) => updateUser(0, { shell: e.target.value as any })}
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                <option value="pkgs.bash">Bash</option>
                                <option value="pkgs.zsh">Zsh</option>
                                <option value="pkgs.fish">Fish</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none">Password</label>
                            <div className="space-y-2">
                                <input
                                    type="password"
                                    placeholder="Enter password and click Generate"
                                    id="password-input"
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                                />
                                <button 
                                    onClick={async () => {
                                        const input = document.getElementById('password-input') as HTMLInputElement;
                                        const password = input.value;
                                        if (!password) {
                                            alert('Please enter a password');
                                            return;
                                        }
                                        if (!window.electronAPI) {
                                            alert('Electron API not available');
                                            return;
                                        }
                                        try {
                                            const result = await window.electronAPI.generatePasswordHash(password);
                                            if (result.success && result.hash) {
                                                updateUser(0, { hashedPassword: result.hash });
                                                input.value = '';
                                                alert('Password hash generated successfully');
                                            } else {
                                                alert(`Failed to generate hash: ${result.error}`);
                                            }
                                        } catch (e: any) {
                                            alert(`Error: ${e.message}`);
                                        }
                                    }}
                                    className="flex items-center justify-center h-9 px-3 rounded-md border border-input bg-transparent hover:bg-secondary text-sm"
                                >
                                    Generate Hash
                                </button>
                            </div>
                            {config.users[0].hashedPassword && (
                                <div className="text-xs font-mono text-muted-foreground p-2 bg-secondary/30 rounded border border-border break-all">
                                    {config.users[0].hashedPassword.substring(0, 50)}...
                                </div>
                            )}
                        </div>
                         <div className="space-y-2">
                            <label className="text-sm font-medium leading-none">Groups</label>
                            <div className="flex flex-wrap gap-2">
                                {COMMON_GROUPS.map(group => {
                                    const hasGroup = config.users[0].extraGroups.includes(group);
                                    return (
                                        <button
                                            key={group}
                                            onClick={() => {
                                                const current = config.users[0].extraGroups;
                                                const newGroups = hasGroup ? current.filter(g => g !== group) : [...current, group];
                                                updateUser(0, { extraGroups: newGroups });
                                            }}
                                            className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${hasGroup ? 'bg-secondary border-primary text-foreground font-medium' : 'bg-transparent border-input text-muted-foreground hover:bg-secondary/50'}`}
                                        >
                                            {group}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                        
                        <div className="pt-4 border-t border-border">
                            <h4 className="text-sm font-semibold mb-3">Git Configuration</h4>
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Name</label>
                                    <input
                                        type="text"
                                        placeholder="Jane Doe"
                                        value={config.users[0].gitName}
                                        onChange={(e) => updateUser(0, { gitName: e.target.value })}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Email</label>
                                    <input
                                        type="email"
                                        placeholder="jane@example.com"
                                        value={config.users[0].gitEmail}
                                        onChange={(e) => updateUser(0, { gitEmail: e.target.value })}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Home Manager Packages */}
                <PackageSelector 
                    title={`${config.users[0].username}'s Home Packages`}
                    selectedPackages={config.users[0].packages}
                    onAdd={(pkg) => handleAddUserPackage(0, pkg)}
                    onRemove={(name) => handleRemoveUserPackage(0, name)}
                />
            </div>
          </div>
        );

      case Tab.PACKAGES:
        return (
          <div className="h-full flex flex-col gap-6">
             {/* Flake Inputs Section */}
             <div className="space-y-4 shrink-0">
                 <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                        <Link size={18} />
                        Custom Flake Inputs
                    </h2>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {/* Existing Inputs */}
                     {config.flakeInputs?.map((input) => (
                         <div key={input.name} className="p-3 border border-border rounded-md bg-card flex items-center justify-between gap-3 group shadow-sm transition-all hover:border-primary/50">
                             <div className="overflow-hidden min-w-0">
                                 <div className="flex items-center gap-2 mb-0.5">
                                     <span className="font-semibold text-sm truncate">{input.name}</span>
                                 </div>
                                 <p className="text-xs text-muted-foreground truncate font-mono bg-secondary/50 px-1 py-0.5 rounded w-fit max-w-full" title={input.url}>{input.url}</p>
                             </div>
                             <button 
                                onClick={() => handleRemoveFlakeInput(input.name)}
                                className="md:opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all"
                                title="Remove Input"
                             >
                                 <Trash2 size={16} />
                             </button>
                         </div>
                     ))}
                     
                     {/* Add New Input */}
                     <div className="p-4 border border-dashed border-border rounded-md flex flex-col gap-3 bg-secondary/10 hover:bg-secondary/20 transition-colors">
                         <div className="flex gap-2 items-center">
                             <span className="text-xs font-medium text-muted-foreground w-12 text-right">Name</span>
                             <input 
                                placeholder="e.g. zen-browser"
                                value={newInputName}
                                onChange={e => setNewInputName(e.target.value)}
                                className="flex-1 min-w-0 bg-transparent text-sm border-b border-border focus:border-primary outline-none px-1 py-0.5 placeholder:text-muted-foreground/50"
                             />
                         </div>
                         <div className="flex gap-2 items-center">
                             <span className="text-xs font-medium text-muted-foreground w-12 text-right">URL</span>
                             <input 
                                placeholder="github:0xc000002046/zen-browser-flake"
                                value={newInputUrl}
                                onChange={e => setNewInputUrl(e.target.value)}
                                className="flex-1 min-w-0 bg-transparent text-sm border-b border-border focus:border-primary outline-none px-1 py-0.5 placeholder:text-muted-foreground/50"
                             />
                         </div>
                         <div className="flex justify-end mt-1">
                             <button 
                                onClick={handleAddFlakeInput}
                                disabled={!newInputName || !newInputUrl}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                             >
                                 <Plus size={14} />
                                 Add Input
                             </button>
                         </div>
                     </div>
                 </div>
            </div>

            <div className="flex-1 min-h-0 border-t border-border pt-6">
                <PackageSelector 
                    title="System-wide Packages"
                    selectedPackages={config.system.systemPackages}
                    onAdd={handleAddSystemPackage}
                    onRemove={handleRemoveSystemPackage}
                />
            </div>
          </div>
        );

      case Tab.SERVICES:
        return (
          <div className="h-full">
             <ServiceSelector 
                title="System Services"
                services={config.system.services}
                onToggle={handleToggleService}
                onUpdate={handleUpdateService}
             />
          </div>
        );

      case Tab.CODE:
         const generatedFiles: GeneratedFile[] = React.useMemo(() => [
             { name: 'flake.nix', content: generateFlake(config), language: 'nix' },
             { name: 'configuration.nix', content: generateSystemConfig(config), language: 'nix' },
             { name: 'home.nix', content: generateHomeConfig(config.users[0], config.nixVersion), language: 'nix' }
         ], [config]);

        return (
          <div className="h-full min-h-0">
             <CodeEditor files={generatedFiles} />
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
      return (
          <div className="flex flex-col h-screen bg-background items-center justify-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="flex flex-col items-center gap-1">
                  <h3 className="text-lg font-semibold">Initializing NixForge</h3>
                  <p className="text-sm text-muted-foreground">Reading configuration...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} onRunBuild={handleRunBuild} theme={theme} setTheme={setTheme} />
      
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card/50 backdrop-blur-sm">
             <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <span>Configuration</span>
                <span className="text-border">/</span>
                <span className="text-foreground font-medium">{activeTab}</span>
             </div>
             
             <button onClick={handleOpenConfigFolder} className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-foreground border border-border rounded-md hover:bg-secondary/80 text-sm font-medium transition-colors shadow-sm ml-2">
                 <FolderOpen size={16} />
                 Open Config Folder (~/.nixforge)
             </button>
        </header>

        <div className="flex-1 p-6 overflow-auto relative bg-background">
           {renderContent()}
        </div>
      </main>

      <ImportModal 
        isOpen={false} // Disabled logic
        onClose={() => {}} 
        currentConfig={config}
        onImportComplete={(newConfig) => {
            setConfig(newConfig);
        }}
      />
      
      <BuildModal
        isOpen={isBuildOpen}
        onClose={() => setIsBuildOpen(false)}
        logs={buildLogs}
        status={buildStatus}
        command={buildCmd}
      />

      {/* Hardware Warning Modal */}
      {showHardwareWarning && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md rounded-xl border border-border shadow-2xl flex flex-col p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-yellow-500 mb-4">
              <AlertTriangle size={24} />
              <h3 className="font-semibold text-lg text-foreground">Missing Hardware Configuration</h3>
            </div>
            
            <p className="text-sm text-muted-foreground mb-6">
              You haven't generated or provided a hardware configuration yet. 
              Applying a <strong>boot</strong> configuration without one might result in a system that won't boot 
              properly if disk detection fails.
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  setShowHardwareWarning(false);
                  setActiveTab(Tab.HARDWARE);
                }}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium transition-colors hover:bg-primary/90"
              >
                Go to Hardware Tab to Detect
              </button>
              
              <button 
                onClick={() => {
                  setShowHardwareWarning(false);
                  if (pendingBuildAction) {
                    handleRunBuild(pendingBuildAction, true);
                  }
                }}
                className="w-full px-4 py-2 bg-secondary text-foreground rounded-md text-sm font-medium transition-colors hover:bg-secondary/80"
              >
                Continue Anyway (Auto-detect during build)
              </button>

              <button 
                onClick={() => setShowHardwareWarning(false)}
                className="w-full px-4 py-2 border border-border text-muted-foreground rounded-md text-sm font-medium transition-colors hover:bg-secondary/50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
