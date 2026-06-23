"use client";

import Link from "next/link";
import { useState } from "react";
import type { DefinitionEditorState } from "@/lib/local-definitions";

interface DefinitionsWorkbenchProps {
  initialState: DefinitionEditorState;
}

type SaveState =
  | { tone: "idle"; message: string }
  | { tone: "saving"; message: string }
  | { tone: "saved"; message: string }
  | { tone: "error"; message: string; issues?: string[] };

export function DefinitionsWorkbench({ initialState }: DefinitionsWorkbenchProps) {
  const [jsonText, setJsonText] = useState(initialState.jsonText);
  const [deviceCount, setDeviceCount] = useState(initialState.deviceCount);
  const [saveState, setSaveState] = useState<SaveState>(
    initialState.error
      ? { tone: "error", message: initialState.error }
      : { tone: "idle", message: "Edit the JSON, then save it to update the device definitions." }
  );

  async function saveDefinitions() {
    setSaveState({ tone: "saving", message: "Saving definitions..." });

    const response = await fetch("/api/definitions", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: jsonText
    });
    const payload = (await response.json()) as Partial<DefinitionEditorState> & {
      error?: string;
      issues?: string[];
    };

    if (!response.ok) {
      setSaveState({
        tone: "error",
        message: payload.error ?? "Definitions could not be saved.",
        issues: payload.issues
      });
      return;
    }

    setJsonText(payload.jsonText ?? jsonText);
    setDeviceCount(payload.deviceCount ?? deviceCount);
    setSaveState({ tone: "saved", message: "Definitions saved. Tablets will use this JSON on their next refresh." });
  }

  function formatJson() {
    try {
      setJsonText(JSON.stringify(JSON.parse(jsonText), null, 2));
      setSaveState({ tone: "idle", message: "JSON formatted. Save when you are ready." });
    } catch (error) {
      setSaveState({
        tone: "error",
        message: error instanceof Error ? error.message : "The editor does not contain valid JSON."
      });
    }
  }

  function addBlankDevice() {
    try {
      const document = JSON.parse(jsonText || "{}") as { devices?: unknown[] };
      const devices = Array.isArray(document.devices) ? document.devices : [];
      devices.push(createBlankDeviceTemplate(devices.length + 1));
      setJsonText(JSON.stringify({ ...document, devices }, null, 2));
      setSaveState({
        tone: "idle",
        message: "Blank device added. Replace the MAC address and save the JSON."
      });
    } catch (error) {
      setSaveState({
        tone: "error",
        message: error instanceof Error ? error.message : "Fix the JSON before adding another device."
      });
    }
  }

  return (
    <main className="page-shell definitions-shell">
      <header className="page-header">
        <div>
          <Link className="back-link" href="/">
            Back to fleet
          </Link>
          <h1>Definitions</h1>
          <p>Configure KDS screens as JSON. Tablets match themselves by Ethernet MAC address.</p>
        </div>
      </header>

      <section className="panel json-definitions-panel">
        <div className="json-editor-header">
          <div>
            <h2>Device Definitions JSON</h2>
            <p>
              Saved devices: <strong>{deviceCount}</strong>
            </p>
          </div>
          <div className="json-editor-actions">
            <button type="button" className="secondary-button" onClick={addBlankDevice}>
              Add blank device
            </button>
            <button type="button" className="secondary-button" onClick={formatJson}>
              Format JSON
            </button>
            <button type="button" className="primary-button" onClick={() => void saveDefinitions()}>
              Save definitions
            </button>
          </div>
        </div>

        <div className="json-editor-layout">
          <label className="json-editor-field">
            <span>JSON source</span>
            <textarea
              value={jsonText}
              onChange={(event) => {
                setJsonText(event.target.value);
                setSaveState({ tone: "idle", message: "Unsaved changes." });
              }}
              spellCheck={false}
            />
          </label>

          <aside className="json-help">
            <h3>Minimum Device</h3>
            <p>Each device needs only a MAC address and a display name. The dashboard fills in defaults for the rest.</p>
            <pre>{minimumDeviceExample}</pre>
            <h3>Saved File</h3>
            <code>{initialState.filePath}</code>
          </aside>
        </div>

        <div className={`json-save-state ${saveState.tone}`}>
          <strong>{saveState.message}</strong>
          {saveState.tone === "error" && saveState.issues?.length ? (
            <ul>
              {saveState.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function createBlankDeviceTemplate(index: number) {
  return {
    macAddress: "replace-with-tablet-mac",
    displayName: `KDS Screen ${index}`,
    locationName: "Kitchen",
    role: "KDS screen",
    squareKdsPackageName: "com.squareup.rst.kds",
    fulfillmentMethods: {
      includeFutureFulfillmentMethods: false,
      methods: [
        { name: "For Here", enabled: true },
        { name: "Pergola Order", enabled: false },
        { name: "To Go", enabled: true }
      ]
    },
    expectedSettings: [
      { section: "General", setting: "Display Type", expected: "Expeditor" },
      { section: "Source & Fulfilment", setting: "View point of sale orders", expected: "On" }
    ],
    printers: []
  };
}

const minimumDeviceExample = `{
  "devices": [
    {
      "macAddress": "aa:bb:cc:dd:ee:ff",
      "displayName": "Expo KDS",
      "fulfillmentMethods": {
        "includeFutureFulfillmentMethods": false,
        "methods": [
          { "name": "For Here", "enabled": true },
          { "name": "Pergola Order", "enabled": false },
          { "name": "To Go", "enabled": true }
        ]
      },
      "expectedSettings": [
        { "section": "General", "setting": "Display Type", "expected": "Expeditor" }
      ],
      "printers": [
        { "name": "Expo Printer", "host": "10.0.70.2", "port": 9100 }
      ]
    }
  ]
}`;
