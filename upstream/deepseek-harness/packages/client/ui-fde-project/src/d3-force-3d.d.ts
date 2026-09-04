declare module 'd3-force-3d' {
  export interface SimulationNodeDatum {
    index?: number
    x?: number
    y?: number
    z?: number
    vx?: number
    vy?: number
    vz?: number
    fx?: number | null
    fy?: number | null
    fz?: number | null
  }

  export interface SimulationLinkDatum<NodeDatum extends SimulationNodeDatum> {
    source: NodeDatum | string | number
    target: NodeDatum | string | number
    index?: number
  }

  export interface Force<NodeDatum extends SimulationNodeDatum> {
    (alpha: number): void
    initialize?: (nodes: NodeDatum[], random: () => number, dimensions: number) => void
  }

  export interface Simulation<NodeDatum extends SimulationNodeDatum> {
    force(name: string, force: Force<NodeDatum> | null): this
    stop(): this
    tick(iterations?: number): this
  }

  export interface ForceLink<
    NodeDatum extends SimulationNodeDatum,
    LinkDatum extends SimulationLinkDatum<NodeDatum>,
  > extends Force<NodeDatum> {
    id(value: (node: NodeDatum) => string | number): this
    distance(value: number | ((link: LinkDatum) => number)): this
    strength(value: number | ((link: LinkDatum) => number)): this
  }

  export interface ForceManyBody<NodeDatum extends SimulationNodeDatum> extends Force<NodeDatum> {
    strength(value: number | ((node: NodeDatum) => number)): this
  }

  export interface ForceCollide<NodeDatum extends SimulationNodeDatum> extends Force<NodeDatum> {
    radius(value: number | ((node: NodeDatum) => number)): this
  }

  export interface ForceCenter<NodeDatum extends SimulationNodeDatum> extends Force<NodeDatum> {
    strength(value: number): this
  }

  export function forceSimulation<NodeDatum extends SimulationNodeDatum>(
    nodes?: NodeDatum[],
    numDimensions?: number,
  ): Simulation<NodeDatum>
  export function forceLink<
    NodeDatum extends SimulationNodeDatum,
    LinkDatum extends SimulationLinkDatum<NodeDatum>,
  >(links?: LinkDatum[]): ForceLink<NodeDatum, LinkDatum>
  export function forceManyBody<NodeDatum extends SimulationNodeDatum>(): ForceManyBody<NodeDatum>
  export function forceCollide<NodeDatum extends SimulationNodeDatum>(): ForceCollide<NodeDatum>
  export function forceCenter<NodeDatum extends SimulationNodeDatum>(x?: number, y?: number, z?: number): ForceCenter<NodeDatum>
}
