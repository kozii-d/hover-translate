---
name: do
description: Carry out a task from work/tasks/ — the implementer agent writes the change, the reviewer agent checks it, findings go back for fixing; the user gets the summary and commits.
argument-hint: <NN>
disable-model-invocation: true
---

Carry out task $0. You orchestrate; the work is done by two subagents, each in a clean context: `implementer` and `reviewer` (`.claude/agents/`). Talk to the user in Russian.

## 1. Start

- Find `work/tasks/$0-*.md`. None, or its status in `work/backlog.md` is not `todo` / `in progress` — stop and tell the user.
- `git status --short`: uncommitted changes that are not this task's are the user's — mention them; the agents must not touch them.
- Set the status in `work/backlog.md` to `in progress`.

## 2. Implementer

Start the `implementer` agent. Its prompt: the task file's path, and nothing else — the rest it reads itself. Wait for it to finish.

When it returns a question instead of a result: ask the user (with the options it gave), then send the answer to the same agent with `SendMessage`, so it keeps its context. If resuming fails, write the answer into the task file (a «Решения по ходу» section) and start a new implementer.

## 3. Reviewer

When the implementer is done, start the `reviewer` agent with the task file's path.

- Findings marked `[исправить]` → send them to the same implementer with `SendMessage`; when it is done, send "second round" to the same reviewer. **At most two rounds.** What remains after that goes to the user.
- Findings marked `[решить]` and the implementer's "not agreed" answers do not go back: they go to the user.

## 4. Clean up

`rm -rf work/runs/$0`, run from the repository root, once both agents are finished. Nothing else in `work/` is deleted.

## 5. Report to the user

In Russian, short:

1. What was done — 5–10 lines.
2. **All** of the reviewer's findings and what happened to each: fixed / the implementer disagreed (why) / waits for your decision.
3. Manual checks — from «Ручная проверка».
4. A proposed commit message: English, imperative, as in `git log`; no Co-Authored-By line.

Details are in the task file («Результат», «Ревью»). Do not commit — the user commits.

When the user says the task is committed: delete the task file and its line in `work/backlog.md`; a decision worth remembering goes into `work/decisions.md` (what, why, the date).
