import React, { useState, useEffect } from 'react';
import { History, X, RotateCcw } from 'lucide-react';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string | null;
  onRevertComplete: () => void;
}

export function VersionHistoryModal({ isOpen, onClose, projectPath, onRevertComplete }: VersionHistoryModalProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && projectPath) {
      loadHistory();
    }
  }, [isOpen, projectPath]);

  const loadHistory = async () => {
    if (!projectPath) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.gitLog(projectPath);
      if (result.success && result.log) {
        setLogs(result.log);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleRevert = async (hash: string) => {
    if (!projectPath) return;
    if (!confirm('Are you sure you want to revert to ' + hash + '? This will overwrite your current configuration.')) return;
    
    setLoading(true);
    try {
      const result = await window.electronAPI.gitCheckout(projectPath, hash);
      if (result.success) {
        alert("Successfully reverted to configuration at " + hash);
        onRevertComplete();
        onClose();
      } else {
        alert("Failed to revert: " + result.error);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-2xl max-[80vh] rounded-xl border border-border shadow-2xl flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <History className="text-primary" size={24} />
          <h3 className="font-semibold text-lg text-foreground flex-1">Version History</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 flex-1 overflow-auto">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading history...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No history available yet.</div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.hash} className="flex items-center justify-between p-3 border border-border rounded-lg bg-secondary/20">
                  <div>
                    <div className="font-medium text-foreground">{log.message}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {log.hash} • {new Date(log.date).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevert(log.hash)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-md hover:bg-primary/20 transition-colors"
                  >
                    <RotateCcw size={14} />
                    Revert
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
