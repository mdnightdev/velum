export const PROHIBITED_KEYWORDS = [
  'cheat', 'exploit', 'hack', 'illegal', 'bypass', 'crack', 
  'malware', 'rootkit', 'backdoor', 'keylogger', 'stealer', 'virus'
];
export const EXECUTABLE_EXTENSIONS = ['.sh', '.exe', '.py', '.js', '.bat', '.cmd', '.msi', '.bin', '.vbs', '.ps1', '.zip', '.tar', '.gz', '.rar'];

export function scanContent(title: string, description: string): boolean {
  const textToScan = `${title} ${description || ''}`.toLowerCase();
  const hasProhibited = PROHIBITED_KEYWORDS.some(kw => textToScan.includes(kw));
  const hasExecutable = EXECUTABLE_EXTENSIONS.some(ext => textToScan.includes(ext));
  return hasProhibited || hasExecutable;
}
