export default function ping(api) {
  api.onCommand('ping', () => {
    api.log({ type: 'pong' })
    api.write('pong\r\n')
  })
}
