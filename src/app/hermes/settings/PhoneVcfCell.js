'use client';

import { useRef, useState } from 'react';

/**
 * Compact per-phone-number .vcf contact-card control for the settings table.
 * Uploads a .vcf to /api/media/vcard, then assigns it to the phone number.
 *
 * @param {{ number: object, onChange: (mediaAssetId: string|null) => Promise<void>|void }} props
 *   number.mediaAsset is the currently attached card ({ id, label } | null).
 */
export default function PhoneVcfCell({ number, onChange }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const card = number.mediaAsset || null;

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('label', file.name);
      const res = await fetch('/api/media/vcard', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Upload failed');
      await onChange(data.asset.id);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await onChange(null);
    } catch (err) {
      setError(err.message || 'Failed to remove');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
      {card ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span title={card.label || 'Contact card'}>📎 {card.label || 'Contact card'}</span>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
            style={{ fontSize: '0.75rem', cursor: 'pointer' }}>
            Replace
          </button>
          <button type="button" onClick={remove} disabled={busy}
            style={{ fontSize: '0.75rem', cursor: 'pointer' }}>
            Remove
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
          style={{ fontSize: '0.8rem', cursor: 'pointer' }}>
          {busy ? 'Uploading…' : 'Upload .vcf'}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".vcf,text/vcard,text/x-vcard"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {error && <span style={{ color: '#c0392b', fontSize: '0.7rem' }}>{error}</span>}
    </div>
  );
}
