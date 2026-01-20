import React, { useState, useRef, useEffect } from 'react';
import { NixService, NixValue, NixOptionMetadata } from '../types';
import { Search, Plus, Trash2, Loader2, Server, Check, ChevronDown, ChevronUp, Settings, FileCode, X, ExternalLink, RefreshCw, Box } from 'lucide-react';
import { searchNixOptions, fetchServiceOptions, fetchOptionsFromSource } from '../services/mynixosService';

interface ServiceSelectorProps {
  services: NixService[];
  onToggle: (service: NixService) => void;
  onUpdate: (service: NixService) => void;
  title: string;
}

export const ServiceSelector: React.FC<ServiceSelectorProps> = ({ services, onToggle, onUpdate, title }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NixService[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState<string | null>(null);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // New Option State
  const [newOptionKey, setNewOptionKey] = useState('');
  const [newOptionValue, setNewOptionValue] = useState('');
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!val.trim()) {
        setResults([]);
        setShowResults(false);
        return;
    }
    
    setLoading(true);
    setShowResults(true);
    
    searchTimeoutRef.current = setTimeout(async () => {
        try {
            const found = await searchNixOptions(val);
            setResults(found);
        } finally {
            setLoading(false);
        }
    }, 500); // Debounce
  };

  const addItem = (svc: NixService) => {
     onToggle(svc);
     setQuery('');
     setShowResults(false);
     // Auto expand the newly added item
     setExpandedService(svc.name);
     handleExpand(svc.name);
  };

  const handleExpand = async (serviceName: string) => {
      if (expandedService === serviceName) {
          setExpandedService(null);
          return;
      }
      setExpandedService(serviceName);

      const service = services.find(s => s.name === serviceName);
      if (service && !service.knownOptions) {
          setOptionsLoading(serviceName);
          try {
              // Try deep fetch from source first which parses descriptions and types better
              const opts = await fetchOptionsFromSource(serviceName);
              // Fallback is handled inside the function
              onUpdate({ ...service, knownOptions: opts });
          } finally {
              setOptionsLoading(null);
          }
      }
  };

  const handleAddOption = (serviceName: string, key: string, value: string | NixValue) => {
    if (!key) return;
    const service = services.find(s => s.name === serviceName);
    if (!service) return;

    let parsedValue: NixValue = value;
    if (typeof value === 'string') {
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (!isNaN(Number(value)) && value.trim() !== '') parsedValue = Number(value);
    }

    const updatedService = {
      ...service,
      options: { ...service.options, [key]: parsedValue }
    };
    onUpdate(updatedService);
    
    // Clear manual inputs if they match
    if (key === newOptionKey) {
        setNewOptionKey('');
        setNewOptionValue('');
    }
  };

  const handleRemoveOption = (serviceName: string, key: string) => {
     const service = services.find(s => s.name === serviceName);
     if (!service) return;
     const newOptions = { ...service.options };
     delete newOptions[key];
     onUpdate({ ...service, options: newOptions });
  };

  const enabledServices = services.filter(s => s.enabled);

  return (
    <div className="bg-card rounded-md border border-border flex flex-col h-full shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border bg-secondary/10 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Box className="text-primary" size={20}/>
            {title}
          </h3>
          <span className="text-xs text-muted-foreground px-2 py-1 bg-background/50 rounded-full border border-border/50">
            {enabledServices.length} configured
          </span>
      </div>
      
      {/* Configuration Input / Search */}
      <div className="p-4 bg-card z-20 relative border-b border-border" ref={dropdownRef}>
         <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
                type="text"
                value={query}
                onChange={handleSearchInput}
                onFocus={() => query && setShowResults(true)}
                placeholder="Add configuration (e.g. 'steam', 'git', 'firewall')..."
                className="w-full bg-secondary/30 border border-input rounded-md py-3 pl-10 pr-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all shadow-sm"
            />
            {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" size={16} />}
         </div>
         
         {/* Dropdown Results */}
         {showResults && (
             <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-xl max-h-[300px] overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-100">
                {results.length === 0 && !loading ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">No options found.</div>
                ) : (
                    results.map(svc => {
                        const isEnabled = services.some(s => s.name === svc.name && s.enabled);
                        return (
                            <button
                                key={svc.name}
                                onClick={() => addItem(svc)}
                                disabled={isEnabled}
                                className="w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-start gap-3 border-b border-border/50 last:border-0 disabled:opacity-50 disabled:cursor-not-allowed group"
                            >
                                <div className={`mt-0.5 p-1.5 rounded-md ${isEnabled ? 'bg-green-500/10 text-green-500' : 'bg-secondary text-muted-foreground group-hover:text-foreground'}`}>
                                    {isEnabled ? <Check size={14} /> : <Plus size={14} />}
                                </div>
                                <div>
                                    <div className="font-mono text-sm font-medium text-foreground">{svc.name}</div>
                                    <div className="text-xs text-muted-foreground line-clamp-1">{svc.description}</div>
                                </div>
                            </button>
                        );
                    })
                )}
             </div>
         )}
      </div>

      {/* Configured List - Full Width */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-secondary/5">
        {enabledServices.length === 0 && (
            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-xl m-4">
                <Box size={32} className="mb-2 opacity-50"/>
                <p>No configurations active.</p>
                <p className="text-xs">Search above to add services, programs, or settings.</p>
            </div>
        )}
        {enabledServices.map((svc) => {
            const isExpanded = expandedService === svc.name;
            return (
            <div key={svc.name} className={`bg-card border rounded-lg shadow-sm overflow-hidden transition-all duration-200 ${isExpanded ? 'ring-1 ring-primary/20 border-primary/30' : 'border-border'}`}>
            <div 
                className="p-3 flex items-center justify-between cursor-pointer hover:bg-secondary/20 transition-colors select-none"
                onClick={() => handleExpand(svc.name)}
            >
                <div className="flex items-center gap-3">
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggle(svc); }}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Remove configuration"
                    >
                        <Trash2 size={16} />
                    </button>
                    <div>
                        <div className="font-mono text-sm font-medium">{svc.name}</div>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">{Object.keys(svc.options).length} options</span>
                    {expandedService === svc.name ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </div>
            
            {/* Expanded Settings */}
            {isExpanded && (
                <div className="p-4 pt-0 animate-in slide-in-from-top-2 duration-200 border-t border-border/50 bg-secondary/5">
                    
                    <div className="flex items-center justify-between mb-4 mt-4">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                           <Settings size={12} /> Configuration
                        </h4>
                        <a 
                            href={`https://mynixos.com/options/${svc.name}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-xs flex items-center gap-1 text-primary hover:underline opacity-80 hover:opacity-100"
                        >
                            <ExternalLink size={10} />
                            Reference
                        </a>
                    </div>
                    
                    {/* Active Options Table */}
                    <div className="space-y-2 mb-6">
                        {Object.entries(svc.options).length === 0 && (
                            <div className="text-xs text-muted-foreground italic bg-background/50 p-2 rounded border border-border/50 border-dashed">
                                No custom values set (default configuration).
                            </div>
                        )}
                        {Object.entries(svc.options).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between text-xs bg-background p-2.5 rounded-md border border-border shadow-sm group">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-mono text-nix-blue font-medium">{key}</span>
                                    <span className="text-muted-foreground">=</span>
                                    <span className="font-mono text-nix-cyan truncate max-w-[200px]" title={value.toString()}>{value.toString()}</span>
                                </div>
                                <button 
                                    onClick={() => handleRemoveOption(svc.name, key)} 
                                    className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                    
                    <div className="h-px bg-border/50 my-4" />
                    
                    {/* Add Options Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Recommended */}
                        <div>
                             <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                                <RefreshCw size={12} className={optionsLoading === svc.name ? "animate-spin" : ""} />
                                Recommended Options
                            </h4>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                {optionsLoading === svc.name && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Loader2 size={12} className="animate-spin" /> Loading suggestions...
                                    </div>
                                )}
                                {!optionsLoading && svc.knownOptions && svc.knownOptions.map((opt) => {
                                    const isSet = Object.prototype.hasOwnProperty.call(svc.options, opt.name);
                                    if (isSet) return null;
                                    return (
                                        <div key={opt.name} className="group p-2 rounded-md border border-border/50 bg-background/50 hover:bg-secondary/40 hover:border-border transition-all cursor-pointer" onClick={() => handleAddOption(svc.name, opt.name, opt.example)}>
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-mono text-xs font-medium text-foreground">{opt.name}</span>
                                                <Plus size={12} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                            <p className="text-[10px] text-muted-foreground line-clamp-1 mb-1">{opt.description}</p>
                                            <div className="flex items-center gap-1 text-[10px] opacity-60">
                                                <span>Ex:</span>
                                                <code className="bg-secondary/50 px-1 rounded">{opt.example}</code>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        
                        {/* Manual Add */}
                        <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Manual Entry</h4>
                            <div className="bg-background/50 p-3 rounded-md border border-border/50 space-y-3">
                                <div>
                                    <label className="text-[10px] text-muted-foreground mb-1 block">Option Name</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. openFirewall" 
                                        className="w-full bg-background border border-input rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
                                        value={newOptionKey}
                                        onChange={e => setNewOptionKey(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-muted-foreground mb-1 block">Value</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. true" 
                                        className="w-full bg-background border border-input rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
                                        value={newOptionValue}
                                        onChange={e => setNewOptionValue(e.target.value)}
                                    />
                                </div>
                                <button 
                                    onClick={() => handleAddOption(svc.name, newOptionKey, newOptionValue)}
                                    className="w-full bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                                    disabled={!newOptionKey}
                                >
                                    <Plus size={12} /> Add Option
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            )}
            </div>
            )
        })}
      </div>
    </div>
  );
};
