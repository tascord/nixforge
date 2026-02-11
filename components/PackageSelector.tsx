import React, { useState } from 'react';
import { NixPackage } from '../types';
import { PACKAGE_GROUPS } from '../packageGroups';
import { Search, Plus, Trash2, Loader2, Package as PackageIcon, X, FolderOpen, ChevronDown, ChevronRight } from 'lucide-react';

interface PackageSelectorProps {
  selectedPackages: NixPackage[];
  onAdd: (pkg: NixPackage) => void;
  onRemove: (pkgName: string) => void;
  title: string;
}

// Simple local package database for common packages
// We now preload this from packageGroups to correct common apps
const COMMON_PACKAGES: NixPackage[] = PACKAGE_GROUPS.flatMap(g => g.packages);

const searchNixPackages = async (query: string): Promise<NixPackage[]> => {
  if (window.electronAPI && query.length >= 3) {
    try {
      const result = await window.electronAPI.searchPackages(query);
      if (result.success && result.packages) {
        return result.packages;
      }
    } catch (e) {
      console.error("Search failed", e);
    }
  }

  const lowerQuery = query.toLowerCase();
  // Filter for unique packages
  const matches = COMMON_PACKAGES.filter(pkg => 
    pkg.name.toLowerCase().includes(lowerQuery) ||
    pkg.description.toLowerCase().includes(lowerQuery)
  );

  return matches.filter((pkg, index, self) => 
      index === self.findIndex((t) => (t.name === pkg.name))
  );
};


