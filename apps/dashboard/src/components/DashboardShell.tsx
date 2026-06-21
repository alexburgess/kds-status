"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatPort, formatRelativeTime } from "@/lib/format";
import type { DashboardDevice, DashboardSnapshot, ExpectedSetting, PrinterDefinition } from "@/lib/types";

interface DashboardShellProps {
  snapshot: DashboardSnapshot;
}

export function DashboardShell({ snapshot }: DashboardShellProps) {
  const [selectedDeviceId, setSelectedDeviceId] = useState(snapshot.devices[0]?.device.deviceId ?? "");
  const [draft, setDraft] = useState<DashboardDevice["device"] | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);

  const selected = useMemo(
    () => snapshot.devices.find((item) => item.device.deviceId === selectedDeviceId) ?? snapshot.devices[0],
    [selectedDeviceId, snapshot.devices]
  );

  const visibleDevice = draft && selected?.device.deviceId === draft.deviceId ? draft : selected?.device;
  const healthyCount = snapshot.devices.filter((item) => item.summary.severity === "healthy").length;
  const attentionCount = snapshot.devices.filter((item) => item.summary.severity === "critical").length;
  const staleCount = snapshot.devices.filter((item) => item.summary.severity === "warning" || item.summary.severity === "unknown").length;

  function selectDevice(device: DashboardDevice) {
    setSelectedDeviceId(device.device.deviceId);
    setDraft(null);
    setDraftSaved(false);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <KitchenIcon />
          </span>
          <div>
            <strong>KDS Status</strong>
            <small>{snapshot.mode === "demo" ? "Demo mode" : "Supabase live"}</small>
          </div>
        </div>

        <nav className="nav-list">
          <a className="nav-item active" href="#fleet">
            <FleetIcon />
            Fleet
          </a>
          <Link className="nav-item" href="/definitions">
            <SettingsIcon />
            Definitions
          </Link>
        </nav>

        <div className="sidebar-note">
          <span>Device identity</span>
          <strong>Assigned deviceId</strong>
          <p>Configured through Miradore managed app configuration.</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>Kitchen Display Fleet</h1>
            <p>Diagnose Android KDS screens, printer reachability, network path, and Square KDS version state.</p>
          </div>
          <div className="generated-at">Updated {formatRelativeTime(snapshot.generatedAt)}</div>
        </header>

        <section className="summary-strip" aria-label="Fleet summary">
          <SummaryTile label="Healthy" value={healthyCount} tone="healthy" />
          <SummaryTile label="Needs attention" value={attentionCount} tone="critical" />
          <SummaryTile label="Stale or missing" value={staleCount} tone="warning" />
          <SummaryTile label="Defined screens" value={snapshot.devices.length} tone="neutral" />
        </section>

        <div className="content-grid">
          <section className="panel fleet-panel" id="fleet">
            <div className="section-heading">
              <div>
                <h2>Fleet</h2>
                <p>Live status from each KDS companion app.</p>
              </div>
            </div>

            <div className="table-frame">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Screen</th>
                    <th>Status</th>
                    <th>Last seen</th>
                    <th>Local IP</th>
                    <th>Network</th>
                    <th>Printers</th>
                    <th>Square KDS</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.devices.map((item) => (
                    <tr
                      className={item.device.deviceId === selected?.device.deviceId ? "selected-row" : ""}
                      key={item.device.deviceId}
                      onClick={() => selectDevice(item)}
                    >
                      <td>
                        <button className="row-button" type="button" onClick={() => selectDevice(item)}>
                          <strong>{item.device.displayName}</strong>
                          <span>{item.device.deviceId}</span>
                        </button>
                      </td>
                      <td>
                        <span className={`status-pill ${item.summary.severity}`}>{item.summary.label}</span>
                      </td>
                      <td>{item.latestReport ? formatRelativeTime(item.latestReport.reportedAt) : "Never"}</td>
                      <td>{item.latestReport?.localIp ?? "Unknown"}</td>
                      <td>{item.latestReport?.activeTransport ?? "Unknown"}</td>
                      <td>
                        {item.latestReport
                          ? `${item.latestReport.printerChecks.filter((printer) => printer.ok).length}/${
                              item.latestReport.printerChecks.length
                            }`
                          : `${item.device.printers.length} expected`}
                      </td>
                      <td>{item.latestReport?.squareKds.installedVersion ?? item.latestReport?.squareKds.versionStatus ?? "Unknown"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {selected && visibleDevice ? (
            <aside className="panel detail-panel" aria-label="Selected device">
              <div className="detail-heading">
                <div>
                  <span className="label">Selected screen</span>
                  <h2>{visibleDevice.displayName}</h2>
                  <p>{visibleDevice.locationName} · {visibleDevice.role}</p>
                </div>
                <Link className="icon-button" href={`/devices/${visibleDevice.deviceId}`} aria-label="Open status history">
                  <HistoryIcon />
                </Link>
              </div>

              <section className="detail-section">
                <h3>Current Checks</h3>
                <ul className="check-list">
                  {selected.summary.checks.map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ul>
              </section>

              <section className="detail-section">
                <h3>Printers</h3>
                <div className="printer-list">
                  {visibleDevice.printers.length === 0 ? (
                    <p className="muted">No printer expected for this screen.</p>
                  ) : (
                    visibleDevice.printers.map((printer) => (
                      <div className="printer-row" key={printer.id}>
                        <span>{printer.name}</span>
                        <strong>{formatPort(printer.host, printer.port)}</strong>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="detail-section">
                <h3>Definition</h3>
                <DefinitionEditor
                  device={visibleDevice}
                  onChange={(next) => {
                    setDraft(next);
                    setDraftSaved(false);
                  }}
                  onSave={() => setDraftSaved(true)}
                />
                {draftSaved ? <p className="save-state">Draft updated on this screen only.</p> : null}
                <Link className="secondary-link" href="/definitions">
                  Create or edit a real device definition
                </Link>
              </section>
            </aside>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function SummaryTile({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "healthy" | "critical" | "warning" | "neutral";
}) {
  return (
    <article className={`summary-tile ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function DefinitionEditor({
  device,
  onChange,
  onSave
}: {
  device: DashboardDevice["device"];
  onChange: (device: DashboardDevice["device"]) => void;
  onSave: () => void;
}) {
  function updateSetting(index: number, patch: Partial<ExpectedSetting>) {
    const expectedSettings = device.expectedSettings.map((setting, currentIndex) =>
      currentIndex === index ? { ...setting, ...patch } : setting
    );
    onChange({ ...device, expectedSettings });
  }

  function updatePrinter(index: number, patch: Partial<PrinterDefinition>) {
    const printers = device.printers.map((printer, currentIndex) =>
      currentIndex === index ? { ...printer, ...patch } : printer
    );
    onChange({ ...device, printers });
  }

  return (
    <form
      className="definition-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <label>
        Display name
        <input value={device.displayName} onChange={(event) => onChange({ ...device, displayName: event.target.value })} />
      </label>
      <label>
        Role
        <input value={device.role} onChange={(event) => onChange({ ...device, role: event.target.value })} />
      </label>
      <label>
        Notes
        <textarea value={device.notes} onChange={(event) => onChange({ ...device, notes: event.target.value })} />
      </label>

      <div className="form-subsection">
        <span>Expected setup</span>
        {device.expectedSettings.map((setting, index) => (
          <div className="definition-row" key={`${setting.section}-${setting.setting}`}>
            <input aria-label="Section" value={setting.section} onChange={(event) => updateSetting(index, { section: event.target.value })} />
            <input aria-label="Setting" value={setting.setting} onChange={(event) => updateSetting(index, { setting: event.target.value })} />
            <input aria-label="Expected value" value={setting.expected} onChange={(event) => updateSetting(index, { expected: event.target.value })} />
          </div>
        ))}
      </div>

      <div className="form-subsection">
        <span>Printer targets</span>
        {device.printers.length === 0 ? (
          <p className="muted">No printer rows configured.</p>
        ) : (
          device.printers.map((printer, index) => (
            <div className="definition-row two-col" key={printer.id}>
              <input aria-label="Printer name" value={printer.name} onChange={(event) => updatePrinter(index, { name: event.target.value })} />
              <input aria-label="Printer host" value={printer.host} onChange={(event) => updatePrinter(index, { host: event.target.value })} />
            </div>
          ))
        )}
      </div>

      <button className="primary-button" type="submit">
        <SaveIcon />
        Preview draft
      </button>
    </form>
  );
}

function KitchenIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-5l-2 3-2-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="M7 8h10M7 12h6" />
    </svg>
  );
}

function FleetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="11" rx="2" />
      <path d="M9 20h6M12 16v4" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
      <path d="M4 12h2m12 0h2M12 4v2m0 12v2M6.3 6.3l1.4 1.4m8.6 8.6 1.4 1.4m0-11.4-1.4 1.4m-8.6 8.6-1.4 1.4" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12a8 8 0 1 0 3-6.2" />
      <path d="M4 5v5h5M12 8v5l4 2" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 4h12l2 2v14H5V4Z" />
      <path d="M8 4v6h8V4M8 20v-6h8v6" />
    </svg>
  );
}
