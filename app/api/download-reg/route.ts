import { NextResponse } from "next/server"

export async function GET() {
  const regContent = `Windows Registry Editor Version 5.00

[HKEY_CLASSES_ROOT\\openfolder]
@="URL:Open Folder Protocol"
"URL Protocol"=""

[HKEY_CLASSES_ROOT\\openfolder\\shell]

[HKEY_CLASSES_ROOT\\openfolder\\shell\\open]

[HKEY_CLASSES_ROOT\\openfolder\\shell\\open\\command]
@="powershell -windowstyle hidden -Command \\"$p='%1' -replace '^openfolder:',''; $p=[Uri]::UnescapeDataString($p); Start-Process explorer.exe -ArgumentList \\\"\`\\\"$p\`\\\"\\\"; $w=New-Object -ComObject WScript.Shell; Start-Sleep -m 250; $leaf=Split-Path $p -Leaf; if($leaf){ $w.AppActivate($leaf) }\\""
`

  return new NextResponse(regContent, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="enable-1click-open-folder.reg"',
    },
  })
}
