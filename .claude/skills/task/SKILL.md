---
name: task
description: Research an idea for HoverTranslate and write it up as a task file in work/tasks/ for the implementer agent. Changes no code.
argument-hint: <idea>
disable-model-invocation: true
---

Turn this idea into a task: $ARGUMENTS

Nothing in the code changes here: the result is a task file and a line in the backlog. Talk to the user in Russian; the task file is in Russian too, so the user can check it.

## 1. Research

- Read `work/backlog.md` (is it already there, or in «Найдено по дороге»?) and the whole `work/decisions.md` (was it already decided or rejected?). If a decision stands in the way, say so first.
- Read the code the idea touches, far enough to write «Что сейчас» with `file:line`.
- Store listings, languages, rating or promotion: also the relevant sections of `work/STORE_SEO_REPORT.md` and, when numbers matter, `work/analytics/`.
- Outside facts (store rules, browser APIs, library behaviour) come from their documentation, with the link.

## 2. Questions

Ask the user only what neither the code nor `CLAUDE.md` answers: what the viewer should see, which option when they differ in cost, what is out of scope. Bring each choice with its options and what each costs, and a recommendation. Do not write the file until they are settled.

## 3. The task file

If the idea is a line of the backlog's task table that already has a number but no file, keep that number. Otherwise take the next free one: the highest `NN` among `work/tasks/` and the task lines of `work/backlog.md`, plus one, two digits. Write `work/tasks/NN-short-name.md`:

```markdown
# NN. <Название>

**Выпуск:** patch / minor / major — по правилу `CLAUDE.md` → «Releasing» · **Связано:** <разделы отчёта, решения, другие задачи>

## Зачем
<Проблема и кого она касается. Доказательства: ссылки, цифры, файл:строка.>

## Что сейчас
<Как устроено сейчас, с файл:строка. Проверено по коду, а не по памяти.>

## Что сделать
<По шагам. Уже принятые решения — как решения, а не как варианты.>

## Готово, когда
<Проверяемые пункты: какой тест падает до и проходит после, что показывает запуск.>

## Ручная проверка
<Что проверить руками, в каком браузере, что ожидается.>

## Заодно
<Мелочи рядом, найденные при исследовании: что, файл:строка, как исправить. Изменение поведения — с тестом, как в задаче. Раздел можно опустить.>

## Вне задачи
<Что сознательно не делается и почему.>
```

Every item of «Готово, когда» must be something the reviewer can check by running it.

A small thing found next to the task's code (a stale comment, dead code, an obvious bug of a few lines, no decision needed) goes into «Заодно», so the user sees it before the work starts. Anything bigger or elsewhere goes to «Найдено по дороге» in the backlog, or becomes a task of its own.

The implementer sees only `CLAUDE.md`, its own instructions and this file — not this conversation, not your memory. Every rule it needs that is written nowhere else (the voice of store copy, a decision from `work/decisions.md`, what the user said here) goes into the file itself.

## 4. The backlog

Add a line to the task table in `work/backlog.md` (or fill in the existing one): number, one line of substance, status `todo`, the file. If the idea came from «Найдено по дороге», remove it from there.

A decision taken with the user along the way that will outlive the task (a rejected option, a rule for the product) goes into `work/decisions.md`: what, why, the date.

End with a short summary for the user and the command to start it: `/do NN`.
