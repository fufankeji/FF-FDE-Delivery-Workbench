/** Shared official panel rows and More menu; both shells retain one owner for registration and pins. */
import { useState } from 'react'
import clsx from 'clsx'
import { IconAppsAddOutlineRegular, IconPinFillRegular, focusWithoutRing, Menu, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { FactoryComponentPropsOf, InjectFace, PropsRenderFactories, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SidebarPanelActionsOwnerProps, SidebarPanelMetadata, SidebarRootInjected, SidebarSectionOwnerProps } from './contract/slots.ts'
import { FIXED_PANEL_ID } from './panel-pins.ts'
import css from './SidebarRoot.module.css'

type PanelRowProps =
  Pick<SidebarPanelMetadata, 'id' | 'label'>
  & Pick<SidebarSectionOwnerProps, 'wide'>
  & Pick<PropsRuntime<'sidebar'>, 'usePanelInfo'>
  & Pick<InjectFace<SidebarRootInjected>, 'selectPanel' | 'trackEntryClick' | 'setPinned'>
  & { readonly unpinLabel: string; readonly unpinTooltip: string; readonly canUnpin: boolean }
  & PropsRenderFactories

/** Analytics category of an official panel; other panels are never reported. */
function officialEntry(id: string): 'plugin' | 'cron' | undefined {
  if (id === 'plugins') return 'plugin'
  return id === 'schedules' ? 'cron' : undefined
}

/** Each panel row subscribes only to its own selection state. */
function PanelRow({
  id, label, wide, unpinLabel, unpinTooltip, canUnpin, usePanelInfo, selectPanel, setPinned, trackEntryClick, renderFactorySlot,
}: PanelRowProps) {
  const active = usePanelInfo(info => info.activePanelId === id)
  return (
    <div className={clsx(css.panelEntry, wide && css.panelEntryWide, active && css.panelEntryActive)}>
      <Tooltip label={label} delayMs={500} disabled={wide}>
        <button
          type="button"
          className={css.panelRow}
          aria-label={label}
          aria-current={active ? 'page' : undefined}
          onClick={() => {
            const entry = officialEntry(id)
            if (entry !== undefined) trackEntryClick({ menu_name: entry, position: 'sidebar' })
            selectPanel(id)
          }}
        >
          <span className={css.panelGlyph} aria-hidden="true">
            {renderFactorySlot('sidebar.panel.icon', { id, size: wide ? 16 : 18, active })}
          </span>
          {wide && (
            <span className={clsx(css.panelTitle, css.wide)}>
              {label}
            </span>
          )}
        </button>
      </Tooltip>
      {wide && canUnpin && <Tooltip label={unpinTooltip} side="bottom" align="end" delayMs={500} portal>
        <button type="button" className={css.panelUnpin} aria-label={unpinLabel} onClick={(event) => {
          // Unpin is rendered only while this navigation also renders More.
          const navigation = event.currentTarget.closest('nav') as HTMLElement
          const more = navigation.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement
          focusWithoutRing(more)
          setPinned(id, false)
        }}>
          <IconPinFillRegular size={14} />
        </button>
      </Tooltip>}
    </div>
  )
}

type PanelMoreMenuProps =
  Pick<SidebarSectionOwnerProps, 'wide'>
  & Omit<SidebarPanelActionsOwnerProps, 'onDismiss'>
  & PropsRenderSlots<'sidebar.panellist.actions'>
  & Pick<InjectFace<SidebarRootInjected>, 'trackEntryClick'>
  & { readonly label: string }

/** The panel list's More launcher: a panel-row button whose menu rows come from `sidebar.panellist.actions`. */
function PanelMoreMenu({ wide, label, entries, onOpen, onPinnedChange, trackEntryClick, renderSlot, beforeNavigate }: PanelMoreMenuProps) {
  const [open, setOpen] = useState(false)
  const onDismiss = (): void => { setOpen(false) }
  return (
    <Menu open={open} onClose={onDismiss} portal autoFocus className={css.moreAnchor} listClassName={css.moreMenu}
      anchor={(
        <Tooltip label={label} delayMs={500} disabled={wide}>
          <button type="button" className={css.panelRow} aria-label={label} aria-haspopup="menu" aria-expanded={open}
            onClick={() => {
              trackEntryClick({ menu_name: 'more', position: 'sidebar' })
              setOpen(value => !value)
            }}>
            <span className={css.panelGlyph} aria-hidden="true"><IconAppsAddOutlineRegular size={wide ? 16 : 18} /></span>
            {wide && <span className={clsx(css.panelTitle, css.wide)}>{label}</span>}
          </button>
        </Tooltip>
      )}>
      {renderSlot('sidebar.panellist.actions', { entries, onOpen, onPinnedChange, onDismiss, beforeNavigate })}
    </Menu>
  )
}

/**
 * Render current authorized panels without installing features or starting work.
 * @param props - Shared panel sources plus the embedding shell's optional navigation handoff.
 * @returns Official panel launchers and their More menu, or nothing without registered panels.
 */
export function SidebarPanels({ wide, beforeNavigate, selectPanel: selectNativePanel, setPinned, trackEntryClick, usePanels, useEntryPins, useEntryActions, usePanelInfo, renderSlot, renderFactorySlot, t }: FactoryComponentPropsOf<'sidebar.panels'>) {
  const panels = usePanels(snapshot => snapshot)
  const unpinned = useEntryPins(ids => ids)
  const activePanelId = usePanelInfo(info => info.activePanelId)
  const hasEntryActions = useEntryActions(registered => registered)
  const selectPanel: SidebarRootInjected['selectPanel'] = id => { beforeNavigate?.(); selectNativePanel(id) }
  if (panels.length === 0) return null
  return (
    <nav className={clsx(css.panelList, !wide && css.compactPanels)} data-sidebar-panels aria-label={t('panels.label')}>
      {panels.filter(({ id }) => id === FIXED_PANEL_ID || !hasEntryActions || !unpinned.includes(id)).map(({ id, label }) => (
        <PanelRow
          key={id}
          id={id}
          label={label}
          wide={wide}
          unpinLabel={t('panels.unpin', { name: label })}
          unpinTooltip={t('panels.unpinTooltip')}
          canUnpin={hasEntryActions && id !== FIXED_PANEL_ID}
          setPinned={setPinned}
          usePanelInfo={usePanelInfo}
          selectPanel={selectPanel}
          trackEntryClick={trackEntryClick}
          renderFactorySlot={renderFactorySlot}
        />
      ))}
      {hasEntryActions && (
        <PanelMoreMenu
          wide={wide}
          beforeNavigate={beforeNavigate}
          label={t('panels.more')}
          entries={panels.filter(({ id }) => id !== FIXED_PANEL_ID)
            .map(({ id, label }) => ({ id, label, pinned: !unpinned.includes(id), active: id === activePanelId }))}
          onOpen={(id) => {
            const entry = officialEntry(id)
            if (entry !== undefined) trackEntryClick({ menu_name: entry, position: 'sidebar_more' })
            const panel = panels.find(candidate => candidate.id === id)
            if (panel !== undefined) selectPanel(panel.id)
          }}
          onPinnedChange={setPinned}
          trackEntryClick={trackEntryClick}
          renderSlot={renderSlot}
        />
      )}
    </nav>
  )
}
