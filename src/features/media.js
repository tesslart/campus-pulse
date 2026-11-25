import { supabase } from '../lib/supabaseClient.js';
import { MEDIA } from '../lib/constants.js';

/* ------------------------------------------------------------------ */
/*  Фото: Supabase Storage, bucket event-media, папка <user_id>/       */
/* ------------------------------------------------------------------ */

/** Публичная ссылка на фото по пути в Storage. */
export function photoUrl(path) {
  if (!path) return '';
  return supabase.storage.from(MEDIA.bucket).getPublicUrl(path).data.publicUrl;
}

/** Проверка файла до загрузки. Возвращает текст ошибки или ''. */
export function checkImageFile(file) {
  if (!MEDIA.allowedTypes.includes(file.type)) return `«${file.name}»: можно только JPG, PNG, WEBP или GIF.`;
  if (file.size > 15 * 1024 * 1024) return `«${file.name}»: файл больше 15 МБ.`;
  return '';
}

/**
 * Уменьшает фото до MEDIA.maxSide и сжимает в WEBP (экономия места и трафика).
 * GIF не трогаем, чтобы не потерять анимацию.
 */
export async function compressImage(file) {
  if (file.type === 'image/gif') return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MEDIA.maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' });
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

/** Загружает фото в папку пользователя. Возвращает путь в Storage. */
export async function uploadPhoto(userId, file) {
  const prepared = await compressImage(file);
  if (prepared.size > MEDIA.maxFileMb * 1024 * 1024) {
    throw Object.assign(new Error('too large'), { code: 'file_too_large', fileName: file.name });
  }
  const path = `${userId}/${crypto.randomUUID()}.${EXT[prepared.type] ?? 'jpg'}`;
  const { error } = await supabase.storage.from(MEDIA.bucket).upload(path, prepared, {
    contentType: prepared.type,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** Удаляет файлы (Storage разрешит удалить только свои). Ошибки не критичны. */
export async function removePhotos(paths) {
  if (!paths?.length) return;
  const { error } = await supabase.storage.from(MEDIA.bucket).remove(paths);
  if (error) console.warn('Не удалось удалить файлы из Storage:', error.message);
}

/* ------------------------------------------------------------------ */
/*  Видео: ссылка на YouTube / Rutube / VK Видео → безопасный embed    */
/* ------------------------------------------------------------------ */

/**
 * Разбирает ссылку на видео. Возвращает { provider, embedUrl } или null.
 * В iframe попадают только адреса, собранные здесь из ID, — не исходная ссылка.
 */
export function parseVideoUrl(raw) {
  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/^(www\.|m\.)/, '');

  // YouTube: watch?v=ID, youtu.be/ID, shorts/ID, embed/ID, live/ID
  if (['youtube.com', 'youtu.be', 'youtube-nocookie.com', 'music.youtube.com'].includes(host)) {
    let id = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v');
    if (!id) id = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1];
    if (id && /^[\w-]{11}$/.test(id)) {
      return { provider: 'YouTube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
    }
  }

  // Rutube: rutube.ru/video/<32 hex>/ или /shorts/<id>
  if (host === 'rutube.ru') {
    const id = url.pathname.match(/^\/(?:video|shorts|play\/embed)\/([a-f0-9]{32})/i)?.[1];
    if (id) return { provider: 'Rutube', embedUrl: `https://rutube.ru/play/embed/${id}` };
  }

  // VK Видео: vk.com/video-123_456, vkvideo.ru/video-123_456, ?z=video-123_456
  if (['vk.com', 'vkvideo.ru', 'vk.ru'].includes(host)) {
    const source = url.pathname + ' ' + (url.searchParams.get('z') ?? '');
    const m = source.match(/video(-?\d+)_(\d+)/);
    if (m) return { provider: 'VK Видео', embedUrl: `https://vk.com/video_ext.php?oid=${m[1]}&id=${m[2]}&hd=2` };
  }

  return null;
}
