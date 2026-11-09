import { CircleAlert, CircleCheck } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';

type FeedbackMessageProps = Omit<ComponentPropsWithoutRef<'p'>, 'role'> & {
  tone: 'success' | 'error';
};

const tones = {
  success: {
    role: 'status',
    icon: CircleCheck,
    style:
      'tw:border-feedback-success-border tw:bg-feedback-success-surface tw:text-feedback-success',
  },
  error: {
    role: 'alert',
    icon: CircleAlert,
    style: 'tw:border-feedback-error-border tw:bg-feedback-error-surface tw:text-feedback-error',
  },
} as const;

export const FeedbackMessage = forwardRef<HTMLParagraphElement, FeedbackMessageProps>(
  function FeedbackMessage({ tone, className = '', children, ...props }, ref) {
    const { role, icon: Icon, style } = tones[tone];
    return (
      <p
        {...props}
        ref={ref}
        role={role}
        className={`tw:m-0 tw:flex tw:min-w-0 tw:items-start tw:gap-2 tw:rounded-control tw:border tw:border-s-4 tw:p-3 tw:text-caption tw:leading-note tw:font-medium tw:wrap-anywhere tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-focus ${style} ${className}`}
      >
        <Icon size={18} aria-hidden="true" className="tw:mt-0.5 tw:shrink-0" />
        <span className="tw:min-w-0">{children}</span>
      </p>
    );
  },
);
