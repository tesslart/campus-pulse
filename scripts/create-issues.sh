#!/usr/bin/env bash
# Создаёт стартовые GitHub Issues для команды (нужен GitHub CLI: gh auth login).
# Использование: bash scripts/create-issues.sh <github-логин-участника-A> <github-логин-участника-B>
set -euo pipefail
A="${1:?Укажите GitHub-логин участника A (UI/UX)}"
B="${2:?Укажите GitHub-логин участника B (данные)}"

issue() { gh issue create --title "$1" --assignee "$2" --body "$3"; }

issue "Схема БД, RLS и подключение Supabase" "$B" "## Цель
Таблицы events и event_members в Supabase, GRANT + RLS, клиент supabaseClient.js.
## Критерии приёмки
- [ ] supabase/schema.sql выполнен, в обеих таблицах RLS enabled
- [ ] supabase/rls_tests.sql — все PASS
- [ ] Каталог читает события из Supabase
Ветка: \`feature/supabase-schema\`"

issue "Авторизация: регистрация, вход, выход" "$B" "## Цель
Email/password через Supabase Auth, видимый статус сессии.
## Критерии приёмки
- [ ] Регистрация и вход двух учебных аккаунтов
- [ ] Неверный пароль → понятная ошибка, без утечки токена (T08)
- [ ] Site URL / Redirect URLs настроены
Ветка: \`feature/auth\`"

issue "Запись на событие и отмена участия" "$B" "## Цель
INSERT/DELETE в event_members, повторная запись невозможна.
## Критерии приёмки
- [ ] T03, T04, T05, T07 пройдены
- [ ] Кнопка блокируется на время запроса
Ветка: \`feature/members\`"

issue "Дизайн-система и главная афиша" "$A" "## Цель
Midnight Campus: цвета, типографика, карточки, поиск, фильтры, адаптив 375–1440 px.
## Критерии приёмки
- [ ] Сетка 3/2/1 колонки, нет горизонтального скролла на 375 px (T11)
- [ ] Состояния loading / empty / error
Ветка: \`feature/catalog-ui\`"

issue "Форма создания и редактирования события" "$A" "## Цель
Форма с валидацией (название 5–80, описание 15–600, место 3–120, дата в будущем).
## Критерии приёмки
- [ ] Ошибки под конкретным полем, кнопка блокируется при отправке (T10)
- [ ] При ошибке сети данные остаются в форме
Ветка: \`feature/event-form\`"

issue "Публикация на GitHub Pages" "$A" "## Цель
Сайт открывается по ссылке и читает общую базу.
## Критерии приёмки
- [ ] Variables VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY добавлены
- [ ] Pages → Source = GitHub Actions, деплой зелёный
- [ ] T12 пройден на телефоне
Ветка: \`feature/deploy\`"

echo "Готово: создано 6 Issues."
