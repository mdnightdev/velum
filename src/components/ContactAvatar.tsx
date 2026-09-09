import React, { useEffect, useState } from 'react';
import { resolveMediaUrl } from '../utils/mediaPipeline';

const AVATAR_COLOR_CLASSES: Record<string, string> = {
  blue: 'bg-theme-blue-avatar-bg text-theme-blue-avatar border-theme-blue-avatar-border',
  emerald: 'bg-theme-emerald-avatar-bg text-theme-emerald-avatar border-theme-emerald-avatar-border',
  amber: 'bg-theme-amber-avatar-bg text-theme-amber-avatar border-theme-amber-avatar-border',
  purple: 'bg-theme-purple-avatar-bg text-theme-purple-avatar border-theme-purple-avatar-border',
  charcoal: 'bg-velum-800 text-text-secondary border-velum-600',
};

export function isAvatarImageSrc(avatar?: string | null): boolean {
  if (!avatar) return false;
  const v = avatar.trim();
  if (!v) return false;
  if (AVATAR_COLOR_CLASSES[v]) return false;
  return (
    v.startsWith('http://') ||
    v.startsWith('https://') ||
    v.startsWith('data:image/') ||
    v.startsWith('blob:') ||
    v.startsWith('/') ||
    v.includes('/uploads/')
  );
}

type ContactAvatarProps = {
  name: string;
  avatar?: string | null;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  as?: 'div' | 'button';
};

/**
 * Image XOR initials — never both. Broken URLs fall back to the letter.
 */
export function ContactAvatar({
  name,
  avatar,
  className = 'w-10 h-10 rounded-xl',
  onClick,
  title,
  as = 'div',
}: ContactAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const initials = ((name || '?').trim().charAt(0) || '?').toUpperCase();
  const colorKey = avatar && AVATAR_COLOR_CLASSES[avatar.trim()] ? avatar.trim() : null;
  const showImage = isAvatarImageSrc(avatar) && !imgFailed;

  useEffect(() => {
    setImgFailed(false);
  }, [avatar]);

  const classes = `${className} border relative flex items-center justify-center font-bold text-xs overflow-hidden flex-shrink-0 ${
    colorKey ? AVATAR_COLOR_CLASSES[colorKey] : 'bg-velum-750 border-velum-600 text-text-primary'
  }${onClick ? ' cursor-pointer active:scale-95 transition-transform' : ''}`;

  const body = showImage ? (
    <img
      src={resolveMediaUrl(avatar!)}
      alt=""
      className="absolute inset-0 w-full h-full object-cover"
      referrerPolicy="no-referrer"
      onError={() => setImgFailed(true)}
    />
  ) : (
    <span className="uppercase text-sm font-semibold leading-none select-none" aria-hidden="true">
      {initials}
    </span>
  );

  if (as === 'button' || onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${classes} p-0`}
        title={title}
        aria-label={title || `Avatar for ${name}`}
      >
        {body}
      </button>
    );
  }

  return (
    <div className={classes} title={title} aria-label={name}>
      {body}
    </div>
  );
}
