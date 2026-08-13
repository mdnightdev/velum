import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps {
  id?: string;
  value?: any;
  onChange?: (e: any) => any;
  placeholder?: string;
  className?: string;
  required?: boolean;
  [key: string]: any;
}

export default function PasswordInput({ id, className, value, onChange, placeholder, required, ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className={`w-full bg-velum-900 border border-white-5 rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-disabled focus:border-accent focus:outline-none transition font-sans pr-10 ${className || ''}`}
        {...props}
      />
      <button
        id={`toggle-${id}`}
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-secondary transition border-0 bg-transparent cursor-pointer p-1"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
