const fs = require('fs');

const path = 'App.tsx';
let data = fs.readFileSync(path, 'utf8');

const ts1 = `  const [showHardwareWarning, setShowHardwareWarning] = useState(false);`;
const sr1 = `  const [showHardwareWarning, setShowHardwareWarning] = useState(false);
  const [showDiffWarning, setShowDiffWarning] = useState(false);
  const [diffContent, setDiffContent] = useState("");`;

if (data.includes(ts1)) { data = data.replace(ts1, sr1); }

const ts2 = `              const diffResult = await window.electronAPI.gitDiff(projectPath);
              if (diffResult && diffResult.trim() !== '') {
                  setPendingBuildAction(action);
                  setDiffContent(diffResult);`;

const sr2 = `              const diffResult = await window.electronAPI.gitDiff(projectPath);
              if (diffResult && diffResult.success && diffResult.diff && diffResult.diff.trim() !== '') {
                  setPendingBuildAction(action);
                  setDiffContent(diffResult.diff);`;

if (data.includes(ts2)) { data = data.replace(ts2, sr2); }

fs.writeFileSync(path, data);
console.log("States added")