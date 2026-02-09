import React, { useState } from 'react';
import { GeneratedFile } from '../types';
import { CheckCircle, Copy, Code } from 'lucide-react';

interface CodeEditorProps {
  files: GeneratedFile[];
  onFileChange?: (fileName: string, content: string) => void; // Optional if we support sync later
}

const SimpleHighlight: React.FC<{ code: string; preRef?: React.RefObject<HTMLPreElement | null> }> = ({ code, preRef }) => {
  // Basic Nix syntax highlighting
  const tokens = [];
  let lastIndex = 0;
  
  // Combine all regexes: strings, comments, keywords, attributes, numbers
  const regex = /("([^"\\]|\\.)*"|#.*|\b(import|inherit|with|in|rec|let|true|false|if|then|else)\b|[a-zA-Z0-9_-]+(?=\s*=)|\b\d+\b)/g;
  
  let match;
  while ((match = regex.exec(code)) !== null) {
      // Push text before match
      if (match.index > lastIndex) {
          tokens.push(<span key={lastIndex} className="text-gray-200">{code.slice(lastIndex, match.index)}</span>);
      }
      
      const text = match[0];
      let className = "text-gray-200";
      
      if (text.startsWith('"')) className = "text-green-400"; // String
      else if (text.startsWith('#')) className = "text-gray-500 italic"; // Comment
      else if (/^(import|inherit|with|in|rec|let|true|false|if|then|else)$/.test(text)) className = "text-purple-400 font-bold"; // Keyword
      else if (/^\d+$/.test(text)) className = "text-orange-400"; // Number
      else className = "text-blue-400"; // Attribute/Variable

      tokens.push(<span key={match.index} className={className}>{text}</span>);
      lastIndex = regex.lastIndex;
  }
  
  if (lastIndex < code.length) {
      tokens.push(<span key={lastIndex} className="text-gray-200">{code.slice(lastIndex)}</span>);
  }

  return (
    <pre ref={preRef} className="font-mono text-sm m-0 p-4 w-full h-full pointer-events-none whitespace-pre-wrap break-all text-gray-200 overflow-hidden">
      {tokens}
    </pre>
  );
};

export const CodeEditor: React.FC<CodeEditorProps> = ({ files, onFileChange }) => {
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  
  // Local state for edits in this session
  const [fileStates, setFileStates] = useState(files);

  // Sync props to state if props change (re-generation)
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

  const preRef = React.useRef<HTMLPreElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
      if (preRef.current) {
          preRef.current.scrollTop = e.currentTarget.scrollTop;
          preRef.current.scrollLeft = e.currentTarget.scrollLeft;
      }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] rounded-md border border-border shadow-sm overflow-hidden">
        {/* File Tabs */}
        <div className="flex items-center bg-[#2d2d2d] border-b border-[#3e3e3e]">
            {fileStates.map((file, idx) => (
                <button
                    key={file.name}
                    onClick={() => setActiveFileIndex(idx)}
                    className={`px-4 py-3 text-sm font-medium border-r border-[#3e3e3e] flex items-center gap-2 transition-colors ${idx === activeFileIndex ? 'bg-[#1e1e1e] text-gray-200 border-t-2 border-t-primary' : 'text-gray-500 hover:bg-[#252525]'}`}
                >
                    <Code size={14} className={idx === activeFileIndex ? 'text-primary' : ''} />
                    {file.name}
                </button>
            ))}
            <div className="ml-auto px-4">
                <button onClick={handleCopy} className="text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-2 text-xs">
                    {copied ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy File'}
                </button>
            </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 relative group overflow-hidden">
            <div className="absolute inset-0 z-0">
               <SimpleHighlight code={activeFile.content} preRef={preRef} />
            </div>
            <textarea
                value={activeFile.content}
                onChange={(e) => handleEdit(e.target.value)}
                onScroll={handleScroll}
                className="absolute inset-0 w-full h-full bg-transparent p-4 font-mono text-sm resize-none focus:outline-none text-transparent caret-white z-10 whitespace-pre-wrap break-all overflow-auto"
                spellCheck={false}
                style={{ caretColor: 'white' }}
            />
        </div>
        <div className="bg-[#2d2d2d] border-t border-[#3e3e3e] px-4 py-1 text-[10px] text-gray-500 flex justify-between">
            <span>Editable Mode</span>
            <span>{activeFile.content.split('\n').length} lines</span>
        </div>
    </div>
  );
};
