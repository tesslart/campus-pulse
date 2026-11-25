/** Категории: ключ хранится в БД (см. CHECK в supabase/schema.sql), подпись — в UI. */
export const CATEGORIES = [
  { id: 'music', label: 'Музыка' },
  { id: 'sport', label: 'Спорт' },
  { id: 'culture', label: 'Культура' },
  { id: 'science', label: 'Наука' },
  { id: 'hobby', label: 'Хобби' },
  { id: 'volunteer', label: 'Волонтёрство' },
];

export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));

/** Стили обложек карточек (cover_style). */
export const COVER_STYLES = [
  { id: 'lavender', label: 'Лаванда' },
  { id: 'mint', label: 'Мята' },
  { id: 'coral', label: 'Коралл' },
  { id: 'sun', label: 'Солнце' },
  { id: 'ocean', label: 'Океан' },
  { id: 'night', label: 'Ночь' },
];

export const LIMITS = {
  title: { min: 5, max: 80 },
  description: { min: 15, max: 600 },
  location: { min: 3, max: 120 },
  password: { min: 6 },
};

/** Медиа события: фото в Supabase Storage + ссылка на видео. */
export const MEDIA = {
  bucket: 'event-media',
  maxPhotos: 6,
  maxFileMb: 5,
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  maxSide: 1600, // фото уменьшаются в браузере до 1600 px по большей стороне
};
