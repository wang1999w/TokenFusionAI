import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Input 输入框组件（Shadcn 风格）
 * 品牌深色主题适配
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-xl border border-gray-700 bg-[#111827] px-4 py-2 text-base text-white placeholder:text-[#475569]',
          'transition-colors focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
