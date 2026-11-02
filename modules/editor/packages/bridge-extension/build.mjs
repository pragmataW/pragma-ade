// Bundles the extension (esbuild) and packs dist/pragma-bridge.vsix (a zip: vsixmanifest + extension/…) and
// dist/manifest.json { version, sha256 }. The zip has fixed timestamps, so the sha changes only with the content.
import { createHash } from 'node:crypto'
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'esbuild'
import yazl from 'yazl'

const root = import.meta.dirname
const dist = join(root, 'dist')
const vsix = join(dist, 'pragma-bridge.vsix')
const bundle = join(root, 'out', 'extension.js')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const MTIME = new Date('2026-01-01T00:00:00Z')
const MANIFEST_KEYS = [
  'name',
  'displayName',
  'description',
  'publisher',
  'version',
  'license',
  'engines',
  'extensionKind',
  'main',
  'activationEvents',
  'contributes',
]

await build({
  entryPoints: [join(root, 'src', 'extension.ts')],
  outfile: bundle,
  bundle: true,
  minify: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode', 'bufferutil', 'utf-8-validate'],
  logLevel: 'warning',
})

const extensionManifest = Object.fromEntries(MANIFEST_KEYS.filter((k) => k in pkg).map((k) => [k, pkg[k]]))
const escapeXml = (s) => s.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`)
const vsixManifest = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="${pkg.name}" Version="${pkg.version}" Publisher="${pkg.publisher}" />
    <DisplayName>${escapeXml(pkg.displayName)}</DisplayName>
    <Description xml:space="preserve">${escapeXml(pkg.description)}</Description>
    <Tags></Tags>
    <Categories></Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="${pkg.engines.vscode}" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="${pkg.extensionKind.join(',')}" />
      <Property Id="Microsoft.VisualStudio.Code.ExecutesCode" Value="true" />
    </Properties>
    <License>extension/LICENSE.txt</License>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/readme.md" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.License" Path="extension/LICENSE.txt" Addressable="true" />
  </Assets>
</PackageManifest>
`
const contentTypes = `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension=".json" ContentType="application/json"/><Default Extension=".js" ContentType="application/javascript"/><Default Extension=".md" ContentType="text/markdown"/><Default Extension=".txt" ContentType="text/plain"/><Default Extension=".vsixmanifest" ContentType="text/xml"/></Types>
`

mkdirSync(dist, { recursive: true })
const zip = new yazl.ZipFile()
const add = (name, data) => zip.addBuffer(Buffer.from(data), name, { mtime: MTIME })
add('extension.vsixmanifest', vsixManifest)
add('[Content_Types].xml', contentTypes)
add('extension/package.json', `${JSON.stringify(extensionManifest, null, 2)}\n`)
add('extension/readme.md', readFileSync(join(root, 'README.md')))
add('extension/LICENSE.txt', readFileSync(join(root, 'LICENSE')))
add('extension/out/extension.js', readFileSync(bundle))
zip.end()
await new Promise((resolve, reject) =>
  zip.outputStream.pipe(createWriteStream(vsix)).on('close', resolve).on('error', reject),
)

const sha256 = createHash('sha256').update(readFileSync(vsix)).digest('hex')
writeFileSync(join(dist, 'manifest.json'), `${JSON.stringify({ version: pkg.version, sha256 }, null, 2)}\n`)
console.log(`pragma-bridge ${pkg.version} → ${vsix}`)
