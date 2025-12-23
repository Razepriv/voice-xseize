import React, { useState } from "react";

export default function BulkContactsForm({ onAdd }: { onAdd: (contacts: string[]) => void }) {
  const [bulkInput, setBulkInput] = useState("");
  const [error, setError] = useState("");

  function handleAdd() {
    // Split by newlines, trim, filter empty
    const contacts = bulkInput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (contacts.length === 0) {
      setError("Please enter at least one contact.");
      return;
    }
    setError("");
    onAdd(contacts);
    setBulkInput("");
  }

  return (
    <div className="mb-4">
      <label className="block font-medium mb-1">Add Contacts in Bulk</label>
      <textarea
        className="w-full border rounded p-2 mb-2"
        rows={5}
        placeholder="Paste or type one contact per line (name, phone, or email)"
        value={bulkInput}
        onChange={(e) => setBulkInput(e.target.value)}
      />
      {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
      <button
        className="bg-green-600 text-white px-3 py-1 rounded"
        onClick={handleAdd}
        type="button"
      >
        Add to Campaign
      </button>
    </div>
  );
}
