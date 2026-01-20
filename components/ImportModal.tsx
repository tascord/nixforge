import React, { useState, useEffect } from 'react';
import { X, FolderOpen, AlertCircle, Check, ArrowRight, Save } from 'lucide-react';
import { AppConfig } from '../types';
import { parseExistingConfig, parseHomeConfig } from '../utils/nixImporter';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: AppConfig;
  onImportComplete: (newConfig: AppConfig) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, currentConfig, onImportComplete }) => {
  const [systemPath, setSystemPath] = useState('/etc/nixos/configuration.nix');
  const [homePath, setHomePath] = useState(''); // Will default to ~/.config/home-manager/home.nix usually
  const [status, setStatus] = useState<'idle' | 'reading' | 'parsing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [homeBase, setHomeBase] = useState('');
  const [userDataFolder, setUserDataFolder] = useState('');

  useEffect(() => {
    if (window.electronAPI) {
        window.electronAPI.getAppPaths().then(paths => {
            setHomeBase(paths.home);
            setUserDataFolder(paths.userData);
            setHomePath(`${paths.home}/.config/home-manager/home.nix`);
        });
    }
  }, []);

  const handleBrowse = async (field: 'system' | 'home') => {
      // Just a stub - in reality we might want a pure file picker if supported, 
      // but selectDirectory is what we have or we can assume manual input for now 
      // as creating a robust file picker from scratch is complex.
      // Assuming users can type path or we rely on defaults.
      // If we really wanted file picking we'd need to update IPC to allow 'openFile' property.
  };

  const handleImport = async () => {
    if (!window.electronAPI) return;
    setStatus('reading');
    setErrorMsg('');

    try {
        let tempConfig = { ...currentConfig };
        let importCount = 0;

        // Import System Config
        const { exists: sysExists } = await window.electronAPI.checkFileExists(systemPath);
        if (sysExists) {
            const sysResult = await window.electronAPI.readFile(systemPath);
            if (sysResult.success && sysResult.content) {
                tempConfig = parseExistingConfig(sysResult.content, tempConfig);
                importCount++;
            }
        }

        // Import Home Config
        const { exists: homeExists } = await window.electronAPI.checkFileExists(homePath);
        if (homeExists) {
            const homeResult = await window.electronAPI.readFile(homePath);
            if (homeResult.success && homeResult.content) {
                tempConfig = parseHomeConfig(homeResult.content, tempConfig);
                importCount++;
            }
        }

        // Import/Generate Hardware Config
        try {
            // First try to generate fresh one
           const genResult = await window.electronAPI.generateHardwareConfig();
           if (genResult.success && genResult.content) {
               tempConfig.system.hardwareConfigContent = genResult.content;
           } else {
               // Fallback to reading file
               const hwPath = '/etc/nixos/hardware-configuration.nix';
               const { exists: hwExists } = await window.electronAPI.checkFileExists(hwPath);
               if (hwExists) {
                   const hwResult = await window.electronAPI.readFile(hwPath);
                   if (hwResult.success && hwResult.content) {
                        tempConfig.system.hardwareConfigContent = hwResult.content;
                   }
               } else {
                   setErrorMsg(prev => prev + " (Could not generate or find hardware-configuration.nix)");
               }
           }
        } catch (e) {
            console.warn("Hardware config import failed", e);
        }

        if (importCount === 0) {
            setErrorMsg("Could not find valid configuration files at the specified paths.");
            setStatus('error');
            return;
        }

        setStatus('success');
        
        // Save to internal state file
        const statePath = `${userDataFolder}/nixforge-state.json`;
        await window.electronAPI.writeFile(statePath, JSON.stringify(tempConfig, null, 2));

        setTimeout(() => {
            onImportComplete(tempConfig);
        }, 1000);

    } catch (e: any) {
        setErrorMsg(e.message || "Unknown error during import");
        setStatus('error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-lg border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-2">
             <div className="p-2 bg-emerald-500/10 rounded-lg">
                <FolderOpen className="text-emerald-500" size={20} />
             </div>
             <h3 className="font-semibold text-lg">Import Configuration</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">System Configuration</label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            className="flex-1 bg-secondary/30 border border-border rounded-md px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-emerald-500 outline-none"
                            value={systemPath}
                            onChange={(e) => setSystemPath(e.target.value)}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">Usually /etc/nixos/configuration.nix</p>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Home Manager Configuration</label>
                    <div className="flex gap-2">
                         <input 
                            type="text" 
                            className="flex-1 bg-secondary/30 border border-border rounded-md px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-emerald-500 outline-none"
                            value={homePath}
                            onChange={(e) => setHomePath(e.target.value)}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">Usually ~/.config/home-manager/home.nix</p>
                </div>
            </div>

            {errorMsg && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 text-red-400 text-sm rounded-md border border-red-500/20">
                    <AlertCircle size={16} />
                    {errorMsg}
                </div>
            )}

            {status === 'success' && (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/10 text-emerald-400 text-sm rounded-md border border-emerald-500/20">
                    <Check size={16} />
                    Configuration imported and saved!
                </div>
            )}
        </div>

        <div className="p-4 border-t border-border bg-secondary/10 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 hover:bg-secondary/50 rounded-md text-sm font-medium transition-colors">
                Cancel
            </button>
            <button 
                onClick={handleImport} 
                disabled={status === 'reading' || status === 'success'}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
                {status === 'reading' ? (
                     <>Processing...</>
                ) : status === 'success' ? (
                     <>Loaded!</>
                ) : (
                    <>
                        Start Import
                        <ArrowRight size={16} />
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};
