'use client';

import { useRef, useState } from 'react';

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

function compressImage(file: File, maxSize = 256, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture impossible.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image invalide.'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas indisponible.'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function AvatarUploader({
  fullName,
  avatarUrl,
  size = 36,
  editable = false,
  onUpdated,
}: {
  fullName: string;
  avatarUrl?: string | null;
  size?: number;
  editable?: boolean;
  onUpdated?: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const dataUrl = await compressImage(file);
      const res = await fetch('/api/profile/avatar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: dataUrl }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Erreur lors de l\'envoi.');
        return;
      }
      const updated = await res.json();
      onUpdated?.(updated.avatarUrl);
    } catch {
      setError('Impossible de traiter cette image.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/profile/avatar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: null }),
      });
      if (res.ok) onUpdated?.(null);
    } finally {
      setBusy(false);
    }
  }

  const dim = { width: size, height: size };

  return (
    <div className="flex items-center gap-2">
      <div
        className="relative rounded-full overflow-hidden ring-1 ring-hud-cyan/50 shadow-neon bg-hud-cyan/10 flex items-center justify-center text-hud-cyan font-bold shrink-0"
        style={dim}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
        ) : (
          <span style={{ fontSize: size * 0.38 }}>{initials(fullName) || '?'}</span>
        )}
      </div>

      {editable && (
        <div className="flex flex-col gap-1">
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="btn-secondary text-xs py-1 px-2 disabled:opacity-40"
            >
              {busy ? '...' : avatarUrl ? 'Changer' : 'Ajouter une photo'}
            </button>
            {avatarUrl && (
              <button
                type="button"
                disabled={busy}
                onClick={handleRemove}
                className="btn-danger text-xs py-1 px-2 disabled:opacity-40"
              >
                Retirer
              </button>
            )}
          </div>
          {error && <p className="text-xs text-empire-rougeVif">{error}</p>}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      )}
    </div>
  );
}
