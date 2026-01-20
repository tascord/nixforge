import React, { useEffect, useRef } from 'react';
import { X, Terminal, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { ansiToHtml } from '../utils/ansiToHtml';

interface BuildModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: string[];
  status: 'idle' | 'building' | 'success' | 'error';
  command: string;
}

export const BuildModal: React.FC<BuildModalProps> = ({ isOpen, onClose, logs, status, command }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-3xl rounded-xl border border-border shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/10">
          <div className="flex items-center gap-3">
             <div className={`p-2 rounded-lg ${
                status === 'building' ? 'bg-blue-500/10 text-blue-500' :
                status === 'success' ? 'bg-green-500/10 text-green-500' :
                status === 'error' ? 'bg-red-500/10 text-red-500' :
                'bg-secondary text-muted-foreground'
             }`}>
                {status === 'building' ? <Loader2 className="animate-spin" size={20} /> :
                 status === 'success' ? <CheckCircle2 size={20} /> :
                 status === 'error' ? <AlertTriangle size={20} /> :
                 <Terminal size={20} />}
             </div>
             <div>
               <h3 className="font-semibold text-lg">System Build</h3>
               <p className="text-xs text-muted-foreground font-mono">{command}</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Logs Terminal */}
        <div className="flex-1 bg-[#0d1117] p-4 font-mono text-xs md:text-sm overflow-y-auto min-h-[300px]" ref={scrollRef}>
            {logs.length === 0 && status === 'idle' && (
                <div className="text-muted-foreground/50 text-center mt-10">Waiting to start...</div>
            )}
            {logs.map((log, i) => (
                <div key={i} className="break-all whitespace-pre-wrap text-gray-300 border-l-2 border-transparent pl-2 hover:bg-white/5 hover:border-gray-700">
                    <span dangerouslySetInnerHTML={{ __html: ansiToHtml(log) }} />
                </div>
            ))}
            {status === 'building' && (
                <div className="animate-pulse h-4 w-3 bg-primary/50 mt-1 inline-block" />
            )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-secondary/5 flex justify-end gap-3">
           {status === 'building' ? (
               <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
                   <Loader2 size={12} className="animate-spin" />
                   Building configuration...
               </div>
           ) : (
               <button 
                onClick={onClose}
                className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-md text-sm font-medium transition-colors"
               >
                 Close
               </button>
           )}
        </div>
      </div>
    </div>
  );
};