export const PackageSelector: React.FC<PackageSelectorProps> = ({ selectedPackages, onAdd, onRemove, title }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NixPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  React.useEffect(() => {
    const timer = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        setIsOpen(false);
        return;
      }
      
      setLoading(true);
      setIsOpen(true);
      try {
        const found = await searchNixPackages(query);
        setResults(found);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery);
  };

  return (
    <div className="bg-card rounded-md border border-border flex flex-col h-full shadow-sm relative overflow-hidden">
      <div className="p-6 pb-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <PackageIcon className="text-muted-foreground" size={20}/>
            {title}
          </h3>
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md text-xs font-medium transition-all"
          >
            <FolderOpen size={14} />
            View Selection ({selectedPackages.length})
          </button>
        </div>
        
        {/* Search Bar with Dropdown */}
        <div className="mb-6 relative">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Search className="text-muted-foreground" size={16} />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search packages..."
                className="w-full bg-background border border-input rounded-md py-2 pl-9 pr-10 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
              />
              {loading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                   <Loader2 className="animate-spin text-muted-foreground" size={16} />
                </div>
              )}
            </div>
            {query && !loading && (
              <button
                onClick={() => handleSearch('')}
                className="p-2 text-muted-foreground hover:text-foreground shrink-0"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Dropdown Results */}
          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
              {loading && (
                <div className="p-4 text-center text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin" size={16} />
                  Searching...
                </div>
              )}
              {!loading && results.length === 0 && query && (
                 <div 
                     onClick={() => {
                         onAdd({ name: query, description: 'Custom package' });
                         setIsOpen(false);
                         setQuery('');
                         setResults([]);
                     }}
                     className="p-4 text-center text-muted-foreground text-sm cursor-pointer bg-background hover:bg-secondary/20 hover:text-foreground transition-colors group"
                 >
                   <div className="flex flex-col items-center gap-1">
                      <span>No results for "{query}"</span>
                      <span className="flex items-center gap-1 font-medium text-primary group-hover:underline decoration-primary/50 underline-offset-4"><Plus size={14}/> Add "{query}" manually</span>
                   </div>
                </div>
              )}
              {!loading && results.map((pkg) => {
                const isSelected = selectedPackages.some(p => p.name === pkg.name);
                return (
                  <div
                    key={pkg.name}
                    onClick={() => {
                      if (!isSelected) onAdd(pkg);
                      setIsOpen(false);
                      setQuery('');
                      setResults([]);
                    }}
                    className={`p-3 border-b border-border/50 last:border-b-0 cursor-pointer bg-background hover:bg-secondary/50 transition-colors ${
                      isSelected ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="font-mono text-sm text-foreground font-semibold">{pkg.name}</div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{pkg.description}</div>
                  </div>
                );
              })}
              {!loading && results.length > 0 && (
                 <div 
                     onClick={() => {
                         onAdd({ name: query, description: 'Custom package' });
                         setIsOpen(false);
                         setQuery('');
                         setResults([]);
                     }}
                     className="p-2 border-t border-border bg-secondary/10 cursor-pointer hover:bg-secondary/30 transition-colors flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground font-medium"
                 >
                     <Plus size={12}/>
                     <span>Add "{query}" manually</span>
                 </div>
              )}
            </div>
          )}
        </div>
      </div>

       {/* Groups List (Accordion) */}
       <div className="px-6 mb-6 space-y-2 flex-1 overflow-y-auto min-h-[200px]">
           {PACKAGE_GROUPS.map(group => {
               const isExpanded = expandedGroups[group.id];
               return (
                  <div key={group.id} className="border border-border/50 rounded-lg overflow-hidden transition-all duration-200">
                      <button 
                          onClick={() => toggleGroup(group.id)}
                          className={`w-full flex items-center justify-between p-3 text-left transition-colors ${isExpanded ? 'bg-secondary/30' : 'hover:bg-secondary/10'}`}
                      >
                          <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
                              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">{group.name}</span>
                          </div>
                          <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
                              {group.packages.length}
                          </span>
                      </button>
                      
                      {isExpanded && (
                          <div className="p-2 bg-card grid grid-cols-1 gap-2 border-t border-border/30 animate-in slide-in-from-top-1 duration-200">
                              {group.packages.map(pkg => {
                                  const isSelected = selectedPackages.some(p => p.name === pkg.name);
                                  return (
                                      <div 
                                          key={pkg.name} 
                                          onClick={() => !isSelected ? onAdd(pkg) : onRemove(pkg.name)}
                                          className={`p-2 rounded-md border flex justify-between items-center cursor-pointer transition-all ${
                                              isSelected 
                                                  ? 'bg-primary/10 border-primary shadow-sm' 
                                                  : 'bg-secondary/20 border-border/50 hover:border-primary/50'
                                          }`}
                                      >
                                          <div className="overflow-hidden pr-2">
                                              <div className="font-medium text-sm text-foreground flex items-center gap-2">
                                                {pkg.name}
                                              </div>
                                              <div className="text-[10px] text-muted-foreground truncate">{pkg.description}</div>
                                          </div>
                                          <div className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground group-hover:border-foreground'}`}>
                                              {isSelected && <X size={10} className="text-primary-foreground" />}
                                              {!isSelected && <Plus size={10} className="text-muted-foreground" />}
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      )}
                  </div>
               );
           })}
       </div>

      {/* Selection Drawer Overlay */}
      {isDrawerOpen && (
        <div className="absolute inset-0 z-50 flex justify-end">
            <div 
                className="absolute inset-0 bg-background/40 backdrop-blur-sm animate-in fade-in duration-300" 
                onClick={() => setIsDrawerOpen(false)}
            />
            <div className="relative w-full max-w-sm h-full bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/20">
                    <div className="flex items-center gap-2">
                        <PackageIcon size={18} className="text-primary" />
                        <h4 className="font-semibold text-foreground">Current Selection</h4>
                        <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold">
                            {selectedPackages.length}
                        </span>
                    </div>
                    <button 
                        onClick={() => setIsDrawerOpen(false)}
                        className="p-1.5 hover:bg-secondary rounded-md transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <X size={18} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {selectedPackages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2 opacity-60">
                            <Trash2 size={40} className="mb-2" />
                            <p>No packages selected</p>
                        </div>
                    ) : (
                        selectedPackages.map((pkg) => (
                            <div key={pkg.name} className="p-3 rounded-lg bg-secondary/10 border border-border/50 flex justify-between items-start group hover:border-primary/30 transition-all">
                                <div className="min-w-0 pr-4">
                                    <div className="font-mono text-sm text-foreground font-medium mb-1 truncate">{pkg.name}</div>
                                    <div className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{pkg.description}</div>
                                </div>
                                <button
                                    onClick={() => onRemove(pkg.name)}
                                    className="p-2 rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-all shrink-0"
                                    title="Remove from list"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-border bg-secondary/5">
                    <button 
                        onClick={() => setIsDrawerOpen(false)}
                        className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        Return to Browsing
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
