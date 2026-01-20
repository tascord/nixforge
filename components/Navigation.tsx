import React from 'react';
import { Tab } from '../types';
import { Settings, Server, Box, Users, Code, Cpu, LayoutTemplate, Play, Power } from 'lucide-react';

interface NavigationProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  onRunBuild: (action: 'switch' | 'boot') => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab, onRunBuild }) => {
  const navItems = [
    { id: Tab.GENERAL, icon: Settings, label: "General" },
    { id: Tab.HARDWARE, icon: Cpu, label: "Hardware" },
    // { id: Tab.PRESETS, icon: LayoutTemplate, label: "Presets" },
    { id: Tab.USERS, icon: Users, label: "Users" },
    { id: Tab.PACKAGES, icon: Box, label: "Packages" },
    { id: Tab.SERVICES, icon: Server, label: "Services" },
    { id: Tab.CODE, icon: Code, label: "Code" },
  ];

  return (
    <nav className="w-64 bg-card border-r border-border p-4 flex flex-col h-full">
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="w-8 h-8 rounded-md bg-foreground text-background flex items-center justify-center">
          <span className="font-bold font-mono">N</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight">
          NixForge
        </h1>
      </div>

      <div className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-all duration-200 ${
                isActive
                  ? 'bg-secondary text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
              }`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto pt-6 border-t border-border">
        <div className="px-3 text-xs text-muted-foreground text-center">
            Scaffold your NixOS flakes with ease.
        </div>
      </div>
      <div className="mt-auto pt-4 border-t border-border space-y-2">
         <div className="px-3 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
             System Actions
         </div>
         <button
            onClick={() => onRunBuild('switch')}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors"
         >
            <Play size={16} />
            <span>Apply & Switch</span>
         </button>
         <button
            onClick={() => onRunBuild('boot')}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md text-blue-500 hover:bg-blue-500/10 hover:text-blue-400 transition-colors"
         >
            <Power size={16} />
            <span>Build for Boot</span>
         </button>
      </div>
    </nav>
  );
};
