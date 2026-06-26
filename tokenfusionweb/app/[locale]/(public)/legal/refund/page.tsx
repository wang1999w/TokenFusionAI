import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/**
 * 退款政策页
 *
 * 说明：
 * - 规定 Token 充值与订阅的退款规则；
 * - 使用 prose 排版（max-w-3xl 居中）；
 * - 通过 generateMetadata 生成 SEO 元数据。
 */

/** 生成 SEO 元数据 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal');
  return {
    title: t('refundTitle'),
    description: t('refundMetaDesc'),
    robots: { index: true, follow: true },
  };
}

export default function RefundPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      {/* prose 排版 */}
      <article className="prose prose-invert prose-headings:text-white prose-p:text-text-secondary prose-a:text-brand-primary prose-strong:text-white prose-li:text-text-secondary max-w-none">
        <h1>Refund Policy</h1>
        <p className="text-sm text-text-tertiary">
          Last updated: June 27, 2026
        </p>

        {/* 1. 概述 */}
        <h2>1. Overview</h2>
        <p>
          We want you to be satisfied with your TokenFusion AI experience. This
          policy outlines the conditions under which we issue refunds for token
          purchases and subscriptions.
        </p>

        {/* 2. 一次性令牌 */}
        <h2>2. One-Time Token Purchases</h2>
        <ul>
          <li>
            <strong>Unused tokens:</strong> Full refunds are available for
            one-time purchases if you have not used any of the purchased tokens,
            within <strong>7 days</strong> of the purchase date.
          </li>
          <li>
            <strong>Partially used tokens:</strong> Refunds are calculated on a
            pro-rata basis for the unused portion, minus a processing fee.
          </li>
          <li>
            <strong>Used tokens:</strong> Purchases where all tokens have been
            consumed are non-refundable.
          </li>
        </ul>

        {/* 3. 订阅 */}
        <h2>3. Subscriptions</h2>
        <ul>
          <li>
            <strong>Monthly subscriptions:</strong> You may cancel at any time.
            Cancellation takes effect at the end of the current billing cycle;
            no charges apply for the next cycle.
          </li>
          <li>
            <strong>Refund window:</strong> New subscriptions are eligible for a
            full refund if canceled within <strong>3 days</strong> of the first
            payment and token usage is minimal.
          </li>
          <li>
            <strong>Renewal:</strong> Subscriptions do not auto-renew unless
            explicitly enabled.
          </li>
        </ul>

        {/* 4. 不可退款情形 */}
        <h2>4. Non-Refundable Cases</h2>
        <p>Refunds will not be issued in the following situations:</p>
        <ul>
          <li>
            Violation of our Terms of Service resulting in account suspension.
          </li>
          <li>
            Purchases made more than 7 days ago (for one-time) or 3 days
            (subscriptions).
          </li>
          <li>
            Tokens consumed through generation activities, except as described
            above.
          </li>
          <li>
            Disputes filed after the refund window has expired.
          </li>
        </ul>

        {/* 5. 申请流程 */}
        <h2>5. How to Request a Refund</h2>
        <p>To request a refund, please follow these steps:</p>
        <ol>
          <li>
            Log in to your account and navigate to the{' '}
            <Link href="/dashboard/billing">Billing</Link> page.
          </li>
          <li>
            Locate the relevant transaction and click &ldquo;Request Refund&rdquo;.
          </li>
          <li>
            Provide a reason for the refund request.
          </li>
          <li>
            Our team will review your request within <strong>3 business days</strong>.
          </li>
        </ol>
        <p>
          Alternatively, email us at billing@tokenfusion.ai with your order
          number and reason.
        </p>

        {/* 6. 退款处理 */}
        <h2>6. Refund Processing</h2>
        <ul>
          <li>
            Approved refunds are credited to the original payment method within
            5-10 business days.
          </li>
          <li>
            Processing times depend on your bank or payment provider.
          </li>
          <li>
            The corresponding token balance will be deducted upon refund
            approval.
          </li>
        </ul>

        {/* 7. 争议解决 */}
        <h2>7. Disputes</h2>
        <p>
          If you believe a charge is unauthorized or a refund was incorrectly
          denied, please contact us at billing@tokenfusion.ai before initiating
          a chargeback. We aim to resolve all disputes amicably.
        </p>

        {/* 8. 联系方式 */}
        <h2>8. Contact Us</h2>
        <p>
          For refund-related inquiries, contact our billing team at
          billing@tokenfusion.ai.
        </p>

        <p>
          <Link href="/" className="not-prose text-brand-primary hover:underline">
            ← Back to home
          </Link>
        </p>
      </article>
    </div>
  );
}
