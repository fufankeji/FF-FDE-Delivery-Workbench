/** Chinese-first product copy, including errors, accessible labels and result boundaries. */
export const NS = 'fdeChallenge'
/** This feature intentionally remains Chinese when the surrounding application uses another locale. */
export const zh = {
  title: 'FDE 场景判断 · 5 分钟挑战',
  eyebrow: '独立自测 · 无需模型或密钥',
  intro: '面对真实业务情境，你会先做什么？',
  description: '用 10 道中文情境题，检查从业务问题到受控交付的关键判断。完成后查看逐题解释和练习建议。',
  questions: '10 道单选题', duration: '5 分钟限时', directions: '5 个方向',
  rules: '每题只有一个最合适的选项，可前后切题和修改答案。交卷后统一显示解析；未答题不计分。',
  clockRule: '从开始成功起连续计时 5 分钟，切换页面、刷新或关闭应用都不暂停。到时只结算已成功保存的答案。',
  privacy: '记录保存在当前本机运行区；同一运行区共享一个进行中的挑战和最近 20 次结果，不区分账号。',
  boundary: '仅反映本次场景判断表现，不代表职业认证、能力等级或真实项目验收。',
  repeat: '首版使用固定题目，再次作答可能受到记忆影响，分数变化不直接代表能力提升。',
  start: '开始 5 分钟挑战', continue: '继续挑战', again: '再次挑战',
  history: '最近的挑战记录', historyEmpty: '还没有已完成的挑战',
  historyDetail: '查看解析', historyBack: '返回挑战介绍', historyLimit: '保留最近 20 次已完成记录',
  inProgress: '有一轮挑战正在进行', restore: '已恢复已保存的答案，继续使用原截止时间',
  questionNumber: '第 {current} / {total} 题', answered: '已答 {count} / {total} 题',
  remaining: '剩余时间', questionNav: '选择题目', jump: '第 {number} 题：{state}',
  answeredState: '已答', unansweredState: '未答', prev: '上一题', next: '下一题',
  submit: '交卷', submitTitle: '确认结束本轮挑战？',
  submitDescription: '还有 {count} 道题未作答。交卷后不能修改答案，将立即查看结果和解析。',
  confirmSubmit: '确认交卷', cancel: '继续作答', close: '关闭确认',
  saving: '正在保存…', saved: '已保存', ending: '时间已到，正在确认结果…',
  retry: '重新读取记录', result: '本次场景判断表现',
  score: '答对 {count} / 10 题', correct: '答对', wrong: '答错', unanswered: '未答',
  elapsed: '用时 {seconds} 秒', manual: '主动交卷', timeout: '到时结束',
  domainResult: '各方向答题情况', domainScore: '{correct} / {total} 题',
  review: '逐题解析', yourAnswer: '你的选择', rightAnswer: '正确选项',
  noAnswer: '本题未作答', why: '选项说明', practice: '建议怎么练',
  openDiscovery: '进入业务挖掘实验室', footer: '@赋范空间 独家研发',
  error_invalid: '本次请求无效，请重新读取记录后再操作',
  error_forbidden: '访问授权已失效，请重新打开工作台',
  error_conflict: '记录已在其他窗口更新，本次操作未保存，请重新读取后继续',
  error_storage: '本次操作未能确认保存，请重新读取记录核对；计时不会暂停',
  error_corrupt: '答题记录无法读取，原文件已保留，请联系维护者恢复后重试',
  error_unavailable: '暂时无法读取挑战，请检查本地服务后重试',
  loading: '正在读取挑战记录',
} as const

/** Literal message keys for typed locale binding. */
export type ChallengeKey = keyof typeof zh
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { fdeChallenge: ChallengeKey }
}
