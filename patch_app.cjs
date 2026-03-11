const fs = require('fs');

const path = 'App.tsx';
let data = fs.readFileSync(path, 'utf8');

const target1 = `      if (!projectPath) {
          alert("System paths not loaded. Please restart the application to initialize the environment.");
          return;
      }

      setBuildStatus('building');`;

const replace1 = `      if (!projectPath) {
          alert("System paths not loaded. Please restart the application to initialize the environment.");
          return;
      }

      if (!bypassWarning) {
          try {
              const diffResult = await window.electronAPI.gitDiff(projectPath);
              if (diffResult && diffResult.trim() !== '') {
                  setPendingBuildAction(action);
                  setDiffContent(diffResult);
                  setShowDiffWarning(true);
                  return;
              }
          } catch (e) {
              console.error("Git diff failed:", e);
          }
      }

      setBuildStatus('building');`;

if (data.includes(target1)) {
    data = data.replace(target1, replace1);
    console.log("Replaced handleRunBuild logic");
} else {
    console.error("Could not find target1");
}

const target2 = `      {/* Hardware Warning Modal */}`;
const replace2 = `      {/* Diff Warning Modal */}
      {showDiffWarning && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-4xl rounded-xl border border-destructive/50 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-border bg-destructive/[0.02]">
              <div className="flex items-center gap-3 text-destructive">
                <AlertTriangle size={24} />
                <h3 className="font-semibold text-lg">Unmanaged Changes Detected</h3>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 text-sm bg-background">
              <p className="text-muted-foreground mb-4">
                You have made changes in your configuration files that are not managed by NixForge. Running a build will <strong>overwrite</strong> these changes. Please review the diff below:
              </p>
              <div className="bg-muted/30 p-4 rounded-md font-mono text-xs overflow-x-auto border border-border">
                <pre className="text-foreground whitespace-pre-wrap"><code dangerouslySetInnerHTML={{ __html: diffContent.replace(/\\n/g, '<br/>') }}></code></pre>
              </div>
            </div>

            <div className="p-6 border-t border-border bg-muted/10 flex justify-end gap-3 flex-shrink-0">
              <button 
                onClick={() => setShowDiffWarning(false)}
                className="px-6 py-2 border border-border text-muted-foreground rounded-md text-sm font-medium transition-colors hover:bg-secondary/50"
              >
                Cancel Build
              </button>
              
              <button 
                onClick={() => {
                  setShowDiffWarning(false);
                  if (pendingBuildAction) {
                    handleRunBuild(pendingBuildAction, true);
                  }
                }}
                className="px-6 py-2 bg-destructive text-destructive-foreground rounded-md text-sm font-medium transition-colors hover:bg-destructive/90 shadow-sm"
              >
                Overwrite and Build
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hardware Warning Modal */}`;

if (data.includes(target2)) {
    data = data.replace(target2, replace2);
    console.log("Replaced Modal logic");
} else {
    console.error("Could not find target2");
}

fs.writeFileSync(path, data);
console.log("Done patching App.tsx")
