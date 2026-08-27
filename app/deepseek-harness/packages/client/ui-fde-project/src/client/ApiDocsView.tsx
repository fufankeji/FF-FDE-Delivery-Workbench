/** Project API documentation view. */

import type { ProjectViewProps } from './slots.ts'
import { ProjectViewHeader, ProjectViewState } from './view-state.tsx'
import css from './project.module.css'

function endpointLabel(value: string | undefined): string {
  if (value === undefined) return '项目内 OpenAPI'
  try {
    return new URL(value).host || value
  } catch {
    return value
  }
}

function methodKind(method: string): 'read' | 'create' | 'update' | 'delete' | 'other' {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return 'read'
  if (method === 'POST') return 'create'
  if (method === 'PUT' || method === 'PATCH') return 'update'
  if (method === 'DELETE') return 'delete'
  return 'other'
}

/** Present the project's configured docs URL and OpenAPI source without issuing API calls. */
export function ApiDocsView(props: ProjectViewProps) {
  return (
    <ProjectViewState props={props}>{(snapshot, workspace) => {
      const api = snapshot.apiDocs
      return (
        <section className={`${css.surfaceRoot} ${css.apiSurface}`} data-conversation-composer-overlay="">
          <ProjectViewHeader
            eyebrow={workspace.title}
            title="API 文档"
            description="查看当前项目公开的接口说明。接口调用能力由 dsh-openapi 提供，并受允许方法与网络范围限制。"
            onRefresh={() => { props.refreshProjectSurface(workspace.workspaceId) }}
            refreshLabel={props.t('surface.refresh')}
          />
          {api.status === 'unconfigured' && (
            <div className={css.emptyArtifact}>
              <span className={css.emptyArtifactIcon}>API</span>
              <h2>尚未配置 API 文档</h2>
              <p>启动项目接口服务后，在项目根目录创建 <code>.fde/api-docs.json</code>，或提供常见位置的 OpenAPI 文件。</p>
              <pre>{`{
  "docsUrl": "http://127.0.0.1:8000/docs",
  "openapiSource": "http://127.0.0.1:8000/openapi.json",
  "allowedMethods": ["GET", "HEAD"]
}`}</pre>
            </div>
          )}
          {api.status === 'invalid' && (
            <div className={css.artifactError} role="alert">
              <strong>API 文档配置无效</strong><p>{api.message}</p>
            </div>
          )}
          {api.status === 'configured' && (
            <div className={css.apiLayout}>
              <aside className={css.apiInfo}>
                <header className={css.apiIdentity}>
                  <span className={css.apiMonogram}>API</span>
                  <div>
                    <span>接口工作区</span>
                    <strong>{endpointLabel(api.baseUrl ?? api.docsUrl ?? api.openapiSource)}</strong>
                    <small>{workspace.title}</small>
                  </div>
                </header>
                <div className={css.apiConnection}>
                  <i aria-hidden="true" />
                  <div><strong>文档已连接</strong><span>嵌入页面可用</span></div>
                  <b>LIVE</b>
                </div>
                <dl className={css.apiStats}>
                  <div><dt>请求方法</dt><dd>{api.allowedMethods.length} 种</dd></div>
                  <div><dt>访问边界</dt><dd>{api.allowPrivateNetwork ? '项目私网' : '仅公网'}</dd></div>
                </dl>
                <section className={css.apiInfoSection}>
                  <h2>连接信息</h2>
                  <div className={css.apiEndpoint}>
                    <span>服务地址</span>
                    <code title={api.baseUrl}>{api.baseUrl ?? '使用文档声明地址'}</code>
                  </div>
                  <div className={css.apiEndpoint}>
                    <span>OpenAPI 来源</span>
                    <code title={api.openapiSource}>{api.openapiSource ?? '未单独配置'}</code>
                  </div>
                </section>
                <section className={css.apiInfoSection}>
                  <h2>允许方法</h2>
                  <div className={css.methodList}>
                    {api.allowedMethods.map(method => <b key={method} data-method={methodKind(method)}>{method}</b>)}
                  </div>
                </section>
                <p className={css.apiBoundary}>
                  <i aria-hidden="true">◇</i>
                  <span>{api.allowPrivateNetwork ? '已允许当前项目访问私网；请求仍受方法白名单限制。' : '仅允许访问公网地址；请求仍受方法白名单限制。'}</span>
                </p>
                {api.docsUrl !== undefined && (
                  <a className={css.apiOpenButton} href={api.docsUrl} target="_blank" rel="noreferrer">
                    在新窗口打开<span aria-hidden="true">↗</span>
                  </a>
                )}
              </aside>
              {api.docsUrl === undefined
                ? (
                  <div className={css.apiSourceOnly}>
                    <h2>已发现 OpenAPI 文件</h2>
                    <p>
                      当前项目还没有可嵌入的文档页面。启动 Swagger UI、Scalar 或 Redoc 后，把地址写入
                      {' '}<code>docsUrl</code> 即可在这里展示。
                    </p>
                    <code>{api.openapiSource}</code>
                  </div>
                )
                : (
                  <div className={css.apiFrameWrap}>
                    <header className={css.apiFrameHeader}>
                      <div className={css.apiFrameTitle}>
                        <span className={css.apiFrameMark} aria-hidden="true">{'{ }'}</span>
                        <div><strong>交互式接口说明</strong><small>OpenAPI 文档预览</small></div>
                      </div>
                      <code title={api.docsUrl}>{endpointLabel(api.docsUrl)}</code>
                      <span className={css.apiEmbedStatus}><i aria-hidden="true" />安全嵌入</span>
                    </header>
                    <iframe
                      className={css.apiFrame}
                      title={`${workspace.title} API 文档`}
                      src={api.docsUrl}
                      sandbox="allow-forms allow-popups allow-same-origin allow-scripts"
                      referrerPolicy="no-referrer"
                    />
                    <footer className={css.apiFrameFooter}>
                      <span><i aria-hidden="true" />受限沙箱模式</span>
                      <span>若接口服务禁止嵌入，请使用“在新窗口打开”。</span>
                    </footer>
                  </div>
                )}
            </div>
          )}
        </section>
      )
    }}</ProjectViewState>
  )
}
