/** The directory tree mirrors archive paths and never lists files outside the selected package. */
import type { ReactNode } from 'react'
import type { LibrarySkill, SkillTreeNode } from './skills-center-data.ts'
import { skillFileTree } from './skills-center-data.ts'
import css from './skills-center.module.css'

interface TreeProps {
  readonly skill: LibrarySkill
  readonly selectedPath: string
  readonly openFolders: ReadonlySet<string>
  readonly toggleFolder: (path: string) => void
  readonly selectFile: (path: string) => void
}

/**
 * Render real files below an independently collapsible package root.
 * @param props - Selected package, file and disclosure callbacks owned by the reader.
 * @returns A nested disclosure list; collapsing a branch never clears the reader.
 */
export function SkillFileTree({ skill, selectedPath, openFolders, toggleFolder, selectFile }: TreeProps) {
  const renderNode = (node: SkillTreeNode): ReactNode => {
    if (node.kind === 'file') return <li key={node.path}>
      <button type="button" title={node.path} aria-current={selectedPath === node.path ? 'page' : undefined} onClick={() => { selectFile(node.path) }}>
        <svg className={css.treeFileIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H5v18h14V8ZM14 3v5h5M8 12h8M8 16h6" /></svg><span className={css.treeFileName}>{node.name}</span>
      </button>
    </li>
    const open = openFolders.has(node.path)
    return <li key={node.path}>
      <button type="button" className={css.treeFolder} data-skill-folder={node.path || skill.id} aria-expanded={open} title={`${node.name}/`} onClick={() => { toggleFolder(node.path) }}>
        <svg className={css.treeChevron} data-open={open} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 4 4 4-4 4" /></svg>
        <svg className={css.treeFolderIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={open ? 'M3 19V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v2M3 19l3-8h16l-3 9H5a2 2 0 0 1-2-1Z' : 'M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9H3Z'} /></svg>
        <code>{node.name}/</code><span className={css.treeCount} aria-hidden="true">{node.path === '' ? skill.files.length : node.children.length}</span>
      </button>
      {open && <ul className={css.treeChildren}>{node.children.map(renderNode)}</ul>}
    </li>
  }
  return <ul>{renderNode({ kind: 'directory', path: '', name: skill.id, children: skillFileTree(skill.files) })}</ul>
}
