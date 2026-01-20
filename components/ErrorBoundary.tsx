import React, { useState, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

// Since error boundaries must be class components in React, 
// we'll use a simple wrapper for development
const ErrorBoundary: React.FC<Props> = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // In production, you'd use a proper error boundary
  // For now, this is a placeholder that just renders children
  if (hasError) {
    return (
      <div style={{ padding: '20px', color: 'white', backgroundColor: '#333' }}>
        <h1>Something went wrong.</h1>
        <pre>{error?.toString()}</pre>
        <pre>{error?.stack}</pre>
      </div>
    );
  }

  return <>{children}</>;
};

export default ErrorBoundary;
