import { useEffect } from 'react';

/**
 * Custom hook to set the page title dynamically
 * @param title - The page title (without the app name suffix)
 * @param includeSuffix - Whether to append " - PropertyFlow" to the title
 */
export function usePageTitle(title: string, includeSuffix = true) {
  useEffect(() => {
    const fullTitle = includeSuffix ? `${title} - PropertyFlow` : title;
    document.title = fullTitle;
    
    // Cleanup: restore default title when component unmounts
    return () => {
      document.title = 'PropertyFlow - Property & Rent Management System';
    };
  }, [title, includeSuffix]);
}
