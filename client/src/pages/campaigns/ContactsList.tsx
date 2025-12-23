import React, { useEffect, useState } from "react";

export default function ContactsList() {
  const [contacts, setContacts] = useState([]);

  useEffect(() => {
    fetch("/api/contacts?organizationId=org-demo")
      .then((res) => res.json())
      .then((data) => setContacts(data.contacts || []));
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-2">Global Contact List</h2>
      {contacts.length === 0 ? (
        <div className="text-gray-500">No contacts yet.</div>
      ) : (
        <ul className="list-disc ml-6">
          {contacts.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
