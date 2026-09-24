import { toast } from '@/store/uiStore';

export async function copyToClipboard(value: string, label = 'Copied to clipboard') {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(label);
    return true;
  } catch {
    // Older browsers and insecure contexts have no clipboard API.
    const input = document.createElement('textarea');
    input.value = value;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.append(input);
    input.select();
    const ok = document.execCommand('copy');
    input.remove();
    if (ok) toast.success(label); else toast.error('Could not copy — please copy manually');
    return ok;
  }
}

export const SHARE_TARGETS = [
  { key: 'whatsapp', label: 'WhatsApp', build: (url: string, text: string) => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` },
  { key: 'linkedin', label: 'LinkedIn', build: (url: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
  { key: 'x', label: 'X', build: (url: string, text: string) => `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
  { key: 'telegram', label: 'Telegram', build: (url: string, text: string) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
  { key: 'email', label: 'Email', build: (url: string, text: string) => `mailto:?subject=${encodeURIComponent('Join me on EduRewards')}&body=${encodeURIComponent(`${text}\n\n${url}`)}` },
];

/** Uses the native share sheet where available, falling back to per-network links. */
export async function nativeShare(url: string, text: string): Promise<boolean> {
  if (!navigator.share) return false;
  try {
    await navigator.share({ title: 'EduRewards', text, url });
    return true;
  } catch {
    return false;
  }
}
