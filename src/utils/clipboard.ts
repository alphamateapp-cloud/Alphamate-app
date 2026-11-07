/**
 * Safe clipboard copy utility that handles iframe permissions,
 * unfocused documents, and browser security constraints without throwing unhandled errors.
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  // First attempt modern navigator.clipboard API if available
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // navigator.clipboard.writeText can fail with NotAllowedError when iframe is not focused
  }

  // Robust fallback using temporary textarea & document.execCommand
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
};
