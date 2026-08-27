/** FDE project-resource upload locale dictionary. */
export const zh = {
  action: '添加项目资料',
  uploading: '正在保存项目资料…',
  success: '已将 {count} 个文件保存到 fde-resources/',
  recognitionFailed: '文件已保存，其中 {count} 个暂未完成本地识别，可在项目详情重试。',
  failure: '项目资料保存失败：{message}',
  invalidResponse: '服务返回了无效结果',
} satisfies Record<string, string>

/** Stable locale key vocabulary. */
export type FdeSourcesKey = keyof typeof zh

/** English dictionary matching the Chinese source-of-truth keys. */
export const en = {
  action: 'Add project files',
  uploading: 'Saving project files…',
  success: 'Saved {count} file(s) to fde-resources/',
  recognitionFailed: 'Files were saved, but {count} could not be recognized locally. Retry from Project details.',
  failure: 'Could not save project files: {message}',
  invalidResponse: 'The service returned an invalid result',
} satisfies Record<FdeSourcesKey, string>
