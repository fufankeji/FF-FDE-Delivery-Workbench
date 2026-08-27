/** FDE project page and project-view copy. */

export const NS = 'fdeProject'

/** Canonical Simplified Chinese product copy. */
export const zh = {
  'launcher.label': '项目进度',
  'progress.title': '项目进度',
  'progress.subtitle': '查看全部项目的交付阶段、时间安排和当前工作。',
  'progress.close': '关闭项目进度',
  'progress.overview': '项目概览',
  'progress.timeline': '交付时间轴',
  'progress.total': '项目总数',
  'progress.active': '进行中',
  'progress.schedulePending': '待确认周期',
  'progress.sessions': '项目会话',
  'progress.empty': '还没有项目。请先从左侧新建项目。',
  'progress.companyMissing': '未填写所属企业',
  'progress.scheduleMissing': '交付周期待确认',
  'progress.enter': '进入项目交付',
  'progress.viewProject': '查看项目',
  'progress.createdAt': '创建于 {date}',
  'progress.stageLoading': '读取阶段中',
  'progress.stageError': '阶段读取失败',
  'progress.today': '今天',
  'view.api': 'API 文档',
  'view.architecture': '系统架构',
  'view.observe': '观测',
  'view.evaluate': '评估',
  'surface.loading': '正在读取项目数据…',
  'surface.failed': '项目数据读取失败：{message}',
  'surface.retry': '重试',
  'surface.refresh': '刷新',
  'surface.noProject': '当前会话未关联项目。',
} as const

/** Locale keys owned by the FDE project UI. */
export type FdeProjectKey = keyof typeof zh

/** English counterpart of the FDE project copy. */
export const en: Record<FdeProjectKey, string> = {
  'launcher.label': 'Project progress',
  'progress.title': 'Project progress',
  'progress.subtitle': 'See every project stage, schedule, and current activity.',
  'progress.close': 'Close project progress',
  'progress.overview': 'Overview',
  'progress.timeline': 'Timeline',
  'progress.total': 'Projects',
  'progress.active': 'In progress',
  'progress.schedulePending': 'Schedule pending',
  'progress.sessions': 'Sessions',
  'progress.empty': 'No projects yet. Create one from the sidebar.',
  'progress.companyMissing': 'Company not provided',
  'progress.scheduleMissing': 'Delivery schedule pending',
  'progress.enter': 'Enter project delivery',
  'progress.viewProject': 'View project',
  'progress.createdAt': 'Created {date}',
  'progress.stageLoading': 'Loading stage',
  'progress.stageError': 'Stage unavailable',
  'progress.today': 'Today',
  'view.api': 'API docs',
  'view.architecture': 'Architecture',
  'view.observe': 'Observability',
  'view.evaluate': 'Evaluation',
  'surface.loading': 'Loading project data…',
  'surface.failed': 'Failed to load project data: {message}',
  'surface.retry': 'Retry',
  'surface.refresh': 'Refresh',
  'surface.noProject': 'This session is not associated with a project.',
}
