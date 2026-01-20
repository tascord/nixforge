import React, { useState } from 'react';
import { GeneratedFile } from '../types';
import { CheckCircle, Copy, Code } from 'lucide-react';

interface CodeEditorProps {
  files: GeneratedFile[];
  onFileChange?: (fileName: string, content: string) => void; // Optional if we support sync later
}

const SimpleHighlight: React.FC<{ code: string }> = ({ code }) => {
  // Very basic Nix tokenizer for display purposes
  const keywords = /\b(import|inherit|with|in|rec|let|true|false|if|then|else)\b/g;
  const strings = /"([^"\\]|\\.)*"/g;
  const comments = /#.*/g;
  const attributes = /[a-zA-Z0-9_-]+(?=\s*=)/g;

  // Split logic is complex for a simple regex replace, so we just render plain text 
  // in a stylized container for now to ensure performance and correctness without a real parser.
  // Ideally, use PrismJS or Monaco Editor. 
  // Here we will use a naive approach: just render the text. 
  
  return <code className="font-mono text-sm text-foreground">{code}</code>;
};

export const CodeEditor: React.FC<CodeEditorProps> = ({ files, onFileChange }) => {
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  
  // Local state for edits in this session
  const [fileStates, setFileStates] = useState(files);

  // Sync props to state if props change (re-generation)
  // Note: This overrides user edits if config changes. 
  React.useEffect(() => {
    setFileStates(files);
  }, [files]);

  const activeFile = fileStates[activeFileIndex];

  const handleCopy = () => {
      navigator.clipboard.writeText(activeFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  }

  const handleEdit = (newContent: string) => {
      const newFiles = [...fileStates];
      newFiles[activeFileIndex] = { ...activeFile, content: newContent };
      setFileStates(newFiles);
      if (onFileChange) {
          onFileChange(activeFile.name, newContent);
      }
  }

  return (
    <div className="flex flex-col h-full bg-card rounded-md border border-border shadow-sm overflow-hidden">
        {/* File Tabs */}
        <div className="flex items-center bg-secondary/20 border-b border-border">
            {fileStates.map((file, idx) => (
                <button
                    key={file.name}
                    onClick={() => setActiveFileIndex(idx)}
                    className={`px-4 py-3 text-sm font-medium border-r border-border flex items-center gap-2 transition-colors ${idx === activeFileIndex ? 'bg-card text-foreground border-b-2 border-b-primary mb-[-1px]' : 'text-muted-foreground hover:bg-secondary/40'}`}
                >
                    <Code size={14} className={idx === activeFileIndex ? 'text-primary' : ''} />
                    {file.name}
                </button>
            ))}
            <div className="ml-auto px-4">
                <button onClick={handleCopy} className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 text-xs">
                    {copied ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy File'}
                </button>
            </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 relative group">
            <textarea
                value={activeFile.content}
                onChange={(e) => handleEdit(e.target.value)}
                className="w-full h-full bg-card p-4 font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/20 text-foreground z-10 relative bg-transparent caret-primary"
                spellCheck={false}
                style={{ caretColor: 'hsl(var(--primary))' }}
            />
            {/* 
               A real syntax highlighter would go behind the textarea which would be transparent text.
               For this implementation, we just use the textarea for editing as requested.
            */}
        </div>
        <div className="bg-secondary/20 border-t border-border px-4 py-1 text-[10px] text-muted-foreground flex justify-between">
            <span>Editable Mode</span>
            <span>{activeFile.content.split('\n').length} lines</span>
        </div>
    </div>
  );
};
