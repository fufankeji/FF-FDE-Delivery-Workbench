declare module 'process/browser' {
  import process from 'process'
  export default process
}

declare module 'buffer/' {
  export * from 'buffer'
}
