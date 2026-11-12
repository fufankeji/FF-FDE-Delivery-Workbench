# @deepseek-ai/dsh-client-ui-fde-scenario-challenge

English | [中文](README.zh.md)

Contributes Chinese introduction, answering, results and history through `fde.workbench.lab.challenge`, using native controls and semantic theme tokens. Questions, rules, errors, accessible labels and explanations remain Chinese even when the surrounding shell uses another language.

## Behavior

The `fde-challenge` resource provider owns HTTP reads; components use `useResource` without a second business-state cache. Conflicting actions stay disabled until a write is confirmed and reread. Failed writes preserve confirmed choices. Opening the page does not start time; Start creates or resumes an attempt. The displayed countdown derives from a Host clock sample and elapsed time, requesting Host settlement at expiry. Refresh, navigation and application closure do not restart time.

Active attempts show no answer keys. Submission confirmation reports unanswered questions. Completed results expose explanations for every option, per-direction counts and practice suggestions. History and returning to the introduction do not start attempts. Opening discovery only navigates. Plugin disposal releases resources, requests and focus listeners.

## Model Experience

No model requests, prompts or credential reads. The independent local Host owns scoring; the UI creates no projects or Sessions.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- Results concern this fixed attempt, not professional level, certification or project acceptance.
- Records are shared within one runtime, not isolated by account or synchronized between runtime homes.
- Chinese question difficulty, theme readability and desktop usability require human acceptance.
