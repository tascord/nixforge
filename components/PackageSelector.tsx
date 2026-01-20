import React, { useState } from 'react';
import { NixPackage } from '../types';
import { PACKAGE_GROUPS } from '../packageGroups';
import { Search, Plus, Trash2, Loader2, Package as PackageIcon, X, FolderOpen } from 'lucide-react';

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
    <div className="bg-card rounded-md border border-border p-6 flex flex-col h-full shadow-sm">
      <h3 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
        <PackageIcon className="text-muted-foreground" size={20}/>
        {title}
      </h3>
      
      {/* Search Bar with Dropdown */}
      <div className="mb-6 relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search packages..."
              className="w-full bg-background border border-input rounded-md py-2 pl-9 pr-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
            />
          </div>
          {query && (
            <button
              onClick={() => handleSearch('')}
              className="p-2 text-muted-foreground hover:text-foreground"
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
                   className="p-4 text-center text-muted-foreground text-sm cursor-pointer hover:bg-secondary/20 hover:text-foreground transition-colors group"
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
                  className={`p-3 border-b border-border/50 last:border-b-0 cursor-pointer hover:bg-secondary/50 transition-colors ${
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

       {/* Groups List */}
       <div className="mb-6 space-y-4 flex-1 overflow-y-auto min-h-[300px]">
           {PACKAGE_GROUPS.map(group => (
               <div key={group.id} className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2 sticky top-0 bg-card py-1 z-10">
                         {group.name}
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                        {group.packages.map(pkg => {
                            const isSelected = selectedPackages.some(p => p.name === pkg.name);
                            return (
                                <div 
                                    key={pkg.name} 
                                    onClick={() => !isSelected ? onAdd(pkg) : onRemove(pkg.name)}
                                    className={`p-2 rounded-md border flex justify-between items-center cursor-pointer transition-all ${
                                        isSelected 
                                            ? 'bg-primary/10 border-primary shadow-sm' 
                                            : 'bg-card border-border hover:border-sidebar-accent'
                                    }`}
                                >
                                    <div className="overflow-hidden">
                                        <div className="font-medium text-sm text-foreground flex items-center gap-2">
                                           {pkg.name}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate">{pkg.description}</div>
                                    </div>
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                                        {isSelected && <Plus size={10} className="text-primary-foreground rotate-45" />}
                                        {!isSelected && <Plus size={10} className="text-muted-foreground" />}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
               </div>
           ))}
       </div>

      {/* Selected Packages */}
      <div className="flex flex-col min-h-0 pt-4 border-t border-border">
        <h4 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Custom Selection ({selectedPackages.length})</h4>
        <div className="flex-1 overflow-y-auto rounded-md border border-border bg-background p-2 space-y-2 max-h-[200px]">
          {selectedPackages.length === 0 && (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm py-4">
              No packages selected
            </div>
          )}
          {selectedPackages.map((pkg) => (
            <div key={pkg.name} className="p-3 rounded-md bg-secondary/30 border border-border flex justify-between items-center group">
              <div>
                <div className="font-mono text-sm text-foreground">{pkg.name}</div>
                <div className="text-xs text-muted-foreground truncate max-w-[200px]">{pkg.description}</div>
              </div>
              <button
                onClick={() => onRemove(pkg.name)}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
