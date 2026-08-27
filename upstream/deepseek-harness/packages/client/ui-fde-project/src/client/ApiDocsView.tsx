/** Project API documentation view. */

import type { ProjectViewProps } from './slots.ts'
import { ProjectViewHeader, ProjectViewState } from './view-state.tsx'
import css from './project.module.css'

/** Present the project's configured docs URL and OpenAPI source without issuing API calls. */
export function ApiDocsView(props: ProjectViewProps) {
  return (
    <ProjectViewState props={props}>{(snapshot, workspace) => {
      const api = snapshot.apiDocs
      return (
        <section className={css.surfaceRoot}>
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
                <div><span>文档状态</span><strong className={css.successText}>已配置</strong></div>
                <div><span>OpenAPI 来源</span><code>{api.openapiSource ?? '未单独配置'}</code></div>
                <div><span>服务地址</span><code>{api.baseUrl ?? '使用文档声明地址'}</code></div>
                <div>
                  <span>允许方法</span>
                  <div className={css.methodList}>{api.allowedMethods.map(method => <b key={method}>{method}</b>)}</div>
                </div>
                <div>
                  <span>网络范围</span>
                  <strong>{api.allowPrivateNetwork ? '已允许当前项目访问私网' : '仅允许公网地址'}</strong>
                </div>
                {api.docsUrl !== undefined && (
                  <a href={api.docsUrl} target="_blank" rel="noreferrer">在新窗口打开 ↗</a>
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
                    <iframe
                      className={css.apiFrame}
                      title={`${workspace.title} API 文档`}
                      src={api.docsUrl}
                      sandbox="allow-forms allow-popups allow-same-origin allow-scripts"
                      referrerPolicy="no-referrer"
                    />
                    <p>若接口服务禁止嵌入，请使用左侧“在新窗口打开”。</p>
                  </div>
                )}
            </div>
          )}
        </section>
      )
    }}</ProjectViewState>
  )
}
