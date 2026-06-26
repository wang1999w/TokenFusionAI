import { useTranslations } from 'next-intl';
import { ForgotPasswordForm } from '@/components/modules/auth/ForgotPasswordForm';

/**
 * 找回密码页面
 *
 * 布局结构：
 *  - 全屏渐变背景（品牌深色底 + 顶部品牌色光晕）
 *  - 居中卡片容器（max-w-md，卡片背景 #111827，圆角 rounded-xl）
 *  - 卡片内：标题（useTranslations('auth').resetPassword）+ ForgotPasswordForm 组件
 *
 * 说明：本页面为服务端组件，useTranslations 在服务端即可使用，
 *       表单交互逻辑封装在客户端组件 ForgotPasswordForm 中。
 */
export default function ForgotPasswordPage() {
  // 获取 auth 命名空间翻译，用于页面标题
  const t = useTranslations('auth');

  return (
    <main
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{
        // 渐变背景：深色底 #0B1120 + 顶部品牌蓝/青色径向光晕
        background:
          'radial-gradient(circle at 50% 0%, rgba(59,130,246,0.15), transparent 55%), #0B1120',
      }}
    >
      {/* 居中卡片容器，宽度上限 max-w-md */}
      <div className="w-full max-w-md">
        {/* 卡片本体：深色背景 + 圆角 + 边框 + 阴影 */}
        <div className="rounded-xl border border-white/10 bg-brand-card p-8 shadow-2xl">
          {/* 页面标题 */}
          <h1 className="mb-8 text-center text-2xl font-bold text-white">
            {t('resetPassword')}
          </h1>
          {/* 找回密码表单（客户端组件） */}
          <ForgotPasswordForm />
        </div>
      </div>
    </main>
  );
}
