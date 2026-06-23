"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { DashboardSnapshot, ExpectedSetting } from "@/lib/types";

interface DefinitionsWorkbenchProps {
  snapshot: DashboardSnapshot;
}

interface DefinitionDraft {
  locationName: string;
  locationSlug: string;
  deviceId: string;
  deviceMacAddress: string;
  deviceSecret: string;
  displayName: string;
  role: string;
  notes: string;
  squareKdsPackageName: string;
  displayType: string;
  viewPointOfSaleOrders: boolean;
  viewOnlineKioskDelayedOrders: boolean;
  sourceOrderTiming: string;
  includeFutureKitchenRoutingCategories: boolean;
  kitchenRoutingCategories: Record<string, boolean>;
  ticketCompletion: string;
  staggeredItemPrepTimes: boolean;
  coursingVisibility: string;
  hasAttachedPrinter: boolean;
  printerName: string;
  printerHost: string;
  printerPort: string;
  printerMacAddress: string;
  printerProfileName: string;
}

const kitchenRoutingCategories = [
  "HB Pergola Wine",
  "HBK Charcuterie",
  "HBK Cold Line",
  "HBK Expo",
  "HBK Hot Line",
  "HBK Pizza Line",
  "TVTR Cold Line",
  "TVTR Expo",
  "TVTR Hot Line",
  "TVTR Pizza Line",
  "TVTR Wine Expos"
];

const displayTypeOptions = ["Expeditor", "Prep"];
const sourceTimingOptions = [
  "Show orders when they're placed",
  "Show orders when marked in progress",
  "Show orders based on pickup time"
];
const ticketCompletionOptions = ["Complete on all devices", "Complete only on this device"];
const coursingOptions = ["Show fired and held courses", "Only show fired courses"];

const defaultKitchenRoutingCategories = Object.fromEntries(
  kitchenRoutingCategories.map((category) => [
    category,
    ["HBK Charcuterie", "HBK Expo", "HBK Hot Line"].includes(category)
  ])
) as Record<string, boolean>;

