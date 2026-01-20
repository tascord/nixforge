// Convert ANSI escape codes to HTML span elements for terminal colors
export const ansiToHtml = (text: string): string => {
  // ANSI color codes mapping
  const ansiColors: Record<number, string> = {
    30: '#000000', 31: '#e74c3c', 32: '#2ecc71', 33: '#f39c12',
    34: '#3498db', 35: '#9b59b6', 36: '#1abc9c', 37: '#ecf0f1',
    90: '#95a5a6', 91: '#e74c3c', 92: '#2ecc71', 93: '#f39c12',
    94: '#3498db', 95: '#9b59b6', 96: '#1abc9c', 97: '#ecf0f1',
  };

  let html = text
    // Escape HTML special characters first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Remove timer/progress display lines - these appear as "⏱ Xs" or similar
  // Skip lines that are mostly just whitespace and timer characters
  const lines = html.split('\n');
  html = lines.map(line => {
    // If line is mostly timer/progress markers, skip it
    if (/^[\s⏱0-9sm:]*$/.test(line.trim())) {
      return '';
    }
    return line;
  }).join('\n').replace(/\n\n+/g, '\n'); // Remove multiple blank lines

  // Remove special shell codes that don't render as colors
  html = html
    .replace(/\u001b\[\?[0-9;]*[a-zA-Z]/g, '') // Remove [? sequences like [?2026h, [?2026l
    .replace(/\u001b\[[0-9]*[A-H]/g, '') // Remove cursor movement (A-H)
    .replace(/\u001b\[[0-9]*[JK]/g, '') // Remove erase display/line (J, K)
    .replace(/\u001b\[[0-9]*G/g, '') // Remove cursor horizontal absolute
    .replace(/\u001b\[[0-9]*;[0-9]*[HR]/g, '') // Remove cursor positioning
    .replace(/\u001b\].*?(\u001b\\|\u0007)/g, ''); // Remove OSC sequences (like timer display)

  // Replace ANSI color codes with HTML spans
  html = html.replace(/\u001b\[([0-9;]+)m/g, (match, codes) => {
    const codeArray = codes.split(';').map(Number);
    let style = '';
    let className = '';

    for (const code of codeArray) {
      if (code === 0) {
        // Reset
        return '</span>';
      } else if (code === 1) {
        // Bold
        className = 'font-bold';
      } else if (code === 4) {
        // Underline
        style = 'text-decoration: underline;';
      } else if (code >= 30 && code <= 37) {
        // Foreground colors
        style += `color: ${ansiColors[code]};`;
      } else if (code >= 90 && code <= 97) {
        // Bright foreground colors
        style += `color: ${ansiColors[code]};`;
      } else if (code >= 40 && code <= 47) {
        // Background colors - convert to 30s range
        const bgCode = code - 10;
        style += `background-color: ${ansiColors[bgCode]};`;
      }
    }

    if (style || className) {
      return `<span style="${style}" class="${className}">`;
    }
    return match;
  });

  return html;
};
