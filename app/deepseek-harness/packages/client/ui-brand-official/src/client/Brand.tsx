import type { HeroBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'

type OfficialBrandMarkProps = HeroBrandMarkOwnerProps & SidebarBrandMarkOwnerProps
const FF_LOGO_SRC = '/ff-brand/ff-logo.png'
const FF_LOGO_RADIUS = '20%'

/**
 * Render the FF mark with the presentation requested by its host surface.
 * @param props - Host-supplied mark presentation.
 * @returns the shared FF logo image.
 */
export function OfficialBrandMark({ size, className }: OfficialBrandMarkProps) {
  return (
    <img
      src={FF_LOGO_SRC}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain', borderRadius: FF_LOGO_RADIUS }}
    />
  )
}

/**
 * Render the FDE product name without its independently slotted mark.
 * @returns the exact confirmed product name.
 */
export function OfficialBrandName() {
  return <span>FF-FDE工作台</span>
}