const sectionNames = [
  "GENERAL",
  "SOURCE & FULFILMENT",
  "ITEMS & CATEGORIES",
  "TICKETS",
  "COURSING",
  "PRINTERS"
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

  function updateKitchenRoutingCategory(category: string, enabled: boolean) {
    setDraft((current) => ({
      ...current,
      kitchenRoutingCategories: {
        ...current.kitchenRoutingCategories,
        [category]: enabled
      }
    }));
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
              KDS MAC address
              <input
                placeholder="02:00:00:12:34:44"
                value={draft.deviceMacAddress}
                onChange={(event) => update("deviceMacAddress", event.target.value)}
              />
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
                placeholder="com.squareup.rst.kds"
                value={draft.squareKdsPackageName}
                onChange={(event) => update("squareKdsPackageName", event.target.value)}
              />
            </label>
            <p className="form-note">The available version is retrieved automatically from Google Play.</p>
            <div className="settings-form-block">
              <span>KDS settings</span>
              <p className="form-note">These values generate the expected setup shown on the tablet.</p>
              <KdsSettingsControls
                draft={draft}
                update={update}
                updateKitchenRoutingCategory={updateKitchenRoutingCategory}
              />
            </div>
            <div className="form-subsection">
              <span>Printer target</span>
              <CheckboxField
                label="Does it have an attached printer"
                checked={draft.hasAttachedPrinter}
                onChange={(checked) => update("hasAttachedPrinter", checked)}
              />
              <div className="definition-row printer-target-row">
                <input
                  aria-label="Printer name"
                  placeholder="Printer name"
                  disabled={!draft.hasAttachedPrinter}
                  value={draft.printerName}
                  onChange={(event) => update("printerName", event.target.value)}
                />
                <input
                  aria-label="Printer host"
                  placeholder="192.168.20.61"
                  disabled={!draft.hasAttachedPrinter}
                  value={draft.printerHost}
                  onChange={(event) => update("printerHost", event.target.value)}
                />
                <input
                  aria-label="Printer port"
                  disabled={!draft.hasAttachedPrinter}
                  value={draft.printerPort}
                  onChange={(event) => update("printerPort", event.target.value)}
                />
                <input
                  aria-label="Printer MAC"
                  placeholder="00:11:32:aa:bb:61"
                  disabled={!draft.hasAttachedPrinter}
                  value={draft.printerMacAddress}
                  onChange={(event) => update("printerMacAddress", event.target.value)}
                />
              </div>
              <input
                aria-label="Printer profile name"
                disabled={!draft.hasAttachedPrinter}
                placeholder="Printer profile name"
                value={draft.printerProfileName}
                onChange={(event) => update("printerProfileName", event.target.value)}
              />
            </div>
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

function KdsSettingsControls({
  draft,
  update,
  updateKitchenRoutingCategory
}: {
  draft: DefinitionDraft;
  update: <K extends keyof DefinitionDraft>(key: K, value: DefinitionDraft[K]) => void;
  updateKitchenRoutingCategory: (category: string, enabled: boolean) => void;
}) {
  return (
    <div className="kds-settings-grid">
      <fieldset className="settings-fieldset">
        <legend>General</legend>
        <SelectField
          label="Display Type"
          value={draft.displayType}
          options={displayTypeOptions}
          onChange={(value) => update("displayType", value)}
        />
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>Source & Fulfilment</legend>
        <CheckboxField
          label="View point of sale orders"
          checked={draft.viewPointOfSaleOrders}
          onChange={(checked) => update("viewPointOfSaleOrders", checked)}
        />
        <CheckboxField
          label="View online, kiosk, and delayed fulfillment orders"
          checked={draft.viewOnlineKioskDelayedOrders}
          onChange={(checked) => update("viewOnlineKioskDelayedOrders", checked)}
        />
        <SelectField
          label="Show orders"
          value={draft.sourceOrderTiming}
          options={sourceTimingOptions}
          onChange={(value) => update("sourceOrderTiming", value)}
        />
      </fieldset>

      <fieldset className="settings-fieldset wide">
        <legend>Items & Categories</legend>
        <CheckboxField
          label="Include future kitchen routing categories"
          checked={draft.includeFutureKitchenRoutingCategories}
          onChange={(checked) => update("includeFutureKitchenRoutingCategories", checked)}
        />
        <span className="subtle-label">Kitchen routing categories</span>
        <div className="checkbox-grid">
          {kitchenRoutingCategories.map((category) => (
            <CheckboxField
              key={category}
              label={category}
              checked={draft.kitchenRoutingCategories[category] ?? false}
              onChange={(checked) => updateKitchenRoutingCategory(category, checked)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>Tickets</legend>
        <SelectField
          label="Complete tickets"
          value={draft.ticketCompletion}
          options={ticketCompletionOptions}
          onChange={(value) => update("ticketCompletion", value)}
        />
        <CheckboxField
          label="Staggered item prep times"
          checked={draft.staggeredItemPrepTimes}
          onChange={(checked) => update("staggeredItemPrepTimes", checked)}
        />
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>Coursing</legend>
        <SelectField
          label="Course visibility"
          value={draft.coursingVisibility}
          options={coursingOptions}
          onChange={(value) => update("coursingVisibility", value)}
        />
      </fieldset>

      <div className="section-chip-list" aria-label="Generated sections">
        {sectionNames.map((section) => (
          <span key={section}>{section}</span>
        ))}
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="select-field">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxField({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="checkbox-field">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
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
    deviceMacAddress: "",
    deviceSecret: "generate-after-page-load",
    displayName: "Prep Line 01",
    role: "Station screen",
    notes: "Confirm expected Square KDS settings before service.",
    squareKdsPackageName: "com.squareup.rst.kds",
    displayType: "Prep",
    viewPointOfSaleOrders: true,
    viewOnlineKioskDelayedOrders: true,
    sourceOrderTiming: "Show orders when they're placed",
    includeFutureKitchenRoutingCategories: false,
    kitchenRoutingCategories: defaultKitchenRoutingCategories,
    ticketCompletion: "Complete only on this device",
    staggeredItemPrepTimes: false,
    coursingVisibility: "Show fired and held courses",
    hasAttachedPrinter: false,
    printerName: "",
    printerHost: "",
    printerPort: "9100",
    printerMacAddress: "",
    printerProfileName: ""
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
  const expectedSettings = JSON.stringify(buildExpectedSettings(draft), null, 2);
  const printerSql = draft.hasAttachedPrinter && draft.printerName.trim() && draft.printerHost.trim()
    ? `
insert into public.printers (device_id, name, host, port, mac_address, description)
select id, ${sqlString(draft.printerName)}, ${sqlString(draft.printerHost)}, ${printerPort}, ${sqlNullable(draft.printerMacAddress)}, ${sqlNullable(draft.printerProfileName)}
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
  mac_address,
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
  ${sqlNullable(normalizeMacForSql(draft.deviceMacAddress))},
  encode(digest(${sqlString(draft.deviceSecret)}, 'sha256'), 'hex'),
  ${sqlString(draft.displayName)},
  ${sqlString(draft.role)},
  ${sqlString(draft.notes)},
  ${sqlNullable(draft.squareKdsPackageName)},
  null,
  ${sqlString(expectedSettings)}::jsonb
from public.locations
where slug = ${locationSlug}
on conflict (device_id) do update set
  location_id = excluded.location_id,
  mac_address = excluded.mac_address,
  device_secret_hash = excluded.device_secret_hash,
  display_name = excluded.display_name,
  role = excluded.role,
  notes = excluded.notes,
  square_kds_package_name = excluded.square_kds_package_name,
  square_kds_expected_version = excluded.square_kds_expected_version,
  expected_settings = excluded.expected_settings,
  updated_at = now();${printerSql}`;
}

function buildExpectedSettings(draft: DefinitionDraft): ExpectedSetting[] {
  return [
    { section: "General", setting: "Display Type", expected: draft.displayType },
    {
      section: "Source & Fulfilment",
      setting: "View point of sale orders",
      expected: onOff(draft.viewPointOfSaleOrders)
    },
    {
      section: "Source & Fulfilment",
      setting: "View online, kiosk, and delayed fulfillment orders",
      expected: onOff(draft.viewOnlineKioskDelayedOrders)
    },
    { section: "Source & Fulfilment", setting: "Show orders", expected: draft.sourceOrderTiming },
    {
      section: "Items & Categories",
      setting: "Include future kitchen routing categories",
      expected: onOff(draft.includeFutureKitchenRoutingCategories)
    },
    ...kitchenRoutingCategories.map((category) => ({
      section: "Items & Categories",
      setting: category,
      expected: onOff(draft.kitchenRoutingCategories[category] ?? false)
    })),
    { section: "Tickets", setting: "Complete tickets", expected: draft.ticketCompletion },
    { section: "Tickets", setting: "Staggered item prep times", expected: onOff(draft.staggeredItemPrepTimes) },
    { section: "Coursing", setting: "Course visibility", expected: draft.coursingVisibility },
    {
      section: "Printers",
      setting: "Printer Profile name",
      expected: draft.hasAttachedPrinter && draft.printerProfileName.trim() ? draft.printerProfileName.trim() : "Not configured"
    }
  ];
}

function onOff(value: boolean) {
  return value ? "On" : "Off";
}

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlNullable(value: string) {
  return value.trim() ? sqlString(value.trim()) : "null";
}

function normalizeMacForSql(value: string) {
  return value.trim().toLowerCase().replaceAll("-", ":");
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
