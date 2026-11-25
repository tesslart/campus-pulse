# GitHub: пошаговый план для команды из двух человек

Критерии: минимум **4 Issues**, **2 PR** (по одному от каждого), **1 содержательный review** с исправлением, осмысленные коммиты, никто не пишет напрямую в `main`.

## 0. Репозиторий (делает один участник)

1. GitHub → **New repository** → имя `campus-pulse-<команда>` → **Public** → без README.
2. Settings → Collaborators → добавить напарника.
3. Залить проект (в папке проекта):

```bash
git remote add origin https://github.com/<username>/campus-pulse-<команда>.git
git push -u origin main
```

> В архиве уже есть `.git` с историей коммитов. Если её не нужно — удалите папку `.git` и выполните `git init && git add . && git commit -m "chore: init project"`.

4. Settings → **Branches** → Add rule для `main` → *Require a pull request before merging* → *Require approvals: 1* (по желанию).

## 1. Issues (минимум 4)

Автоматически (нужен [GitHub CLI](https://cli.github.com/), `gh auth login`):

```bash
bash scripts/create-issues.sh <логин-A> <логин-B>
```

Или вручную: Issues → New issue → шаблон «Задача». У каждой задачи: цель, критерии приёмки, исполнитель.

| # | Задача | Исполнитель | Ветка |
|---|---|---|---|
| 1 | Схема БД, RLS и подключение Supabase | B | `feature/supabase-schema` |
| 2 | Авторизация: регистрация, вход, выход | B | `feature/auth` |
| 3 | Запись на событие и отмена участия | B | `feature/members` |
| 4 | Дизайн-система и главная афиша | A | `feature/catalog-ui` |
| 5 | Форма создания и редактирования | A | `feature/event-form` |
| 6 | Публикация на GitHub Pages | A | `feature/deploy` |

## 2. Маршрут изменения: Issue → Branch → Commit → PR → Review + merge

```bash
git switch main && git pull
git switch -c feature/catalog-ui          # ветка под задачу
# ... правки ...
git add src/views/catalog.js src/style.css
git commit -m "feat: add category filters and search"
git push -u origin feature/catalog-ui
```

GitHub → **Compare & pull request** → заполнить шаблон (что сделано, `Closes #4`, скриншот) → Reviewers: напарник.

### Примеры осмысленных коммитов

```
feat: add event cards grid
feat: add email/password auth modal
feat: join and leave event
fix: prevent duplicate joins
fix: remove horizontal scroll on 375px
style: midnight campus design tokens
docs: add test report
```

## 3. Code review (обязательно хотя бы один содержательный)

Напарник открывает PR → **Files changed** → комментарий к строке, например:

> «Кнопка "Участвовать" не блокируется на время запроса — при двойном клике уйдут два INSERT. Добавь `disabled` до ответа сервера.»

Автор исправляет в той же ветке, пушит коммит `fix: disable join button while request is pending`, отвечает на комментарий → ревьюер ставит **Approve** → **Squash/Merge**.

## 4. Деплой

После слияния в `main` workflow **Deploy to GitHub Pages** публикует сайт. Статус — вкладка **Actions**. Каждый PR дополнительно проверяется workflow **CI (build check)**.

## Критерий честного вклада

Каждый коммитит со своего аккаунта и может объяснить свой участок и чужой. Один коммит «всё сразу» с одного аккаунта — неполные баллы.
