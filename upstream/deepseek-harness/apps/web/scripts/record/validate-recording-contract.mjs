#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const RESULT_KINDS = new Set(["journey", "operation"]);
const RECORDING_KINDS = new Set(["journey", "operation", "feature-overview"]);
const MODES = new Set(["live-result", "fixture-result"]);
const SIDE_EFFECTS = new Set(["none", "local-disposable", "external-authorized"]);
const INTERACTIONS = new Set(["click", "type", "drag"]);
const READERS = new Set(["count", "text", "value", "checked", "attribute", "url"]);
const CONFIRMATION_MODES = new Set(["standalone-staged", "pipeline-batched"]);
const VISUAL_POLICIES = new Set(["no-zoom", "agent-select", "specified"]);

const hasText = (value) => typeof value === "string" && value.trim().length > 0;

function inferProjectRoot(planPath) {
  const planDir = dirname(planPath);
  return planDir.endsWith(`${sep}scripts${sep}record`)
    ? resolve(planDir, "..", "..")
    : planDir;
}

function inside(root, candidate) {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

function loadJson(path, errors, label) {
  if (!existsSync(path)) {
    errors.push(`${label} 不存在：${path}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    errors.push(`${label} 不是合法 JSON：${error.message}`);
    return null;
  }
}

function validateOperationEvidence(evidence, at, errors) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    errors.push(`${at}.operationEvidence 必填`);
    return;
  }
  if (!MODES.has(evidence.mode)) {
    errors.push(`${at}.operationEvidence.mode 必须是 live-result 或 fixture-result`);
  }
  if (!hasText(evidence.evidenceKey)) {
    errors.push(`${at}.operationEvidence.evidenceKey 必填`);
  }
  if (!hasText(evidence.resultDescription)) {
    errors.push(`${at}.operationEvidence.resultDescription 必填`);
  }
  if (evidence.preflight?.status !== "verified" || !hasText(evidence.preflight?.notes)) {
    errors.push(`${at}.operationEvidence.preflight 必须记录 verified 和真实试跑说明`);
  }
  if (!SIDE_EFFECTS.has(evidence.sideEffects?.kind) || !hasText(evidence.sideEffects?.notes)) {
    errors.push(`${at}.operationEvidence.sideEffects 必须声明 kind 和 notes`);
  }
  if (
    evidence.sideEffects?.kind === "external-authorized" &&
    !hasText(evidence.authorizationEvidence)
  ) {
    errors.push(`${at}.operationEvidence.authorizationEvidence 必填，且不得记录密钥`);
  }
  if (evidence.mode === "fixture-result" && !hasText(evidence.fixtureDisclosure)) {
    errors.push(`${at}.operationEvidence.fixtureDisclosure 必填`);
  }
}

function validateScript(script, recording, at, errors) {
  if (!script || typeof script !== "object") return;
  const demo = script.demonstration;
  const evidence = recording.operationEvidence;
  if (!demo || typeof demo !== "object" || Array.isArray(demo)) {
    errors.push(`${at}.script.demonstration 必填`);
  } else {
    for (const field of ["kind", "mode", "evidenceKey", "resultDescription"]) {
      if (demo[field] !== (field === "kind" ? recording.kind : evidence?.[field])) {
        errors.push(`${at}.script.demonstration.${field} 必须与 recording-plan 一致`);
      }
    }
  }

  const steps = Array.isArray(script.steps) ? script.steps : [];
  if (!steps.length) {
    errors.push(`${at}.script.steps 至少包含 1 项`);
    return;
  }
  const key = evidence?.evidenceKey;
  const captureIndexes = [];
  const changeIndexes = [];
  steps.forEach((step, index) => {
    if (step?.action === "captureState" && step?.key === key) captureIndexes.push(index);
    if (step?.action === "waitForStateChange" && step?.key === key) changeIndexes.push(index);
    if (["captureState", "waitForStateChange"].includes(step?.action)) {
      const read = step.read;
      if (read != null && !READERS.has(read)) {
        errors.push(`${at}.script.steps[${index}].read 非法`);
      }
      if (read === "attribute" && !hasText(step.attribute)) {
        errors.push(`${at}.script.steps[${index}].attribute 必填`);
      }
    }
  });

  const capture = captureIndexes[0];
  const change = changeIndexes.find((index) => capture != null && index > capture);
  if (capture == null || change == null) {
    errors.push(
      `${at}.script 必须包含同 key 的 captureState → 真实交互 → waitForStateChange`
    );
    return;
  }
  const hasInteraction = steps
    .slice(capture + 1, change)
    .some((step) => INTERACTIONS.has(step?.action));
  if (!hasInteraction) {
    errors.push(`${at}.script 状态基线与结果断言之间缺少 click/type/drag 触发动作`);
  }
}

export function validateRecordingContract(plan, options = {}) {
  const errors = [];
  const planPath = options.planPath ? resolve(options.planPath) : null;
  const projectRoot = resolve(options.projectRoot || (planPath ? inferProjectRoot(planPath) : "."));
  const recordings = Array.isArray(plan?.recordings) ? plan.recordings : [];

  if (!["full-project", "feature-batch", "described-operation"].includes(plan?.mode)) {
    errors.push("recording-plan.mode 非法");
  }
  if (!CONFIRMATION_MODES.has(plan?.confirmationMode)) {
    errors.push("recording-plan.confirmationMode 必须是 standalone-staged 或 pipeline-batched");
  }
  if (plan?.approval?.status !== "approved" || !hasText(plan?.approval?.notes)) {
    errors.push("recording-plan.approval 必须记录用户已批准的范围与说明");
  }
  if (!VISUAL_POLICIES.has(plan?.approval?.visualPolicy)) {
    errors.push("recording-plan.approval.visualPolicy 必须是 no-zoom / agent-select / specified");
  }
  const expectedReviewPolicy =
    plan?.confirmationMode === "pipeline-batched"
      ? "self-check-then-final-delivery"
      : "staged";
  if (CONFIRMATION_MODES.has(plan?.confirmationMode) && plan?.approval?.reviewPolicy !== expectedReviewPolicy) {
    errors.push(
      `recording-plan.approval.reviewPolicy 必须是 ${expectedReviewPolicy}`
    );
  }
  if (!recordings.length) errors.push("recording-plan.recordings 至少包含 1 项");

  if (plan?.mode === "full-project" && !recordings.some((item) => item?.kind === "journey")) {
    errors.push("full-project 至少包含一条 journey；feature-overview 不能充当主演示");
  }

  recordings.forEach((recording, index) => {
    const at = `recordings[${index}]`;
    if (!RECORDING_KINDS.has(recording?.kind)) {
      errors.push(`${at}.kind 必须是 journey / operation / feature-overview`);
      return;
    }
    if (!hasText(recording.script)) {
      errors.push(`${at}.script 必填`);
      return;
    }
    if (isAbsolute(recording.script)) {
      errors.push(`${at}.script 必须是项目相对路径`);
      return;
    }
    const scriptPath = resolve(projectRoot, recording.script);
    if (!inside(projectRoot, scriptPath)) {
      errors.push(`${at}.script 逃逸项目根`);
      return;
    }
    const script = loadJson(scriptPath, errors, `${at}.script`);
    if (RESULT_KINDS.has(recording.kind)) {
      validateOperationEvidence(recording.operationEvidence, at, errors);
      validateScript(script, recording, at, errors);
    }
  });

  return {
    status: errors.length ? "failed" : "passed",
    errors,
    projectRoot,
    recordingCount: recordings.length,
    resultRecordingCount: recordings.filter((item) => RESULT_KINDS.has(item?.kind)).length,
    overviewCount: recordings.filter((item) => item?.kind === "feature-overview").length
  };
}

function parseCli(argv) {
  const args = [...argv];
  const at = args.indexOf("--plan");
  const plan = at >= 0 ? args[at + 1] : args.find((arg) => !arg.startsWith("--"));
  const rootAt = args.indexOf("--project-root");
  return {
    plan,
    projectRoot: rootAt >= 0 ? args[rootAt + 1] : undefined,
    json: args.includes("--json")
  };
}

function main() {
  const cli = parseCli(process.argv.slice(2));
  if (!cli.plan) {
    console.error(
      "用法：node validate-recording-contract.mjs --plan <recording-plan.json> [--project-root <root>] [--json]"
    );
    process.exit(2);
  }
  const planPath = resolve(cli.plan);
  const loadErrors = [];
  const plan = loadJson(planPath, loadErrors, "recording-plan");
  const report = plan
    ? validateRecordingContract(plan, { planPath, projectRoot: cli.projectRoot })
    : { status: "failed", errors: loadErrors };
  if (cli.json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (report.status === "passed") {
    console.log(
      `✓ 录制合同有效：${report.resultRecordingCount} 条运行结果演示 · ${report.overviewCount} 条功能概览`
    );
  } else {
    console.error(`✗ 录制合同失败（${report.errors.length} 项）`);
    report.errors.forEach((error) => console.error(`  - ${error}`));
  }
  process.exit(report.status === "passed" ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
