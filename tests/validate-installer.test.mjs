import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

describe("Inno Setup script", () => {
  const iss = readFileSync(
    resolve(ROOT, "installer/moonlight-oil.iss"),
    "utf8",
  );

  it("has a [Setup] section", () => {
    assert.match(iss, /\[Setup\]/);
  });

  it("has a [Tasks] section with docker and podman", () => {
    assert.match(iss, /\[Tasks\]/);
    assert.match(iss, /Name:\s*"docker"/);
    assert.match(iss, /Name:\s*"podman"/);
  });

  it("has a [Files] section", () => {
    assert.match(iss, /\[Files\]/);
  });

  it("has a [Icons] section with desktop shortcut", () => {
    assert.match(iss, /\[Icons\]/);
    assert.match(iss, /commondesktop/);
  });

  it("has a [Run] section for post-install", () => {
    assert.match(iss, /\[Run\]/);
  });

  it("has an [UninstallRun] section", () => {
    assert.match(iss, /\[UninstallRun\]/);
  });

  it("requires 64-bit Windows", () => {
    assert.match(iss, /x64compatible/);
  });

  it("requires admin privileges", () => {
    assert.match(iss, /PrivilegesRequired=admin/);
  });

  it("references the icon file", () => {
    assert.match(iss, /library\.ico/);
  });
});

describe("PowerShell scripts", () => {
  const scriptsDir = resolve(ROOT, "installer/scripts");
  const scripts = readdirSync(scriptsDir).filter((f) => f.endsWith(".ps1"));

  it("has all required scripts", () => {
    const names = scripts.sort();
    assert.ok(names.includes("common.ps1"), "missing common.ps1");
    assert.ok(names.includes("install.ps1"), "missing install.ps1");
    assert.ok(names.includes("launch.ps1"), "missing launch.ps1");
    assert.ok(names.includes("stop.ps1"), "missing stop.ps1");
    assert.ok(names.includes("uninstall.ps1"), "missing uninstall.ps1");
  });

  it("common.ps1 defines required functions", () => {
    const common = readFileSync(resolve(scriptsDir, "common.ps1"), "utf8");
    assert.match(common, /function Write-Log/);
    assert.match(common, /function Write-Banner/);
    assert.match(common, /function Get-Runtime/);
    assert.match(common, /function Invoke-Compose/);
    assert.match(common, /function Test-EngineReady/);
    assert.match(common, /function Wait-ForUrl/);
    assert.match(common, /function Assert-ValidSignature/);
    assert.match(common, /function Get-LanAddress/);
    assert.match(common, /function Set-EnvValue/);
  });

  it("Get-LanAddress ignores addresses a tablet can't reach", () => {
    const common = readFileSync(resolve(scriptsDir, "common.ps1"), "utf8");
    // Loopback and link-local are useless to another device on the network.
    assert.match(common, /\^\(127\\\.\|169\\\.254\\\.\)/);
    // Asking which interface carries the default route is what keeps us off
    // the virtual adapters that Docker and Podman install.
    assert.match(common, /Get-NetRoute -DestinationPrefix '0\.0\.0\.0\/0'/);
  });

  it("Get-LanAddress returns empty rather than throwing when there's no answer", () => {
    const common = readFileSync(resolve(scriptsDir, "common.ps1"), "utf8");
    const fn = common.slice(common.indexOf("function Get-LanAddress"));
    assert.match(fn.slice(0, fn.indexOf("function Set-EnvValue")), /return ''/);
  });

  it("Set-EnvValue leaves the rest of the file alone", () => {
    const common = readFileSync(resolve(scriptsDir, "common.ps1"), "utf8");
    const fn = common.slice(common.indexOf("function Set-EnvValue"));
    // It must rewrite only the matching key — the secret key lives in there too.
    assert.match(fn, /regex\]::Escape\(\$Key\)/);
    assert.match(fn, /if \(-not \$found\)/);
  });

  it("install.ps1 generates STORYTELLER_SECRET_KEY", () => {
    const install = readFileSync(resolve(scriptsDir, "install.ps1"), "utf8");
    assert.match(install, /STORYTELLER_SECRET_KEY/);
    assert.match(install, /RandomNumberGenerator/);
  });

  it("launch.ps1 waits for the home page", () => {
    const launch = readFileSync(resolve(scriptsDir, "launch.ps1"), "utf8");
    assert.match(launch, /Wait-ForUrl/);
  });

  it("launch.ps1 records the LAN address before starting the stack", () => {
    const launch = readFileSync(resolve(scriptsDir, "launch.ps1"), "utf8");
    const detected = launch.indexOf("Set-EnvValue -Path $envFile -Key 'LAN_HOST'");
    const started = launch.indexOf("Invoke-Compose up -d");
    assert.ok(detected > -1, "launch.ps1 should record LAN_HOST");
    assert.ok(started > -1);
    assert.ok(
      detected < started,
      "the address must be written before compose starts, or Caddy won't see it",
    );
  });

  it("install.ps1 seeds LAN_HOST so the key exists from the start", () => {
    const install = readFileSync(resolve(scriptsDir, "install.ps1"), "utf8");
    assert.match(install, /"LAN_HOST="/);
  });

  it("all scripts dot-source common.ps1", () => {
    for (const s of scripts.filter((n) => n !== "common.ps1")) {
      const content = readFileSync(resolve(scriptsDir, s), "utf8");
      assert.match(
        content,
        /\.\s+"?\$PSScriptRoot\\common\.ps1"?/,
        `${s} does not dot-source common.ps1`,
      );
    }
  });
});
