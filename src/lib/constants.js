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
