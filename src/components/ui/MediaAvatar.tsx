import React, { useEffect, useRef, useState } from 'react';
import { Building2, Trash2, Upload } from 'lucide-react';
import { resolveMediaUrl } from '../../lib/mediaAssets';
import { processUploadedImage } from '../../lib/imageUpload';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type AvatarTone = 'blue' | 'amber' | 'orange' | 'emerald' | 'purple' | 'indigo' | 'slate';

const AVATAR_SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-14 h-14 text-lg',
};

const AVATAR_TONE_CLASSES: Record<AvatarTone, string> = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  slate: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TP';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const ProfileAvatar: React.FC<{
  src?: string | null;
  name: string;
  size?: AvatarSize;
  tone?: AvatarTone;
  shape?: 'circle' | 'rounded';
  className?: string;
}> = ({
  src,
  name,
  size = 'md',
  tone = 'blue',
  shape = 'circle',
  className = '',
}) => {
  const resolved = resolveMediaUrl(src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-xl';
  const sizeClass = AVATAR_SIZE_CLASSES[size];

  if (resolved && !failed) {
    return (
      <img
        src={resolved}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${sizeClass} ${shapeClass} object-cover shrink-0 border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 ${className}`}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={`${sizeClass} ${shapeClass} ${AVATAR_TONE_CLASSES[tone]} shrink-0 flex items-center justify-center font-bold border border-gray-200/70 dark:border-gray-700/70 select-none ${className}`}
    >
      {getInitials(name)}
    </div>
  );
};

const LOGO_SIZE_CLASSES: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'w-6 h-6 p-0.5 rounded-md',
  sm: 'w-8 h-8 p-1 rounded-lg',
  md: 'w-10 h-10 p-1 rounded-lg',
  lg: 'w-14 h-14 p-1.5 rounded-xl',
};

export const CompanyLogo: React.FC<{
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ src, name, size = 'md', className = '' }) => {
  const resolved = resolveMediaUrl(src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  const sizeClass = LOGO_SIZE_CLASSES[size];

  if (resolved && !failed) {
    return (
      <div
        className={`${sizeClass} shrink-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden ${className}`}
      >
        <img
          src={resolved}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-contain rounded"
        />
      </div>
    );
  }

  return (
    <div
      aria-label={name}
      className={`${sizeClass} shrink-0 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center ${className}`}
    >
      <Building2 className={size === 'xs' ? 'w-3.5 h-3.5' : size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />
    </div>
  );
};

export const CompactImageUploader: React.FC<{
  label: string;
  currentUrl?: string | null;
  name: string;
  variant?: 'avatar' | 'logo';
  uploading?: boolean;
  onUpload: (dataUrl: string) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
  onError?: (message: string) => void;
}> = ({
  label,
  currentUrl,
  name,
  variant = 'avatar',
  uploading = false,
  onUpload,
  onRemove,
  onError,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await processUploadedImage(file, {
        maxDimension: variant === 'logo' ? 512 : 420,
        preserveTransparency: variant === 'logo',
        quality: 0.86,
        maxFileSizeMb: 5,
      });
      await onUpload(dataUrl);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Erreur import image.');
    } finally {
      setBusy(false);
    }
  }

  const isWorking = uploading || busy;

  return (
    <div className="flex items-center gap-3">
      {variant === 'logo' ? (
        <CompanyLogo src={currentUrl} name={name} size="lg" />
      ) : (
        <ProfileAvatar src={currentUrl} name={name} size="xl" shape="rounded" tone="orange" />
      )}
      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">{label}</div>
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => void handleFileChange(e)}
          />
          <button
            type="button"
            disabled={isWorking}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200 disabled:opacity-50 transition"
          >
            <Upload className="w-3.5 h-3.5" />
            {isWorking ? 'Envoi...' : currentUrl ? 'Modifier' : 'Importer'}
          </button>
          {currentUrl && onRemove && (
            <button
              type="button"
              disabled={isWorking}
              onClick={() => void onRemove()}
              title="Retirer"
              aria-label="Retirer l’image"
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-xs font-semibold disabled:opacity-50 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Retirer
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
