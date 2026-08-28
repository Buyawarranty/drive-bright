/**
 * WhatsApp-style attachments for the Miles chat.
 *
 * Photos taken on a phone are huge (5-10MB). We shrink them in the browser
 * before they ever leave the device so the chat stays quick and we don't hold
 * big files in memory or send them over the wire.
 */
export type ChatAttachment = {
  id: string;
  name: string;
  mediaType: string;
  url: string; // data URL, already shrunk
};

const MAX_EDGE = 1024; // longest side, in pixels
const JPEG_QUALITY = 0.7;
export const MAX_ATTACHMENTS = 3;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = src;
  });
}

/** Shrinks an image file to a chat-friendly size. Non-images are rejected. */
export async function prepareAttachment(file: File): Promise<ChatAttachment> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only photos can be attached at the moment.');
  }
  const original = await readAsDataUrl(file);
  try {
    const img = await loadImage(original);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.drawImage(img, 0, 0, width, height);
    const url = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name || 'photo.jpg',
      mediaType: 'image/jpeg',
      url,
    };
  } catch {
    // Fall back to the original if the browser can't re-encode it.
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name || 'photo',
      mediaType: file.type,
      url: original,
    };
  }
}

/** A small, familiar set — the ones people actually use in a support chat. */
export const CHAT_EMOJIS = [
  '👍', '🙏', '😊', '😀', '😂', '🙂', '😉', '😍',
  '🤔', '😐', '😕', '😞', '😢', '😡', '🤷', '👌',
  '❤️', '🎉', '🔥', '✅', '❌', '⭐', '💰', '📄',
  '🚗', '🚙', '🔧', '🛠️', '🔑', '⛽', '📞', '📷',
];
