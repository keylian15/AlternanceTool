'use client';
import { useFormStatus } from 'react-dom';

export default function SubmitButton({
  children, ghost, formAction,
}: { children: React.ReactNode; ghost?: boolean; formAction?: (fd: FormData) => void | Promise<void> }) {
  const { pending } = useFormStatus();
  return (
    <button className={ghost ? 'btn ghost' : 'btn'} disabled={pending} formAction={formAction}>
      {pending ? '…' : children}
    </button>
  );
}
