# @deepseek-ai/dsh-fde-scenario-challenge

English | [中文](README.zh.md)

Independent Host plugin for the Chinese FDE scenario challenge: ten single-choice questions, two per direction, and a continuous 300-second deadline. Explanations appear after submission. The platform authors the questions rather than copying an external exam bank.

## Data and access

An explicit `DSH_HOME` is required. Its `fde-scenario-challenge/state.json` holds one shared active attempt and the latest 20 results, without account isolation. Each attempt retains its questions, answers, timestamps and revision. Historical scoring uses that snapshot. The plugin does not read or write Workspaces, project stages, Sessions or the interview database.

GET `/api/fde-scenario-challenge` reads state; POST starts, answers or submits an attempt. Both require Connection owner authentication and same-origin trust. Reads and writes settle expired attempts using the Host deadline; active responses omit answer keys. A file lock and atomic replacement protect commits. Stale revisions cannot overwrite answers; repeated starts/submissions reuse existing records. Corrupt or unknown formats fail without replacing the original file. Unloading the plugin removes its route.

## Model Experience

No prompts, tools, Agents, credentials, model calls or external question services are involved. Questions, choices and explanations are fixed Chinese material. Results describe this attempt, not certification or project acceptance.

#### KV Cache effect

No model requests, context changes, tokens or cache effects.

## Known Limitations and Deferred Work

- Local shared practice is not a tamper-resistant exam; an operator who controls files or the system clock can alter results.
- Ten fixed questions and two per direction cannot establish professional competence; repeat scores may reflect recall.
- Only the latest 20 completed attempts are retained. Cloud sync, accounts and question administration are absent.
- Atomic replacement does not promise power-loss durability; reread after a failed write to determine the saved state.
