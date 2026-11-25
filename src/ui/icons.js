/** Небольшой набор SVG-иконок (inline, без внешних зависимостей). */
const svg = (path, size = 24) =>
  `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

export const icons = {
  logo: (s) => svg('<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" fill="currentColor" stroke="none"/>', s),
  search: (s) => svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>', s),
  calendar: (s) => svg('<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>', s),
  pin: (s) => svg('<path d="M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>', s),
  users: (s) => svg('<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8"/>', s),
  plus: (s) => svg('<path d="M12 5v14M5 12h14"/>', s),
  heart: (s) => svg('<path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z"/>', s),
  grid: (s) => svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>', s),
  user: (s) => svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>', s),
  back: (s) => svg('<path d="M19 12H5M12 19l-7-7 7-7"/>', s),
  edit: (s) => svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>', s),
  trash: (s) => svg('<path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>', s),
  check: (s) => svg('<path d="M20 6L9 17l-5-5"/>', s),
  close: (s) => svg('<path d="M18 6L6 18M6 6l12 12"/>', s),
  alert: (s) => svg('<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>', s),
  wifiOff: (s) => svg('<path d="M1 1l22 22M16.7 11.1A11 11 0 0119 12.6M5 12.6a11 11 0 015.2-2.5M10.7 5.1A16 16 0 0122.6 9M1.4 9a16 16 0 014.3-2.8M8.5 16.1a6 6 0 017 0M12 20h.01"/>', s),
  eye: (s) => svg('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>', s),
  eyeOff: (s) => svg('<path d="M17.9 17.9A10 10 0 0112 20C5 20 1 12 1 12a18 18 0 015.1-5.9M9.9 4.2A9 9 0 0112 4c7 0 11 8 11 8a18 18 0 01-2.2 3.2M1 1l22 22M14.1 14.1a3 3 0 01-4.2-4.2"/>', s),
  logout: (s) => svg('<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>', s),
  play: (s) => svg('<path d="M7 4v16l13-8z" fill="currentColor"/>', s),
  image: (s) => svg('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>', s),
  upload: (s) => svg('<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>', s),
  chevronLeft: (s) => svg('<path d="M15 18l-6-6 6-6"/>', s),
  chevronRight: (s) => svg('<path d="M9 18l6-6-6-6"/>', s),
  star: (s) => svg('<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>', s),
  refresh: (s) => svg('<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0114.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0020.5 15"/>', s),
};

/** Пиктограмма категории для обложки карточки. */
const categoryPaths = {
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  sport: '<circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 000 20M2 12h20M4.9 4.9c3.9 2.6 10.3 2.6 14.2 0M4.9 19.1c3.9-2.6 10.3-2.6 14.2 0"/>',
  culture: '<path d="M8 5v14l11-7z" fill="currentColor"/>',
  science: '<path d="M9 2h6M10 2v6L4 19a2 2 0 002 3h12a2 2 0 002-3l-6-11V2"/><path d="M7 15h10"/>',
  hobby: '<path d="M9 21h6M8 21l1-4h6l1 4M10 17l-1-6h6l-1 6M12 11V8"/><circle cx="12" cy="5" r="3"/>',
  volunteer: '<path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z" fill="currentColor"/>',
};

export const categoryIcon = (category, size = 40) => svg(categoryPaths[category] ?? categoryPaths.hobby, size);
