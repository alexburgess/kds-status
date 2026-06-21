"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { DashboardSnapshot } from "@/lib/types";

interface DefinitionsWorkbenchProps {
  snapshot: DashboardSnapshot;
}

interface DefinitionDraft {
  locationName: string;
  locationSlug: string;
  deviceId: string;
  deviceSecret: string;
  displayName: string;
  role: string;
  notes: string;
  squareKdsPackageName: string;
  squareKdsExpectedVersion: string;
  printerName: string;
  printerHost: string;
  printerPort: string;
  expectedSettingsJson: string;
}

const defaultSettings = [
  { section: "Tickets", setting: "Display mode", expected: "Order view" },
  { section: "Tickets", setting: "Station filter", expected: "All items" },
  { section: "Hardware", setting: "Printer", expected: "None" }
];

export function DefinitionsWorkbench({ snapshot }: DefinitionsWorkbenchProps) {
  const [draft, setDraft] = useState<DefinitionDraft>(() => createDefaultDraft());

  const sql = useMemo(() => buildDefinitionSql(draft), [draft]);
  const miradore = useMemo(() => buildMiradoreValues(draft), [draft]);

  useEffect(() => {
    setDraft((current) =>
      current.deviceSecret === "generate-after-page-load"
        ? { ...current, deviceSecret: generateSecret() }
        : current
    );
  }, []);

  function update<K extends keyof DefinitionDraft>(key: K, value: DefinitionDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function regenerateSecret() {
    update("deviceSecret", generateSecret());
  }

  return (
    <main className="page-shell definitions-shell">
      <header className="page-header">
        <div>
          <Link className="back-link" href="/">
            Back to fleet
          </Link>
          <h1>Definitions</h1>
          <p>Create the source-of-truth record that a KDS tablet loads by its assigned deviceId.</p>
        </div>
      </header>

      <section className="definitions-grid">
        <article className="panel definition-guide">
          <h2>How defining a device works</h2>
          <ol>
            <li>Create a deviceId and a long device secret.</li>
            <li>Insert the device definition into Supabase using the generated SQL.</li>
            <li>Push the same deviceId, raw device secret, and API URL to that tablet in Miradore.</li>
            <li>The Android app fetches this definition and reports status back as that device.</li>
          </ol>
          <p>
            The secret is only sent to the tablet and stored hashed in Supabase. The dashboard never needs the raw
            secret again after Miradore is configured.
          </p>
        </article>

        <article className="panel current-definitions">
          <h2>Current Definitions</h2>
          <div className="definition-list">
            {snapshot.devices.map((item) => (
              <Link className="definition-list-row" href={`/devices/${item.device.deviceId}`} key={item.device.deviceId}>
                <span>
                  <strong>{item.device.displayName}</strong>
                  <em>{item.device.locationName} · {item.device.role}</em>
                </span>
                <code>{item.device.deviceId}</code>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="panel builder-panel">
        <div className="section-heading">
          <div>
            <h2>New Device Definition Builder</h2>
            <p>Fill this in, then use the generated Supabase SQL and Miradore values.</p>
          </div>
        </div>

        <div className="builder-grid">
          <form className="builder-form">
            <label>
              Location name
              <input value={draft.locationName} onChange={(event) => update("locationName", event.target.value)} />
            </label>
            <label>
              Location slug
              <input value={draft.locationSlug} onChange={(event) => update("locationSlug", event.target.value)} />
            </label>
            <label>
              Display name
              <input value={draft.displayName} onChange={(event) => update("displayName", event.target.value)} />
            </label>
            <label>
              Device ID
              <input value={draft.deviceId} onChange={(event) => update("deviceId", event.target.value)} />
            </label>
            <label>
              Device secret
              <span className="inline-control">
                <input value={draft.deviceSecret} onChange={(event) => update("deviceSecret", event.target.value)} />
                <button type="button" onClick={regenerateSecret}>
                  Regenerate
                </button>
              </span>
            </label>
            <label>
              Role
              <input value={draft.role} onChange={(event) => update("role", event.target.value)} />
            </label>
            <label>
              Notes
              <textarea value={draft.notes} onChange={(event) => update("notes", event.target.value)} />
            </label>
            <label>
              Square KDS package name
              <input
                placeholder="Leave blank until confirmed from Miradore"
                value={draft.squareKdsPackageName}
                onChange={(event) => update("squareKdsPackageName", event.target.value)}
              />
            </label>
            <label>
              Expected Square KDS version
              <input
                placeholder="Optional"
                value={draft.squareKdsExpectedVersion}
                onChange={(event) => update("squareKdsExpectedVersion", event.target.value)}
              />
            </label>
            <div className="form-subsection">
              <span>Printer target</span>
              <div className="definition-row">
                <input
                  aria-label="Printer name"
                  placeholder="Printer name"
                  value={draft.printerName}
                  onChange={(event) => update("printerName", event.target.value)}
                />
                <input
                  aria-label="Printer host"
                  placeholder="192.168.20.61"
                  value={draft.printerHost}
                  onChange={(event) => update("printerHost", event.target.value)}
                />
                <input
                  aria-label="Printer port"
                  value={draft.printerPort}
                  onChange={(event) => update("printerPort", event.target.value)}
                />
              </div>
            </div>
            <label>
              Expected settings JSON
              <textarea
                className="code-textarea"
                value={draft.expectedSettingsJson}
                onChange={(event) => update("expectedSettingsJson", event.target.value)}
              />
            </label>
          </form>

          <div className="generated-output">
            <OutputBlock title="Supabase SQL" value={sql} />
            <OutputBlock title="Miradore managed config" value={miradore} />
          </div>
        </div>
      </section>
    </main>
  );
}

function OutputBlock({ title, value }: { title: string; value: string }) {
  return (
    <section className="output-block">
      <div className="output-heading">
        <h3>{title}</h3>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(value);
          }}
        >
          Copy
        </button>
      </div>
      <pre>{value}</pre>
    </section>
  );
}

function createDefaultDraft(): DefinitionDraft {
  return {
    locationName: "Downtown Kitchen",
    locationSlug: "downtown-kitchen",
    deviceId: "prep-line-01",
    deviceSecret: "generate-after-page-load",
    displayName: "Prep Line 01",
    role: "Station screen",
    notes: "Confirm expected Square KDS settings before service.",
    squareKdsPackageName: "",
    squareKdsExpectedVersion: "",
    printerName: "",
    printerHost: "",
    printerPort: "9100",
    expectedSettingsJson: JSON.stringify(defaultSettings, null, 2)
  };
}

function buildMiradoreValues(draft: DefinitionDraft) {
  return [
    `device_id=${draft.deviceId}`,
    `device_secret=${draft.deviceSecret}`,
    "api_base_url=https://YOUR-DASHBOARD-HOSTNAME"
  ].join("\n");
}

function buildDefinitionSql(draft: DefinitionDraft) {
  const locationSlug = sqlString(draft.locationSlug);
  const locationName = sqlString(draft.locationName);
  const printerPort = Number.parseInt(draft.printerPort, 10) || 9100;
  const expectedSettings = normalizeJson(draft.expectedSettingsJson);
  const printerSql = draft.printerName.trim() && draft.printerHost.trim()
    ? `
insert into public.printers (device_id, name, host, port, description)
select id, ${sqlString(draft.printerName)}, ${sqlString(draft.printerHost)}, ${printerPort}, null
from public.devices
where device_id = ${sqlString(draft.deviceId)};`
    : "";

  return `insert into public.locations (name, slug)
values (${locationName}, ${locationSlug})
on conflict (slug) do update set
  name = excluded.name,
  updated_at = now();

insert into public.devices (
  location_id,
  device_id,
  device_secret_hash,
  display_name,
  role,
  notes,
  square_kds_package_name,
  square_kds_expected_version,
  expected_settings
)
select
  locations.id,
  ${sqlString(draft.deviceId)},
  encode(digest(${sqlString(draft.deviceSecret)}, 'sha256'), 'hex'),
  ${sqlString(draft.displayName)},
  ${sqlString(draft.role)},
  ${sqlString(draft.notes)},
  ${sqlNullable(draft.squareKdsPackageName)},
  ${sqlNullable(draft.squareKdsExpectedVersion)},
  ${sqlString(expectedSettings)}::jsonb
from public.locations
where slug = ${locationSlug}
on conflict (device_id) do update set
  location_id = excluded.location_id,
  device_secret_hash = excluded.device_secret_hash,
  display_name = excluded.display_name,
  role = excluded.role,
  notes = excluded.notes,
  square_kds_package_name = excluded.square_kds_package_name,
  square_kds_expected_version = excluded.square_kds_expected_version,
  expected_settings = excluded.expected_settings,
  updated_at = now();${printerSql}`;
}

function normalizeJson(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return JSON.stringify(defaultSettings, null, 2);
  }
}

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlNullable(value: string) {
  return value.trim() ? sqlString(value.trim()) : "null";
}

function generateSecret() {
  const array = new Uint8Array(18);
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(array);
  } else {
    for (let index = 0; index < array.length; index += 1) {
      array[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
