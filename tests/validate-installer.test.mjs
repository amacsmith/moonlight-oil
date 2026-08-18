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
